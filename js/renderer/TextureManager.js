
export class TextureManager {
    constructor(gl) {
        this.gl = gl;
        this.textures = new Map();
        this.pool = [];
        this.maxPoolSize = 10;
    }

    setTexture(id, source) {
        const gl = this.gl;
        if (!gl) return null;

        if (!this._isValidSource(source)) return null;

        let texture = this.textures.get(id);
        if (!texture) {
            texture = this._getFromPool() || gl.createTexture();
            this.textures.set(id, texture);
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

        texture._width = source.videoWidth || source.width || 0;
        texture._height = source.videoHeight || source.height || 0;

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return texture;
    }

    getTexture(id) {
        return this.textures.get(id) || null;
    }

    hasTexture(id) {
        return this.textures.has(id);
    }

    deleteTexture(id) {
        const texture = this.textures.get(id);
        if (texture) {
            this._returnToPool(texture);
            this.textures.delete(id);
        }
    }

    bindTexture(id, unit = 0) {
        const gl = this.gl;
        const texture = this.textures.get(id);

        if (!texture) {
            console.warn(`[TextureManager] Texture "${id}" not found`);
            return false;
        }

        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return true;
    }

    updateTexture(id, source) {
        const gl = this.gl;
        const texture = this.textures.get(id);
        if (!texture || !this._isValidSource(source)) return false;

        const width = source.videoWidth || source.width || 0;
        const height = source.videoHeight || source.height || 0;

        gl.bindTexture(gl.TEXTURE_2D, texture);

        if (texture._width === width && texture._height === height) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            texture._width = width;
            texture._height = height;
        }

        return true;
    }

    createEmptyTexture(id, width, height) {
        const gl = this.gl;

        let texture = this.textures.get(id);
        if (!texture) {
            texture = this._getFromPool() || gl.createTexture();
            this.textures.set(id, texture);
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return texture;
    }

    _getFromPool() {
        return this.pool.pop() || null;
    }

    _returnToPool(texture) {
        if (this.pool.length < this.maxPoolSize) {
            this.pool.push(texture);
        } else {
            this.gl.deleteTexture(texture);
        }
    }

    _isValidSource(source) {
        if (!source) return false;

        const isImage = source instanceof HTMLImageElement;
        const isCanvas = source instanceof HTMLCanvasElement;
        const isVideo = source instanceof HTMLVideoElement;

        if (!isImage && !isCanvas && !isVideo) return false;

        if (isImage) {
            return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0;
        }
        if (isVideo) {
            return source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0;
        }
        if (isCanvas) {
            return source.width > 0 && source.height > 0;
        }

        return false;
    }

    getStats() {
        return {
            activeTextures: this.textures.size,
            pooledTextures: this.pool.length,
            maxPoolSize: this.maxPoolSize
        };
    }

    clear() {
        const gl = this.gl;

        for (const texture of this.textures.values()) {
            gl.deleteTexture(texture);
        }
        this.textures.clear();

        for (const texture of this.pool) {
            gl.deleteTexture(texture);
        }
        this.pool = [];
    }

    dispose() {
        this.clear();
        this.gl = null;
    }
}
