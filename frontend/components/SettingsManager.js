/**
 * SettingsManager Component
 * 
 * Handles all settings functionality across the application including API key management,
 * LLM status monitoring, prompt customization, and application configuration.
 * 
 * Key Responsibilities:
 * - API key management and testing
 * - LLM provider configuration and status monitoring
 * - Custom prompt editing and template selection
 * - Application settings persistence
 * - Test image analysis functionality
 * - Settings page initialization and state management
 */

import eventBus from '../services/EventBus.js';
import cacheManager from '../managers/CacheManager.js';

class SettingsManager {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.statusInterval = null;
        
        this.setupEventListeners();
        console.log('SettingsManager initialized');
    }

    setupEventListeners() {
        // Settings events
        eventBus.on('settings:initialize-page', () => this.initializeSettingsPage());
        eventBus.on('settings:test-api-key', (data) => this.testApiKey(data.provider));
        eventBus.on('settings:handle-test-image-upload', (data) => this.handleTestImageUpload(data.event));
        eventBus.on('settings:analyze-test-image', () => this.analyzeTestImage());
        eventBus.on('settings:update-char-count', () => this.updateCharCount());
        eventBus.on('settings:select-template', (data) => this.selectTemplate(data.template));
        
        // LLM status events
        eventBus.on('settings:check-llm-status', () => this.checkLLMStatus());
        
        // Settings requests from other components
        eventBus.on('settings:get-api-settings', (data) => {
            const settings = this.getApiSettings();
            data.callback(settings);
        });

        // DOM event listeners for settings functionality (moved from app.js)
        this.bindDOMEventListeners();
    }

    bindDOMEventListeners() {
        // Settings functionality DOM events
        const editPrompt = document.getElementById('edit-prompt');
        const savePrompt = document.getElementById('save-prompt');
        const cancelPromptEdit = document.getElementById('cancel-prompt-edit');
        const resetPrompt = document.getElementById('reset-prompt');
        const testPrompt = document.getElementById('test-prompt');
        const saveSettings = document.getElementById('save-settings');

        if (editPrompt) {
            editPrompt.addEventListener('click', () => eventBus.emit('settings:edit-prompt'));
        }

        if (savePrompt) {
            savePrompt.addEventListener('click', () => eventBus.emit('settings:save-prompt'));
        }

        if (cancelPromptEdit) {
            cancelPromptEdit.addEventListener('click', () => eventBus.emit('settings:cancel-prompt-edit'));
        }

        if (resetPrompt) {
            resetPrompt.addEventListener('click', () => eventBus.emit('settings:reset-prompt'));
        }

        if (testPrompt) {
            testPrompt.addEventListener('click', () => eventBus.emit('settings:test-prompt'));
        }

        if (saveSettings) {
            saveSettings.addEventListener('click', () => eventBus.emit('settings:save-application-settings'));
        }

        // API Key management DOM events
        const testAnthropicKey = document.getElementById('test-anthropic-key');
        const testOpenaiKey = document.getElementById('test-openai-key');
        const testImageUpload = document.getElementById('test-image-upload');
        const analyzeTestImage = document.getElementById('analyze-test-image');

        if (testAnthropicKey) {
            testAnthropicKey.addEventListener('click', () => eventBus.emit('settings:test-api-key', { provider: 'anthropic' }));
        }

        if (testOpenaiKey) {
            testOpenaiKey.addEventListener('click', () => eventBus.emit('settings:test-api-key', { provider: 'openai' }));
        }

        if (testImageUpload) {
            testImageUpload.addEventListener('change', (e) => eventBus.emit('settings:handle-test-image-upload', { event: e }));
        }

        if (analyzeTestImage) {
            analyzeTestImage.addEventListener('click', () => eventBus.emit('settings:analyze-test-image'));
        }

        // Prompt textarea character count
        const promptTextarea = document.getElementById('prompt-textarea');
        if (promptTextarea) {
            promptTextarea.addEventListener('input', () => eventBus.emit('settings:update-char-count'));
        }

        // Template selection
        document.querySelectorAll('[data-template]').forEach(template => {
            template.addEventListener('click', () => eventBus.emit('settings:select-template', { template: template.dataset.template }));
        });
    }

    // Settings Page Initialization
    async initializeSettingsPage() {
        console.log('Settings page initialized');
        await this.loadCurrentPrompt();
        this.loadApplicationSettings();
        this.loadApiKeySettings();
        this.updateSystemInfo();
        cacheManager.updateCacheStatus();
        
        // Add event listeners for key source toggle
        document.querySelectorAll('input[name="key-source"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.handleKeySourceChange();
            });
        });
    }
    
    handleKeySourceChange() {
        const keySource = document.querySelector('input[name="key-source"]:checked').value;
        const customKeysContainer = document.getElementById('custom-keys-container');
        
        if (keySource === 'custom') {
            customKeysContainer.classList.remove('hidden');
        } else {
            customKeysContainer.classList.add('hidden');
        }
        
        // Auto-save the setting
        this.saveApiKeySettings();
    }
    
    // Prompt Management
    async loadCurrentPrompt() {
        try {
            const response = await fetch(`${this.apiBase}/settings/prompt`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('current-prompt').textContent = data.prompt || this.getDefaultPrompt();
                
                // Update status indicator
                const statusSpan = document.getElementById('prompt-status');
                if (data.is_custom) {
                    statusSpan.textContent = 'Custom';
                    statusSpan.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded';
                } else {
                    statusSpan.textContent = 'Default';
                    statusSpan.className = 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded';
                }
            } else {
                // Fallback to default prompt
                document.getElementById('current-prompt').textContent = this.getDefaultPrompt();
            }
        } catch (error) {
            console.error('Error loading current prompt:', error);
            document.getElementById('current-prompt').textContent = this.getDefaultPrompt();
        }
    }
    
    getDefaultPrompt() {
        return `Analyze this image and provide a detailed description focusing on the main subjects, actions, and context. Then extract relevant keywords.

Return your response as a JSON object with these fields:
- "description": A detailed description of what you see in the image
- "keywords": An array of relevant keywords that describe the image content

Focus on:
- Main subjects and people
- Actions being performed
- Objects and equipment visible
- Setting and environment
- Events or activities
- Emotions or mood if apparent

Do not include speculation about metadata like camera settings, date, or photographer information.`;
    }
    
    loadApplicationSettings() {
        // Load settings from localStorage or set defaults
        const settings = JSON.parse(localStorage.getItem('targetvision_settings') || '{}');
        
        document.getElementById('auto-approve').checked = settings.autoApprove || false;
        document.getElementById('batch-processing').checked = settings.batchProcessing !== false; // default true
        document.getElementById('retry-failed').checked = settings.retryFailed || false;
        document.getElementById('show-confidence').checked = settings.showConfidence !== false; // default true
        document.getElementById('advanced-filters-default').checked = settings.advancedFiltersDefault || false;
        document.getElementById('compact-view').checked = settings.compactView || false;
    }
    
    editPrompt() {
        const viewMode = document.getElementById('prompt-view');
        const editMode = document.getElementById('prompt-edit');
        const currentPrompt = document.getElementById('current-prompt').textContent;
        
        // Switch to edit mode
        viewMode.classList.add('hidden');
        editMode.classList.remove('hidden');
        
        // Populate textarea
        document.getElementById('prompt-textarea').value = currentPrompt;
        this.updateCharCount();
    }
    
    cancelPromptEdit() {
        const viewMode = document.getElementById('prompt-view');
        const editMode = document.getElementById('prompt-edit');
        
        // Switch back to view mode
        editMode.classList.add('hidden');
        viewMode.classList.remove('hidden');
    }
    
    async savePrompt() {
        const textarea = document.getElementById('prompt-textarea');
        const prompt = textarea.value.trim();
        
        if (!prompt) {
            eventBus.emit('toast:error', { title: 'Error', message: 'Prompt cannot be empty' });
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/settings/prompt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt })
            });
            
            if (response.ok) {
                // Update display
                document.getElementById('current-prompt').textContent = prompt;
                
                // Update status to custom
                const statusSpan = document.getElementById('prompt-status');
                statusSpan.textContent = 'Custom';
                statusSpan.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded';
                
                // Switch back to view mode
                this.cancelPromptEdit();
                
                eventBus.emit('toast:success', { title: 'Success', message: 'Custom prompt saved successfully' });
            } else {
                const errorData = await response.json();
                eventBus.emit('toast:error', { title: 'Error', message: errorData.error || 'Failed to save prompt' });
            }
        } catch (error) {
            console.error('Error saving prompt:', error);
            eventBus.emit('toast:error', { title: 'Error', message: 'Failed to save prompt' });
        }
    }
    
    async resetPrompt() {
        try {
            const response = await fetch(`${this.apiBase}/settings/prompt`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Reset to default
                const defaultPrompt = this.getDefaultPrompt();
                document.getElementById('current-prompt').textContent = defaultPrompt;
                document.getElementById('prompt-textarea').value = defaultPrompt;
                
                // Update status to default
                const statusSpan = document.getElementById('prompt-status');
                statusSpan.textContent = 'Default';
                statusSpan.className = 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded';
                
                this.updateCharCount();
                eventBus.emit('toast:success', { title: 'Success', message: 'Prompt reset to default' });
            } else {
                eventBus.emit('toast:error', { title: 'Error', message: 'Failed to reset prompt' });
            }
        } catch (error) {
            console.error('Error resetting prompt:', error);
            eventBus.emit('toast:error', { title: 'Error', message: 'Failed to reset prompt' });
        }
    }
    
    // Template Selection and Character Count
    selectTemplate(templateName) {
        const templates = {
            detailed: `Analyze this image comprehensively and provide a detailed description covering all visual elements, technical aspects, emotions, and context. Then extract comprehensive keywords.

Return your response as a JSON object with these fields:
- "description": A comprehensive, detailed description of everything visible in the image
- "keywords": An extensive array of relevant keywords and tags

Focus on:
- All people, their appearance, clothing, expressions, and actions
- Every object, tool, equipment, and item visible
- Complete setting description including background details
- Technical aspects like composition, lighting, and perspective
- Activities, events, or scenarios taking place
- Emotions, mood, atmosphere, and context
- Colors, textures, and visual patterns
- Any text, signs, or readable elements

Provide extensive detail and numerous relevant keywords for comprehensive searchability.`,
            
            simple: `Analyze this image and provide a simple, clear description of what you see. Then list the main keywords.

Return your response as a JSON object with these fields:
- "description": A simple, straightforward description of the main elements
- "keywords": A basic array of the most important keywords

Focus on:
- Main subjects and what they're doing
- Key objects and equipment
- Basic setting or location
- Primary activity or event`,
            
            technical: `Analyze this image with focus on technical and equipment details. Provide specific identification of tools, gear, and technical aspects.

Return your response as a JSON object with these fields:
- "description": A technically detailed description focusing on equipment, tools, and technical aspects
- "keywords": Technical keywords including specific equipment names, techniques, and specifications

Focus on:
- Specific equipment, tools, and gear identification
- Technical techniques or methods being demonstrated
- Professional or specialized context
- Equipment brands, models, or technical specifications where visible
- Safety equipment and proper technique usage`
        };
        
        if (templates[templateName]) {
            document.getElementById('prompt-textarea').value = templates[templateName];
            this.updateCharCount();
            
            // Visual feedback
            document.querySelectorAll('[data-template]').forEach(t => {
                t.classList.remove('bg-blue-50', 'border-blue-200');
                t.classList.add('bg-white', 'border-gray-200');
            });
            
            const selectedTemplate = document.querySelector(`[data-template="${templateName}"]`);
            if (selectedTemplate) {
                selectedTemplate.classList.remove('bg-white', 'border-gray-200');
                selectedTemplate.classList.add('bg-blue-50', 'border-blue-200');
            }
        }
    }
    
    updateCharCount() {
        const textarea = document.getElementById('prompt-textarea');
        const charCount = document.getElementById('prompt-char-count');
        if (textarea && charCount) {
            charCount.textContent = `${textarea.value.length} characters`;
        }
    }
    
    // System Information
    updateSystemInfo() {
        document.getElementById('user-agent').textContent = navigator.userAgent;
        document.getElementById('local-time').textContent = new Date().toLocaleString();
        document.getElementById('timezone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Memory info if available
        if (performance.memory) {
            const memInfo = performance.memory;
            document.getElementById('js-heap-size').textContent = 
                `${Math.round(memInfo.usedJSHeapSize / 1024 / 1024)} MB / ${Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024)} MB`;
        }
        
        // Connection info if available
        if (navigator.connection) {
            const conn = navigator.connection;
            document.getElementById('connection-type').textContent = conn.effectiveType || 'Unknown';
        }
    }
    
    // API Key Management Methods
    getApiSettings() {
        const settings = JSON.parse(localStorage.getItem('targetvision_api_settings') || '{}');
        const keySource = settings.key_source || 'default';
        
        return {
            // Only return API keys if using custom key source
            anthropic_key: keySource === 'custom' ? settings.anthropic_key : undefined,
            openai_key: keySource === 'custom' ? settings.openai_key : undefined,
            active_provider: settings.active_provider || 'anthropic',
            key_source: keySource
        };
    }
    
    loadApiKeySettings() {
        const settings = JSON.parse(localStorage.getItem('targetvision_api_settings') || '{}');
        
        // Load key source setting (default to 'default' for server keys)
        const keySource = settings.key_source || 'default';
        const keySourceElement = document.getElementById(`use-${keySource}-keys`);
        if (keySourceElement) {
            keySourceElement.checked = true;
        }
        
        // Show/hide custom keys container based on setting
        const customKeysContainer = document.getElementById('custom-keys-container');
        if (customKeysContainer) {
            if (keySource === 'custom') {
                customKeysContainer.classList.remove('hidden');
                
                // Load API keys (masked for security)
                if (settings.anthropic_key) {
                    const anthropicInput = document.getElementById('anthropic-api-key');
                    if (anthropicInput) anthropicInput.value = '••••••••••••••••';
                }
                if (settings.openai_key) {
                    const openaiInput = document.getElementById('openai-api-key');
                    if (openaiInput) openaiInput.value = '••••••••••••••••';
                }
            } else {
                customKeysContainer.classList.add('hidden');
            }
        }
        
        // Load active provider
        const activeProvider = settings.active_provider || 'anthropic';
        const providerElement = document.getElementById(`provider-${activeProvider}`);
        if (providerElement) {
            providerElement.checked = true;
        }
    }
    
    saveApiKeySettings() {
        const settings = JSON.parse(localStorage.getItem('targetvision_api_settings') || '{}');
        
        // Save key source setting
        const keySourceElement = document.querySelector('input[name="key-source"]:checked');
        if (keySourceElement) {
            const keySource = keySourceElement.value;
            settings.key_source = keySource;
            
            // Only save API keys if using custom keys
            if (keySource === 'custom') {
                // Get API keys (only if they're not masked)
                const anthropicInput = document.getElementById('anthropic-api-key');
                const openaiInput = document.getElementById('openai-api-key');
                
                if (anthropicInput) {
                    const anthropicKey = anthropicInput.value;
                    if (anthropicKey && !anthropicKey.startsWith('••••')) {
                        settings.anthropic_key = anthropicKey;
                    }
                }
                
                if (openaiInput) {
                    const openaiKey = openaiInput.value;
                    if (openaiKey && !openaiKey.startsWith('••••')) {
                        settings.openai_key = openaiKey;
                    }
                }
            } else {
                // Clear custom keys when using server keys
                delete settings.anthropic_key;
                delete settings.openai_key;
            }
        }
        
        // Get active provider
        const providerElement = document.querySelector('input[name="ai-provider"]:checked');
        if (providerElement) {
            const activeProvider = providerElement.value;
            settings.active_provider = activeProvider;
        }
        
        localStorage.setItem('targetvision_api_settings', JSON.stringify(settings));
        return settings;
    }
    
    async testApiKey(provider) {
        const button = document.getElementById(`test-${provider}-key`);
        const statusDiv = document.getElementById(`${provider}-key-status`);
        const keyInput = document.getElementById(`${provider}-api-key`);
        
        if (!keyInput || !button || !statusDiv) return;
        
        const apiKey = keyInput.value;
        if (!apiKey || apiKey.startsWith('••••')) {
            this.showKeyStatus(statusDiv, 'error', 'Please enter a valid API key');
            return;
        }
        
        // Update button state
        button.disabled = true;
        button.textContent = 'Testing...';
        statusDiv.classList.remove('hidden');
        this.showKeyStatus(statusDiv, 'info', 'Testing API key...');
        
        try {
            const response = await fetch(`${this.apiBase}/settings/test-api-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: provider,
                    api_key: apiKey
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showKeyStatus(statusDiv, 'success', 'API key is valid!');
                // Save the key since it's valid
                this.saveApiKeySettings();
            } else {
                this.showKeyStatus(statusDiv, 'error', result.error || 'Invalid API key');
            }
        } catch (error) {
            this.showKeyStatus(statusDiv, 'error', 'Failed to test API key');
            console.error('API key test error:', error);
        } finally {
            button.disabled = false;
            button.textContent = 'Test';
        }
    }
    
    showKeyStatus(statusDiv, type, message) {
        statusDiv.className = `mt-1 text-xs ${type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : 'text-blue-600'}`;
        statusDiv.textContent = message;
        statusDiv.classList.remove('hidden');
    }
    
    // Test Image Analysis
    handleTestImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            eventBus.emit('toast:error', { title: 'Error', message: 'Please select an image file' });
            return;
        }
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('test-preview-img');
            const previewDiv = document.getElementById('test-image-preview');
            const analyzeButton = document.getElementById('analyze-test-image');
            
            if (previewImg && previewDiv && analyzeButton) {
                previewImg.src = e.target.result;
                previewDiv.classList.remove('hidden');
                analyzeButton.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    }
    
    async analyzeTestImage() {
        const fileInput = document.getElementById('test-image-upload');
        const analyzeButton = document.getElementById('analyze-test-image');
        const resultDiv = document.getElementById('test-analysis-result');
        
        if (!fileInput || !fileInput.files[0] || !analyzeButton || !resultDiv) return;
        
        const file = fileInput.files[0];
        
        // Get API settings to determine which provider to use
        const apiSettings = this.getApiSettings();
        const activeProvider = apiSettings.active_provider;
        
        // Check if we're using custom keys and they're available
        if (apiSettings.key_source === 'custom') {
            const hasValidKey = (activeProvider === 'anthropic' && apiSettings.anthropic_key) ||
                              (activeProvider === 'openai' && apiSettings.openai_key);
            
            if (!hasValidKey) {
                eventBus.emit('toast:error', { 
                    title: 'API Key Required', 
                    message: `Please configure a valid ${activeProvider} API key in the settings above.` 
                });
                return;
            }
        }
        
        // Update UI
        analyzeButton.disabled = true;
        analyzeButton.textContent = 'Analyzing...';
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = '<div class="text-gray-600">Processing image...</div>';
        
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('provider', activeProvider);
            
            // Add API keys if using custom keys
            if (apiSettings.key_source === 'custom') {
                if (activeProvider === 'anthropic' && apiSettings.anthropic_key) {
                    formData.append('anthropic_key', apiSettings.anthropic_key);
                } else if (activeProvider === 'openai' && apiSettings.openai_key) {
                    formData.append('openai_key', apiSettings.openai_key);
                }
            }
            
            const response = await fetch(`${this.apiBase}/settings/analyze-image`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Display results
                resultDiv.innerHTML = `
                    <div class="bg-green-50 border border-green-200 rounded p-3">
                        <h4 class="font-medium text-green-900 mb-2">✅ Analysis Complete</h4>
                        <div class="space-y-3">
                            <div>
                                <h5 class="font-medium text-gray-900">Description:</h5>
                                <p class="text-gray-700 text-sm mt-1">${result.description || 'No description provided'}</p>
                            </div>
                            <div>
                                <h5 class="font-medium text-gray-900">Keywords:</h5>
                                <div class="flex flex-wrap gap-1 mt-1">
                                    ${(result.keywords || []).map(keyword => 
                                        `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${keyword}</span>`
                                    ).join('')}
                                </div>
                            </div>
                            <div class="text-xs text-gray-500">
                                Provider: ${activeProvider} | Processing time: ${result.processing_time || 'N/A'}
                            </div>
                        </div>
                    </div>
                `;
                
                eventBus.emit('toast:success', { title: 'Success', message: 'Image analyzed successfully!' });
            } else {
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded p-3">
                        <h4 class="font-medium text-red-900">❌ Analysis Failed</h4>
                        <p class="text-red-700 text-sm mt-1">${result.error || 'Unknown error occurred'}</p>
                    </div>
                `;
                eventBus.emit('toast:error', { title: 'Analysis Failed', message: result.error || 'Unknown error occurred' });
            }
        } catch (error) {
            console.error('Image analysis error:', error);
            resultDiv.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded p-3">
                    <h4 class="font-medium text-red-900">❌ Analysis Failed</h4>
                    <p class="text-red-700 text-sm mt-1">Network error or server unavailable</p>
                </div>
            `;
            eventBus.emit('toast:error', { title: 'Analysis Failed', message: 'Network error or server unavailable' });
        } finally {
            analyzeButton.disabled = false;
            analyzeButton.textContent = 'Analyze Image';
        }
    }
    
    // LLM Status Management
    async checkLLMStatus() {
        try {
            const response = await fetch(`${this.apiBase}/api/llm-status`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const status = await response.json();
            this.updateLLMStatusDisplay(status);
            return status;
        } catch (error) {
            console.error('Error checking LLM status:', error);
            this.updateLLMStatusDisplay(null);
            return null;
        }
    }
    
    updateLLMStatusDisplay(status) {
        // Update navigation summary indicator
        const navIndicator = document.getElementById('llm-status-indicator');
        const navText = document.getElementById('llm-status-text');
        
        if (navIndicator && navText) {
            if (status && status.available) {
                navIndicator.className = 'h-2 w-2 bg-green-500 rounded-full';
                navText.textContent = 'LLM Available';
                navText.className = 'text-xs text-green-600';
            } else {
                navIndicator.className = 'h-2 w-2 bg-red-500 rounded-full';
                navText.textContent = 'LLM Unavailable';
                navText.className = 'text-xs text-red-600';
            }
        }
        
        // Update detailed status on settings page if visible
        const detailedStatus = document.getElementById('llm-detailed-status');
        if (detailedStatus) {
            if (status) {
                const statusClass = status.available ? 'text-green-600' : 'text-red-600';
                const statusIcon = status.available ? '✅' : '❌';
                
                detailedStatus.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <span class="${statusClass}">${statusIcon}</span>
                        <span class="font-medium">LLM Service ${status.available ? 'Available' : 'Unavailable'}</span>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">
                        <div>Active Provider: ${status.active_provider || 'Unknown'}</div>
                        <div>Last Check: ${new Date().toLocaleString()}</div>
                        ${status.error ? `<div class="text-red-600">Error: ${status.error}</div>` : ''}
                    </div>
                `;
            } else {
                detailedStatus.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <span class="text-red-600">❌</span>
                        <span class="font-medium">Connection Failed</span>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">
                        <div>Could not connect to LLM service</div>
                        <div>Last Check: ${new Date().toLocaleString()}</div>
                    </div>
                `;
            }
        }
    }
    
    startPeriodicStatusCheck() {
        // Initial check
        this.checkLLMStatus();
        
        // Periodic status checks every 5 minutes
        this.statusInterval = setInterval(() => {
            this.checkLLMStatus();
        }, 5 * 60 * 1000);
    }
    
    stopPeriodicStatusCheck() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    }
}

// Create and export singleton instance
const settingsManager = new SettingsManager();
export default settingsManager;