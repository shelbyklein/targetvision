class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        this.events.get(eventName).push(callback);
        
        return () => this.off(eventName, callback);
    }

    off(eventName, callback) {
        if (!this.events.has(eventName)) return;
        
        const callbacks = this.events.get(eventName);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
        
        if (callbacks.length === 0) {
            this.events.delete(eventName);
        }
    }

    emit(eventName, data = null) {
        if (!this.events.has(eventName)) return;
        
        this.events.get(eventName).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for "${eventName}":`, error);
            }
        });
    }

    once(eventName, callback) {
        const unsubscribe = this.on(eventName, (data) => {
            callback(data);
            unsubscribe();
        });
        return unsubscribe;
    }

    clear(eventName = null) {
        if (eventName) {
            this.events.delete(eventName);
        } else {
            this.events.clear();
        }
    }

    listEvents() {
        return Array.from(this.events.keys());
    }

    listenerCount(eventName) {
        return this.events.has(eventName) ? this.events.get(eventName).length : 0;
    }
}

const eventBus = new EventBus();
export default eventBus;