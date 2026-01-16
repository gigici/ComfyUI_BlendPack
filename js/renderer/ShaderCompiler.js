

import { VERTEX_SHADER } from '../engine/shaders/common.glsl.js';

export class ShaderCompiler {
    constructor(gl) {
        this.gl = gl;
        this.programs = new Map();
        this.shaderCache = new Map();
    }

    compileProgram(name, fragmentSource, vertexSource = VERTEX_SHADER) {
        if (this.programs.has(name)) return this.programs.get(name);

        const gl = this.gl;
        const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexSource, `${name}_vert`);
        if (!vertexShader) return null;

        const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource, `${name}_frag`);
        if (!fragmentShader) {
            gl.deleteShader(vertexShader);
            return null;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(`[ShaderCompiler] Link error "${name}":`, gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return null;
        }

        program.attributes = {
            aPosition: gl.getAttribLocation(program, 'aPosition'),
            aTexCoord: gl.getAttribLocation(program, 'aTexCoord')
        };
        program.uniforms = this._getUniformLocations(program);

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        this.programs.set(name, program);
        return program;
    }

    getProgram(name) {
        return this.programs.get(name) || null;
    }

    hasProgram(name) {
        return this.programs.has(name);
    }

    deleteProgram(name) {
        const program = this.programs.get(name);
        if (program) {
            this.gl.deleteProgram(program);
            this.programs.delete(name);
        }
    }

    _compileShader(type, source, name) {
        const gl = this.gl;

        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            console.error(`[ShaderCompiler] Compile error in "${name}":`, error);

            this._logShaderError(source, error);

            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    _getUniformLocations(program) {
        const gl = this.gl;
        const uniforms = {};

        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const info = gl.getActiveUniform(program, i);
            if (info) {
                uniforms[info.name] = gl.getUniformLocation(program, info.name);
            }
        }

        return uniforms;
    }

    _hashSource(source) {
        let hash = 0;
        for (let i = 0; i < source.length; i++) {
            const char = source.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    _logShaderError(source, error) {
        const lineMatch = error.match(/ERROR: \d+:(\d+):/);
        const errorLine = lineMatch ? parseInt(lineMatch[1], 10) : -1;

        const lines = source.split('\n');
        const start = Math.max(0, errorLine - 3);
        const end = Math.min(lines.length, errorLine + 3);

        for (let i = start; i < end; i++) {
            const marker = (i + 1 === errorLine) ? '>>>' : '   ';
            console.log(`${marker} ${(i + 1).toString().padStart(4)}: ${lines[i]}`);
        }
    }

    getStats() {
        return {
            compiledPrograms: this.programs.size,
            programNames: Array.from(this.programs.keys())
        };
    }

    clear() {
        const gl = this.gl;
        for (const program of this.programs.values()) {
            gl.deleteProgram(program);
        }
        this.programs.clear();
        this.shaderCache.clear();
    }

    dispose() {
        this.clear();
        this.gl = null;
    }
}
