
export class EventBus {
    constructor() {
        this._listeners = new Map();
        this._onceListeners = new Map();
    }

    on(event, callback, context = null) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }

        const handler = { callback, context };
        this._listeners.get(event).push(handler);

        return () => this.off(event, callback);
    }

    once(event, callback, context = null) {
        if (!this._onceListeners.has(event)) {
            this._onceListeners.set(event, []);
        }
        this._onceListeners.get(event).push({ callback, context });
    }

    emit(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            [...listeners].forEach(({ callback, context }) => {
                try { callback.call(context, data); } catch (e) { console.error(`[EventBus] Error in listener for '${event}':`, e); }
            });
        }

        const onceListeners = this._onceListeners.get(event);
        if (onceListeners) {
            [...onceListeners].forEach(({ callback, context }) => {
                try { callback.call(context, data); } catch (e) { console.error(`[EventBus] Error in once listener for '${event}':`, e); }
            });
            this._onceListeners.delete(event);
        }
    }

    off(event, callback) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            const index = listeners.findIndex(h => h.callback === callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
            if (listeners.length === 0) {
                this._listeners.delete(event);
            }
        }

        const onceList = this._onceListeners.get(event);
        if (onceList) {
            const index = onceList.findIndex(h => h.callback === callback);
            if (index !== -1) {
                onceList.splice(index, 1);
            }
            if (onceList.length === 0) {
                this._onceListeners.delete(event);
            }
        }
    }

    clear(event = null) {
        if (event) {
            this._listeners.delete(event);
            this._onceListeners.delete(event);
        } else {
            this._listeners.clear();
            this._onceListeners.clear();
        }
    }

    listenerCount(event = null) {
        if (event) {
            return (this._listeners.get(event)?.length || 0) +
                (this._onceListeners.get(event)?.length || 0);
        }
        let count = 0;
        this._listeners.forEach(l => count += l.length);
        this._onceListeners.forEach(l => count += l.length);
        return count;
    }
}

export const globalEventBus = new EventBus();
