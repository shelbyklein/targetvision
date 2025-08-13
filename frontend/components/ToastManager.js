/**
 * ToastManager Component
 * 
 * Handles all toast notifications and messaging across the application.
 * Provides success, error, warning, and info notifications with animations.
 * 
 * Key Responsibilities:
 * - Toast creation and management
 * - Auto-dismiss functionality
 * - Toast animations and styling
 * - Queue management for multiple toasts
 * - Success and error message shortcuts
 */

import eventBus from '../services/EventBus.js';

class ToastManager {
    constructor() {
        this.toastQueue = [];
        this.maxToasts = 5; // Maximum number of toasts to show at once
        this.setupEventListeners();
        console.log('ToastManager initialized');
    }

    setupEventListeners() {
        // Toast events
        eventBus.on('toast:show', (data) => this.showToast(data.title, data.message, data.type, data.duration));
        eventBus.on('toast:remove', (data) => this.removeToast(data.toastId));
        eventBus.on('toast:success', (data) => this.showSuccessMessage(data.title, data.message));
        eventBus.on('toast:error', (data) => this.showErrorMessage(data.title, data.message, data.details));
        eventBus.on('toast:warning', (data) => this.showToast(data.title, data.message, 'warning', data.duration));
        eventBus.on('toast:info', (data) => this.showToast(data.title, data.message, 'info', data.duration));
        
        // Listen for feedback events from other components
        eventBus.on('feedback:show', (data) => this.showToast('Info', data.message, data.type || 'info', data.duration));
    }

    showToast(title, message, type = 'success', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        // Limit number of visible toasts
        const existingToasts = container.children;
        if (existingToasts.length >= this.maxToasts) {
            // Remove oldest toast
            const oldestToast = existingToasts[0];
            if (oldestToast) {
                this.removeToast(oldestToast.id);
            }
        }

        // Create toast element
        const toast = document.createElement('div');
        const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        toast.id = toastId;
        
        // Base classes for all toasts
        const baseClasses = 'transform transition-all duration-300 ease-in-out min-w-[400px] bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5';
        
        // Type-specific styling
        const typeStyles = {
            success: 'border-l-4 border-green-400',
            error: 'border-l-4 border-red-400',
            warning: 'border-l-4 border-yellow-400',
            info: 'border-l-4 border-blue-400'
        };
        
        const iconStyles = {
            success: '🎉',
            error: '❌',
            warning: '⚠️', 
            info: 'ℹ️'
        };
        
        toast.className = `${baseClasses} ${typeStyles[type] || typeStyles.success} translate-x-full opacity-0`;
        
        toast.innerHTML = `
            <div class="flex-1 w-0 p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <span class="text-lg">${iconStyles[type] || iconStyles.success}</span>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900">${this.escapeHtml(title)}</p>
                        <p class="mt-1 text-sm text-gray-500">${this.escapeHtml(message)}</p>
                    </div>
                </div>
            </div>
            <div class="flex border-l border-gray-200">
                <button class="toast-close-btn w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" 
                        onclick="modalManager.removeToast('${toastId}')">
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
        
        // Add close button handler
        const closeBtn = toast.querySelector('.toast-close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.removeToast(toastId);
        });
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        }, 50);
        
        // Add to queue for management
        this.toastQueue.push({
            id: toastId,
            element: toast,
            timestamp: Date.now(),
            duration: duration
        });
        
        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toastId);
            }, duration);
        }

        return toastId;
    }

    removeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            // Animate out
            toast.classList.remove('translate-x-0', 'opacity-100');
            toast.classList.add('translate-x-full', 'opacity-0');
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
                
                // Remove from queue
                this.toastQueue = this.toastQueue.filter(item => item.id !== toastId);
            }, 300);
        }
    }

    showSuccessMessage(title, message) {
        return this.showToast(title, message, 'success');
    }

    showErrorMessage(title, message, details = null) {
        const fullMessage = details ? `${message}\n\nDetails: ${details}` : message;
        return this.showToast(title, fullMessage, 'error', 0); // 0 duration means no auto-dismiss
    }

    showWarningMessage(title, message, duration = 5000) {
        return this.showToast(title, message, 'warning', duration);
    }

    showInfoMessage(title, message, duration = 4000) {
        return this.showToast(title, message, 'info', duration);
    }

    // Utility methods
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, (match) => map[match]);
    }

    // Clear all toasts
    clearAllToasts() {
        const container = document.getElementById('toast-container');
        if (container) {
            // Animate out all toasts
            Array.from(container.children).forEach(toast => {
                this.removeToast(toast.id);
            });
        }
        this.toastQueue = [];
    }

    // Get active toasts count
    getActiveToastsCount() {
        return this.toastQueue.length;
    }

    // Show toast with custom styling
    showCustomToast(options) {
        const {
            title,
            message,
            type = 'info',
            duration = 4000,
            icon = null,
            className = '',
            actions = []
        } = options;

        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        toast.id = toastId;

        // Build custom toast HTML
        const iconHtml = icon || this.getDefaultIcon(type);
        const actionsHtml = actions.map(action => 
            `<button class="toast-action-btn px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors" 
                     data-action="${action.id}">${action.label}</button>`
        ).join(' ');

        toast.className = `transform transition-all duration-300 ease-in-out min-w-[400px] bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 translate-x-full opacity-0 ${className}`;
        
        toast.innerHTML = `
            <div class="flex-1 w-0 p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <span class="text-lg">${iconHtml}</span>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900">${this.escapeHtml(title)}</p>
                        <p class="mt-1 text-sm text-gray-500">${this.escapeHtml(message)}</p>
                        ${actionsHtml ? `<div class="mt-2 space-x-2">${actionsHtml}</div>` : ''}
                    </div>
                </div>
            </div>
            <div class="flex border-l border-gray-200">
                <button class="toast-close-btn w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;

        // Add event handlers
        const closeBtn = toast.querySelector('.toast-close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.removeToast(toastId);
        });

        // Add action button handlers
        actions.forEach(action => {
            const actionBtn = toast.querySelector(`[data-action="${action.id}"]`);
            if (actionBtn && action.handler) {
                actionBtn.addEventListener('click', (e) => {
                    action.handler(e, toastId);
                });
            }
        });

        container.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        }, 50);

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toastId);
            }, duration);
        }

        return toastId;
    }

    getDefaultIcon(type) {
        const icons = {
            success: '🎉',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // Batch operations for multiple messages
    showMultipleToasts(toasts) {
        const toastIds = [];
        toasts.forEach((toastData, index) => {
            setTimeout(() => {
                const id = this.showToast(
                    toastData.title,
                    toastData.message,
                    toastData.type,
                    toastData.duration
                );
                toastIds.push(id);
            }, index * 100); // Stagger the toasts
        });
        return toastIds;
    }

    // Progress toast for long-running operations
    showProgressToast(title, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const toastId = 'progress-toast-' + Date.now();
        toast.id = toastId;

        toast.className = 'transform transition-all duration-300 ease-in-out min-w-[400px] bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-blue-400 translate-x-full opacity-0';
        
        toast.innerHTML = `
            <div class="flex-1 w-0 p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <div class="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900">${this.escapeHtml(title)}</p>
                        <p class="mt-1 text-sm text-gray-500">${this.escapeHtml(message)}</p>
                        <div class="mt-2">
                            <div class="bg-gray-200 rounded-full h-2">
                                <div id="${toastId}-progress" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        }, 50);

        return toastId;
    }

    updateProgressToast(toastId, progress, message = null) {
        const progressBar = document.getElementById(`${toastId}-progress`);
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }

        if (message) {
            const toast = document.getElementById(toastId);
            const messageElement = toast?.querySelector('.text-gray-500');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    }

    completeProgressToast(toastId, successTitle = 'Complete', successMessage = 'Operation completed successfully') {
        const toast = document.getElementById(toastId);
        if (toast) {
            // Update to success state
            toast.className = toast.className.replace('border-blue-400', 'border-green-400');
            
            const spinner = toast.querySelector('.animate-spin');
            if (spinner) {
                spinner.outerHTML = '<span class="text-lg">✅</span>';
            }

            const titleElement = toast.querySelector('.font-medium');
            const messageElement = toast.querySelector('.text-gray-500');
            
            if (titleElement) titleElement.textContent = successTitle;
            if (messageElement) messageElement.textContent = successMessage;

            // Hide progress bar
            const progressContainer = toast.querySelector('.bg-gray-200').parentElement;
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }

            // Auto-dismiss after success
            setTimeout(() => {
                this.removeToast(toastId);
            }, 3000);
        }
    }
}

// Create and export singleton instance
const toastManager = new ToastManager();
export default toastManager;