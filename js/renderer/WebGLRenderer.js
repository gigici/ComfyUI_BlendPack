import { ShaderCompiler } from './ShaderCompiler.js';
import { TextureManager } from './TextureManager.js';
import { CROSSFADE_SHADER } from '../engine/shaders/common.glsl.js';

export class WebGLRenderer {
    constructor(width = 512, height = 288) {
        this.width = width;
        this.height = height;
        this.supported = false;

        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;

        this.gl = this._initContext();
        if (!this.gl) {
            console.error('[WebGLRenderer] WebGL not supported');
            return;
        }

        this.supported = true;
        this.shaderCompiler = new ShaderCompiler(this.gl);
        this.textureManager = new TextureManager(this.gl);

        this.currentProgram = null;
        this.currentEngine = null;
        this.currentVariant = null;
        this.startTime = Date.now();

        this._initGeometry();

        this.shaderCompiler.compileProgram('crossfade', CROSSFADE_SHADER);
        this.currentProgram = this.shaderCompiler.getProgram('crossfade');
    }

    _initContext() {
        const options = {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        };

        // Try WebGL2 first (more capable), then fall back to WebGL1
        let gl = this.canvas.getContext('webgl2', options);
        if (!gl) {
            gl = this.canvas.getContext('webgl', options);
        }
        if (!gl) {
            gl = this.canvas.getContext('experimental-webgl', options);
        }

        return gl;
    }

    _initGeometry() {
        const gl = this.gl;
        const vertices = new Float32Array([
            -1, -1, 0, 1,
            1, -1, 1, 1,
            -1, 1, 0, 0,
            1, 1, 1, 0
        ]);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    setImages(imageA, imageB) {
        if (!this.supported) return;

        if (imageA) {
            this.textureManager.setTexture('A', imageA);
        }
        if (imageB) {
            this.textureManager.setTexture('B', imageB);
        }
    }

    updateImage(which, source) {
        if (!this.supported) return;

        if (this.textureManager.hasTexture(which)) {
            this.textureManager.updateTexture(which, source);
        } else {
            this.textureManager.setTexture(which, source);
        }
    }

    setShader(shaderName) {
        if (!this.supported) return false;

        const program = this.shaderCompiler.getProgram(shaderName);
        if (program) {
            this.currentProgram = program;
            return true;
        }

        console.warn(`[WebGLRenderer] Shader "${shaderName}" not found, using fallback`);
        this.currentProgram = this.shaderCompiler.getProgram('crossfade');
        return false;
    }

    compileAndSetShader(name, fragmentSource) {
        if (!this.supported) return false;

        const program = this.shaderCompiler.compileProgram(name, fragmentSource);
        if (program) {
            this.currentProgram = program;
            this.currentEngine = name.split('_')[0];
            this.currentVariant = name;
            return true;
        }

        return false;
    }

    render(progress, intensity = 1.0, uniforms = {}) {
        if (!this.supported || !this.currentProgram) return;

        const gl = this.gl;
        const program = this.currentProgram;

        const hasA = this.textureManager.hasTexture('A');
        const hasB = this.textureManager.hasTexture('B');
        if (!hasA && !hasB) return;

        let texA = hasA ? 'A' : 'B';
        let texB = hasB ? 'B' : 'A';

        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        if (program.attributes.aPosition >= 0) {
            gl.enableVertexAttribArray(program.attributes.aPosition);
            gl.vertexAttribPointer(program.attributes.aPosition, 2, gl.FLOAT, false, 16, 0);
        }
        if (program.attributes.aTexCoord >= 0) {
            gl.enableVertexAttribArray(program.attributes.aTexCoord);
            gl.vertexAttribPointer(program.attributes.aTexCoord, 2, gl.FLOAT, false, 16, 8);
        }

        this.textureManager.bindTexture(texA, 0);
        this.textureManager.bindTexture(texB, 1);

        this._setUniform(program, 'uTexA', 0);
        this._setUniform(program, 'uTexB', 1);
        this._setUniform(program, 'uProgress', progress);
        this._setUniform(program, 'uIntensity', intensity);
        this._setUniform(program, 'uTime', (Date.now() - this.startTime) / 1000.0);
        this._setUniform(program, 'uResolution', [this.width, this.height]);

        for (const [name, value] of Object.entries(uniforms)) {
            this._setUniform(program, name, value);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    _setUniform(program, name, value) {
        const gl = this.gl;
        const loc = program.uniforms[name];

        if (loc === undefined || loc === null) return;

        if (name === 'uTexA' || name === 'uTexB') {
            gl.uniform1i(loc, Math.floor(value));
            return;
        }

        if (typeof value === 'number') {
            gl.uniform1f(loc, value);
        } else if (typeof value === 'boolean') {
            gl.uniform1i(loc, value ? 1 : 0);
        } else if (Array.isArray(value)) {
            switch (value.length) {
                case 2:
                    gl.uniform2f(loc, value[0], value[1]);
                    break;
                case 3:
                    gl.uniform3f(loc, value[0], value[1], value[2]);
                    break;
                case 4:
                    gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
                    break;
            }
        }
    }

    getCanvas() {
        return this.canvas;
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }

    getPixels() {
        if (!this.supported) return null;

        const gl = this.gl;
        const pixels = new Uint8Array(this.width * this.height * 4);
        gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
    }

    toDataURL(type = 'image/png', quality = 0.9) {
        return this.canvas.toDataURL(type, quality);
    }

    isSupported() {
        return this.supported;
    }

    getStats() {
        return {
            supported: this.supported,
            width: this.width,
            height: this.height,
            currentProgram: this.currentVariant || 'crossfade',
            shaders: this.shaderCompiler?.getStats() || {},
            textures: this.textureManager?.getStats() || {}
        };
    }

    dispose() {
        if (!this.gl) return;

        const gl = this.gl;

        this.shaderCompiler?.dispose();
        this.textureManager?.dispose();

        if (this.vertexBuffer) {
            gl.deleteBuffer(this.vertexBuffer);
        }

        const loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) {
            loseContext.loseContext();
        }

        this.gl = null;
        this.supported = false;
        this.currentProgram = null;
    }
}
