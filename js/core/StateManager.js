
export class StateManager {
    constructor(initialState = {}) {
        this._state = { ...initialState };
        this._listeners = new Map();
        this._dirty = new Set();
        this._batchUpdates = false;
        this._pendingNotifications = new Set();
    }

    get(key) {
        return this._state[key];
    }

    set(key, value, silent = false) {
        const oldValue = this._state[key];

        if (this._deepEqual(oldValue, value)) return;

        this._state[key] = value;
        this._dirty.add(key);

        if (!silent) {
            if (this._batchUpdates) {
                this._pendingNotifications.add(key);
            } else {
                this._notifyListeners(key, value, oldValue);
            }
        }
    }

    update(updates) {
        this._batchUpdates = true;

        for (const [key, value] of Object.entries(updates)) {
            this.set(key, value);
        }

        this._batchUpdates = false;

        for (const key of this._pendingNotifications) {
            this._notifyListeners(key, this._state[key]);
        }
        this._pendingNotifications.clear();
    }

    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }
        this._listeners.get(key).push(callback);

        return () => {
            const listeners = this._listeners.get(key);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index !== -1) listeners.splice(index, 1);
            }
        };
    }

    subscribeAll(callback) {
        return this.subscribe('*', callback);
    }

    getSnapshot() {
        return { ...this._state };
    }

    isDirty(key = null) {
        if (key) {
            return this._dirty.has(key);
        }
        return this._dirty.size > 0;
    }

    clearDirty(key = null) {
        if (key) {
            this._dirty.delete(key);
        } else {
            this._dirty.clear();
        }
    }

    /**
     * Get all dirty keys
     * @returns {string[]}
     */
    getDirtyKeys() {
        return Array.from(this._dirty);
    }

    reset(initialState = {}) {
        const oldState = this._state;
        this._state = { ...initialState };
        this._dirty.clear();

        for (const key of Object.keys(oldState)) {
            if (this._listeners.has(key)) {
                this._notifyListeners(key, this._state[key], oldState[key]);
            }
        }
    }

    toJSON() {
        return JSON.stringify(this._state);
    }

    fromJSON(json) {
        try {
            const parsed = JSON.parse(json);
            this.update(parsed);
        } catch (e) {
            console.error('[StateManager] Failed to parse JSON:', e);
        }
    }

    _notifyListeners(key, newValue, oldValue) {
        const listeners = this._listeners.get(key);
        if (listeners) {
            [...listeners].forEach(callback => {
                try { callback(newValue, oldValue); } catch (e) { console.error('[StateManager] Error in listener:', e); }
            });
        }

        const allListeners = this._listeners.get('*');
        if (allListeners) {
            [...allListeners].forEach(callback => {
                try { callback(key, newValue, oldValue); } catch (e) { console.error('[StateManager] Error in global listener:', e); }
            });
        }
    }

    _deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;

        if (Array.isArray(a)) {
            if (!Array.isArray(b) || a.length !== b.length) return false;
            return a.every((val, i) => this._deepEqual(val, b[i]));
        }

        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length) return false;
            return keysA.every(key => this._deepEqual(a[key], b[key]));
        }

        return false;
    }

    dispose() {
        this._listeners.clear();
        this._dirty.clear();
        this._pendingNotifications.clear();
        this._state = {};
    }
}
