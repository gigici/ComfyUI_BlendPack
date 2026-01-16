
export class LifecycleManager {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this._intervals = [];
        this._timeouts = [];
        this._animFrames = [];
        this._disposables = [];
        this._eventUnsubscribers = [];
        this._disposed = false;
    }

    setInterval(fn, ms) {
        if (this._disposed) {
            return -1;
        }
        const id = window.setInterval(fn, ms);
        this._intervals.push(id);
        return id;
    }

    setTimeout(fn, ms) {
        if (this._disposed) {
            return -1;
        }
        const id = window.setTimeout(() => {

            const index = this._timeouts.indexOf(id);
            if (index !== -1) this._timeouts.splice(index, 1);
            fn();
        }, ms);
        this._timeouts.push(id);
        return id;
    }

    requestAnimationFrame(fn) {
        if (this._disposed) {
            return -1;
        }
        const id = window.requestAnimationFrame((timestamp) => {

            const index = this._animFrames.indexOf(id);
            if (index !== -1) this._animFrames.splice(index, 1);
            fn(timestamp);
        });
        this._animFrames.push(id);
        return id;
    }

    clearInterval(id) {
        window.clearInterval(id);
        const index = this._intervals.indexOf(id);
        if (index !== -1) this._intervals.splice(index, 1);
    }

    clearTimeout(id) {
        window.clearTimeout(id);
        const index = this._timeouts.indexOf(id);
        if (index !== -1) this._timeouts.splice(index, 1);
    }

    cancelAnimationFrame(id) {
        window.cancelAnimationFrame(id);
        const index = this._animFrames.indexOf(id);
        if (index !== -1) this._animFrames.splice(index, 1);
    }

    addDisposable(obj) {
        if (this._disposed) {
            return;
        }
        if (obj && typeof obj.dispose === 'function') {
            this._disposables.push(obj);
        }
    }

    addEventUnsubscriber(unsubscribe) {
        if (this._disposed) {
            return;
        }
        if (typeof unsubscribe === 'function') {
            this._eventUnsubscribers.push(unsubscribe);
        }
    }

    /**
     * Check if this manager has been disposed
     * @returns {boolean}
     */
    isDisposed() {
        return this._disposed;
    }

    dispose() {
        if (this._disposed) {
            return;
        }

        this._disposed = true;

        this._intervals.forEach(id => window.clearInterval(id));
        this._intervals = [];

        this._timeouts.forEach(id => window.clearTimeout(id));
        this._timeouts = [];

        this._animFrames.forEach(id => window.cancelAnimationFrame(id));
        this._animFrames = [];

        this._eventUnsubscribers.forEach(unsubscribe => {
            try { unsubscribe(); } catch (e) { console.error('[LifecycleManager] Error unsubscribing:', e); }
        });
        this._eventUnsubscribers = [];

        this._disposables.forEach(obj => {
            try { obj.dispose(); } catch (e) { console.error('[LifecycleManager] Error disposing object:', e); }
        });
        this._disposables = [];
    }

    /**
     * Get statistics for debugging
     */
    getStats() {
        return {
            nodeId: this.nodeId,
            disposed: this._disposed,
            intervals: this._intervals.length,
            timeouts: this._timeouts.length,
            animFrames: this._animFrames.length,
            disposables: this._disposables.length,
            eventUnsubscribers: this._eventUnsubscribers.length
        };
    }
}
