
import { SHADER_COMMON } from './common.glsl.js';

export const CROSSFADE_VARIANTS = {
    standard: {
        uniforms: {},
        fragment: `
            ${SHADER_COMMON}
            
            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                // Simple linear interpolation based on progress
                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    }
};

export default CROSSFADE_VARIANTS;
