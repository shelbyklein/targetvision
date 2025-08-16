/**
 * ChatManager Component
 * 
 * Handles all chat functionality across the application including message handling,
 * conversation management, photo search query detection, and chat UI operations.
 * 
 * Key Responsibilities:
 * - Chat message sending and display
 * - Photo search query detection and routing
 * - General conversation handling with help responses
 * - Photo results display in chat interface
 * - Chat history management and clearing
 * - Chat page initialization
 */

import eventBus from '../services/EventBus.js';

class ChatManager {
    constructor() {
        this.chatMessages = [];
        
        this.setupEventListeners();
        // Component initialized
    }

    setupEventListeners() {
        // Chat events
        eventBus.on('chat:send-message', () => this.sendChatMessage());
        eventBus.on('chat:clear', () => this.clearChat());
        eventBus.on('chat:add-message', (data) => this.addChatMessage(data.type, data.message));
        eventBus.on('chat:add-photo-results', (data) => this.addPhotoResults(data.photos));
        
        // Page initialization
        eventBus.on('chat:initialize-page', () => this.initializeChatPage());
        
        // Photo modal events
        eventBus.on('chat:show-photo-modal', (data) => {
            // data.photo should already be the photo object
            eventBus.emit('photo:show-modal', { photo: data.photo });
        });
        
    }

    bindDOMEventListeners() {
        // Chat functionality DOM events
        const chatSendButton = document.getElementById('chat-send');
        const chatInput = document.getElementById('chat-input');
        const clearChatButton = document.getElementById('clear-chat');

        console.log('ChatManager bindDOMEventListeners:', {
            chatSendButton: !!chatSendButton,
            chatInput: !!chatInput,
            clearChatButton: !!clearChatButton
        });

        if (chatSendButton) {
            chatSendButton.addEventListener('click', () => {
                console.log('Chat send button clicked');
                this.sendChatMessage();
            });
        } else {
            console.warn('Chat send button not found');
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('Chat input Enter pressed');
                    this.sendChatMessage();
                }
            });
            
            chatInput.addEventListener('input', (e) => {
                const chatSendBtn = document.getElementById('chat-send');
                if (chatSendBtn) {
                    chatSendBtn.disabled = !e.target.value.trim();
                }
            });
        } else {
            console.warn('Chat input not found');
        }

        if (clearChatButton) {
            clearChatButton.addEventListener('click', () => this.clearChat());
        } else {
            console.warn('Clear chat button not found');
        }
    }

    // Chat Page Initialization
    initializeChatPage() {
        // Chat page is ready by default with welcome message
        // Component initialized
        
        // Bind DOM event listeners now that the page is loaded
        this.bindDOMEventListeners();
    }

    // Chat Functionality
    async sendChatMessage() {
        console.log('sendChatMessage called');
        
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        console.log('Chat message:', message, 'input element:', !!input);
        
        if (!message) {
            console.log('No message provided, returning');
            return;
        }
        
        // Add user message to UI
        this.addChatMessage('user', message);
        input.value = '';
        document.getElementById('chat-send').disabled = true;
        
        try {
            // Check if this is a photo search query
            if (this.isPhotoSearchQuery(message)) {
                eventBus.emit('search:chat:handle', { message: message });
            } else {
                // Handle general conversation
                await this.handleGeneralChat(message);
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addChatMessage('system', 'Sorry, there was an error processing your message. Please try again.');
        }
    }
    
    isPhotoSearchQuery(message) {
        const searchKeywords = ['find', 'show', 'search', 'look', 'photos', 'images', 'pictures', 'with', 'containing', 'have'];
        const lowerMessage = message.toLowerCase();
        return searchKeywords.some(keyword => lowerMessage.includes(keyword));
    }
    
    async handleGeneralChat(message) {
        // Handle general conversation about the app, photos, etc.
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
            this.addChatMessage('system', `I can help you find photos in your SmugMug collection! Here's what you can ask me:

📸 **Photo Search:**
• "Find photos with medals"
• "Show me archery competition images"  
• "Look for photos containing awards"

🔧 **Getting Started:**
• Go to the Albums page to sync your SmugMug photos
• Use "Sync Album" to add photos to the database
• Process photos with AI to enable smart search

Try asking me to find something specific in your photos!`);
        } else if (lowerMessage.includes('sync') || lowerMessage.includes('album')) {
            this.addChatMessage('system', `To search photos, you'll need to sync them first:

1. Go to the **Albums** page
2. Select an album from your SmugMug account
3. Click **"Sync Album"** to add photos to the database
4. Select photos and click **"Process Selected"** to analyze them with AI

Once photos are processed, you can search them by asking me things like "Find photos with trophies" or "Show me competition images".`);
        } else if (lowerMessage.includes('process') || lowerMessage.includes('ai')) {
            this.addChatMessage('system', `AI processing analyzes your photos to understand their content:

🤖 **What AI Processing Does:**
• Generates detailed descriptions of what's in each photo
• Extracts keywords for better searchability
• Enables content-based search (find photos by what's actually in them)

💡 **How to Process Photos:**
• Sync an album first
• Select photos you want to analyze  
• Click "Process Selected" to run AI analysis
• Or use the lightbox button on individual photos

Once processed, I can find your photos based on their actual content!`);
        } else {
            this.addChatMessage('system', `I'm here to help you find photos in your SmugMug collection! 

Try asking me things like:
• "Find photos with medals"
• "Show me archery images"
• "Look for competition photos"

You can also ask for help with syncing albums or processing photos with AI. What would you like to find?`);
        }
    }
    
    addChatMessage(sender, message) {
        const messagesContainer = document.getElementById('chat-messages');
        
        // Remove welcome state if it exists
        const welcomeState = messagesContainer.querySelector('.flex.flex-col.items-center.justify-center');
        if (welcomeState) {
            welcomeState.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        
        const bubbleClass = sender === 'user' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 text-gray-900';
            
        messageDiv.innerHTML = `
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${bubbleClass}">
                <p class="text-sm">${message}</p>
                <p class="text-xs mt-1 opacity-70">${new Date().toLocaleTimeString()}</p>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.chatMessages.push({ sender, message, timestamp: new Date() });
    }
    
    addPhotoResults(photos) {
        const messagesContainer = document.getElementById('chat-messages');
        
        // Remove welcome state if it exists
        const welcomeState = messagesContainer.querySelector('.flex.flex-col.items-center.justify-center');
        if (welcomeState) {
            welcomeState.remove();
        }
        
        const photoResultsDiv = document.createElement('div');
        photoResultsDiv.className = 'flex justify-start mb-4';
        
        photoResultsDiv.innerHTML = `
            <div class="max-w-4xl">
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
                    ${photos.map(photo => {
                        // Ensure we extract the actual photo object from search results
                        // Search results have structure: {photo: actualPhoto, score: ...}
                        const photoData = photo.photo || photo;
                        const score = photo.score ? Math.round(photo.score * 100) : 0;
                        
                        // Validate that we have a proper photo object with id and smugmug_id
                        if (!photoData.id && !photoData.smugmug_id) {
                            console.warn('ChatManager: Invalid photo data structure:', photoData);
                            return ''; // Skip invalid photos
                        }
                        
                        return `
                            <div class="chat-photo-result relative group" 
                                 data-photo='${JSON.stringify(photoData).replace(/'/g, '&apos;')}'>
                                <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative cursor-pointer"
                                     onclick="eventBus.emit('chat:show-photo-modal', { photo: JSON.parse(this.closest('.chat-photo-result').dataset.photo.replace(/&apos;/g, '\\'')) });">
                                    <img 
                                        src="${photoData.thumbnail_url}" 
                                        alt="${photoData.title || photoData.filename || 'Photo'}"
                                        class="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    
                                    <!-- Relevance score -->
                                    ${score > 0 ? `
                                        <div class="absolute top-1 right-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                                            ${score}%
                                        </div>
                                    ` : ''}
                                    
                                    <!-- Hover overlay -->
                                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center pointer-events-none">
                                        <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Enhanced photo info -->
                                <div class="mt-1">
                                    ${photoData.folder_path && photoData.album_name ? 
                                        `<p class="text-xs text-gray-500 truncate">${photoData.folder_path} / ${photoData.album_name}</p>` :
                                        photoData.album_name ? 
                                        `<p class="text-xs text-gray-500 truncate">${photoData.album_name}</p>` : 
                                        ''
                                    }
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <p class="text-xs text-gray-500 mt-2 px-2">Click photos to view details • Hover and click + to add to collections</p>
            </div>
        `;
        
        messagesContainer.appendChild(photoResultsDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    clearChat() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-500">
                <svg class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Start a Conversation</h3>
                <p class="text-center max-w-md mb-4">Ask me anything about your SmugMug photos! I can help you find specific images, understand their content, or answer questions about your collection.</p>
                <div class="text-sm text-gray-500 space-y-1">
                    <p><strong>Try asking:</strong></p>
                    <p>"Show me photos with medals"</p>
                    <p>"Find archery competition images"</p>
                    <p>"What photos have been processed with AI?"</p>
                </div>
            </div>
        `;
        this.chatMessages = [];
    }

    // Collection Management for Chat Results
    openPhotoForCollections(photo) {
        // Open the photo modal and automatically show the collections interface
        eventBus.emit('photo:show-modal', { 
            photo: photo,
            showCollections: true  // Signal to auto-open collections interface
        });
    }

    // Utility methods for accessing chat data
    getChatMessages() {
        return this.chatMessages;
    }
}

// Create and export singleton instance
const chatManager = new ChatManager();

// Make available globally for inline event handlers
window.chatManager = chatManager;

export default chatManager;