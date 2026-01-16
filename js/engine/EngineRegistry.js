import { SHADER_COMMON } from './shaders/common.glsl.js';

class EngineRegistryClass {
    constructor() {
        this._engines = new Map();
        this._shaders = new Map();
        this._variantMap = new Map();
    }

    registerEngine(engineName, variants) {
        this._engines.set(engineName, {
            name: engineName,
            variants: Object.keys(variants)
        });

        this._variantMap.set(engineName, variants);

        for (const [variantName, variantDef] of Object.entries(variants)) {
            const shaderKey = `${engineName}_${variantName}`;
            this._shaders.set(shaderKey, {
                engine: engineName,
                variant: variantName,
                fragment: variantDef.fragment || variantDef,
                uniforms: variantDef.uniforms || {},
                description: variantDef.description || ""
            });
        }
    }

    getVariantDescription(engineName, variantName) {
        const shaderKey = `${engineName}_${variantName}`;
        const shader = this._shaders.get(shaderKey);
        return shader ? shader.description : "";
    }

    getEngines() {
        return Array.from(this._engines.keys());
    }

    getVariants(engineName) {
        const engine = this._engines.get(engineName);
        return engine ? engine.variants : [];
    }

    getShader(engineName, variantName) {
        const shaderKey = `${engineName}_${variantName}`;
        return this._shaders.get(shaderKey) || null;
    }

    getShaderSource(engineName, variantName) {
        const shader = this.getShader(engineName, variantName);
        if (!shader) return null;
        return shader.fragment;
    }

    getUniforms(engineName, variantName) {
        const shader = this.getShader(engineName, variantName);
        return shader?.uniforms || {};
    }

    hasEngine(engineName) {
        return this._engines.has(engineName);
    }

    hasVariant(engineName, variantName) {
        const shaderKey = `${engineName}_${variantName}`;
        return this._shaders.has(shaderKey);
    }

    getStats() {
        let totalVariants = 0;
        for (const engine of this._engines.values()) {
            totalVariants += engine.variants.length;
        }

        return {
            engineCount: this._engines.size,
            totalVariants,
            engines: this.getEngines()
        };
    }

    clear() {
        this._engines.clear();
        this._shaders.clear();
        this._variantMap.clear();
    }
}

export const EngineRegistry = new EngineRegistryClass();

export function createShader(mainBody) {
    return `${SHADER_COMMON}\n\nvoid main() {\n${mainBody}\n}`;
}

export function createShaderWithUniforms(customUniforms, mainBody) {
    return `${SHADER_COMMON}\n${customUniforms}\n\nvoid main() {\n${mainBody}\n}`;
}
