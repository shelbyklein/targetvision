import { CSS_CLASSES } from './Constants.js';

export class UIUtils {
    static createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.id) {
            element.id = options.id;
        }
        
        if (options.textContent) {
            element.textContent = options.textContent;
        }
        
        if (options.innerHTML) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        if (options.styles) {
            Object.entries(options.styles).forEach(([key, value]) => {
                element.style[key] = value;
            });
        }
        
        if (options.events) {
            Object.entries(options.events).forEach(([event, handler]) => {
                element.addEventListener(event, handler);
            });
        }
        
        if (options.parent) {
            options.parent.appendChild(element);
        }
        
        return element;
    }

    static addClass(element, className) {
        if (element && className) {
            element.classList.add(...className.split(' ').filter(c => c.trim()));
        }
        return element;
    }

    static removeClass(element, className) {
        if (element && className) {
            element.classList.remove(...className.split(' ').filter(c => c.trim()));
        }
        return element;
    }

    static toggleClass(element, className, force = null) {
        if (element && className) {
            const classes = className.split(' ').filter(c => c.trim());
            classes.forEach(cls => {
                if (force !== null) {
                    element.classList.toggle(cls, force);
                } else {
                    element.classList.toggle(cls);
                }
            });
        }
        return element;
    }

    static hasClass(element, className) {
        if (!element || !className) return false;
        return className.split(' ').every(cls => 
            cls.trim() ? element.classList.contains(cls.trim()) : true
        );
    }

    static show(element) {
        return this.removeClass(element, CSS_CLASSES.HIDDEN);
    }

    static hide(element) {
        return this.addClass(element, CSS_CLASSES.HIDDEN);
    }

    static setVisible(element, visible) {
        return visible ? this.show(element) : this.hide(element);
    }

    static setLoading(element, loading = true) {
        return this.toggleClass(element, CSS_CLASSES.LOADING, loading);
    }

    static setSelected(element, selected = true) {
        return this.toggleClass(element, CSS_CLASSES.SELECTED, selected);
    }

    static setError(element, error = true) {
        return this.toggleClass(element, CSS_CLASSES.ERROR, error);
    }

    static setSuccess(element, success = true) {
        return this.toggleClass(element, CSS_CLASSES.SUCCESS, success);
    }

    static empty(element) {
        if (element) {
            element.innerHTML = '';
        }
        return element;
    }

    static removeAllChildren(element) {
        if (element) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }
        return element;
    }

    static getFormData(formElement) {
        if (!formElement) return {};
        
        const formData = new FormData(formElement);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        return data;
    }

    static setFormData(formElement, data) {
        if (!formElement || !data) return;
        
        Object.entries(data).forEach(([key, value]) => {
            const element = formElement.elements[key];
            if (element) {
                if (element.type === 'checkbox' || element.type === 'radio') {
                    element.checked = Boolean(value);
                } else {
                    element.value = value || '';
                }
            }
        });
    }

    static scrollIntoView(element, options = {}) {
        if (element && element.scrollIntoView) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest',
                ...options
            });
        }
        return element;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    static formatDate(date, options = {}) {
        if (!date) return '';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        
        if (isNaN(dateObj.getTime())) return '';
        
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...options
        });
    }

    static formatTime(date, options = {}) {
        if (!date) return '';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        
        if (isNaN(dateObj.getTime())) return '';
        
        return dateObj.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            ...options
        });
    }

    static formatDateTime(date, options = {}) {
        const dateStr = this.formatDate(date, options.dateOptions);
        const timeStr = this.formatTime(date, options.timeOptions);
        return dateStr && timeStr ? `${dateStr} ${timeStr}` : dateStr || timeStr;
    }

    static truncateText(text, maxLength = 100, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static unescapeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText;
    }

    static copyToClipboard(text) {
        return navigator.clipboard ? 
            navigator.clipboard.writeText(text) :
            this.fallbackCopyToClipboard(text);
    }

    static fallbackCopyToClipboard(text) {
        return new Promise((resolve, reject) => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('Copy command failed'));
                }
            } catch (err) {
                document.body.removeChild(textArea);
                reject(err);
            }
        });
    }

    static isInViewport(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    static getElementOffset(element) {
        if (!element) return { top: 0, left: 0 };
        
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top + window.pageYOffset,
            left: rect.left + window.pageXOffset
        };
    }
}

export default UIUtils;