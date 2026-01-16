// NOTE: Keep format. Parsed by Python regex.
/**
 * Pixelate Engine - Pixel/retro-style transitions
 * 
 * TRANSITION LOGIC:
 * - t=0: Clip A shown at full resolution (no pixelation)
 * - t=0.5: Maximum pixelation effect
 * - t=1: Clip B shown at full resolution (no pixelation)
 * - effectStrength = sin(t * PI) creates 0→1→0 curve
 */

import { SHADER_COMMON } from './common.glsl.js';

export const PIXELATE_VARIANTS = {
    pixelate_block: {
        uniforms: { uMinBlocks: 10.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uMinBlocks;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Resolution: high at t=0/1, low at t=0.5
                // At effectStrength=0, size=1000 (near-full res)
                // At effectStrength=1, size=uMinBlocks (pixelated)
                float size = mix(1000.0, uMinBlocks, effectStrength);
                
                vec2 pixelUv = floor(vUv * size) / size;
                
                vec4 colorA = texture2D(uTexA, pixelUv);
                vec4 colorB = texture2D(uTexB, pixelUv);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    pixelate_dither: {
        uniforms: { uDitherStrength: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uDitherStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Resolution scales with effectStrength
                float resolution = mix(1.0, 0.05, effectStrength * uDitherStrength);
                vec2 ditherUv = floor(vUv * uResolution * resolution) / (uResolution * resolution);
                
                float n = hash(ditherUv + t);
                
                vec4 colorA = texture2D(uTexA, ditherUv);
                vec4 colorB = texture2D(uTexB, ditherUv);
                
                // Dither-based reveal
                float threshold = t;
                gl_FragColor = n < threshold ? colorB : colorA;
            }
        `
    },

    pixelate_scan: {
        uniforms: { uBlockSize: 20.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uBlockSize;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Scanline effect
                float scanline = sin(vUv.y * 100.0 + t * 20.0);
                
                // Pixelation scales smoothly with effectStrength
                float blocks = mix(500.0, uBlockSize, effectStrength);
                vec2 pixelUv = floor(vUv * blocks) / blocks;
                
                vec4 colorA = texture2D(uTexA, pixelUv);
                vec4 colorB = texture2D(uTexB, pixelUv);
                
                vec4 color = mix(colorA, colorB, t);
                
                // Scanline overlay also scales with effectStrength
                color.rgb += scanline * 0.1 * effectStrength;
                
                gl_FragColor = color;
            }
        `
    },

    pixelate_glitch: {
        uniforms: { uGlitchStrength: 0.1, uMinPixels: 20.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uGlitchStrength;
            uniform float uMinPixels;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 uv = vUv;
                
                // Block offset scales with effectStrength
                float block = floor(uv.y * 10.0 + t * 5.0);
                float offset = sin(block * 123.4) * uGlitchStrength * effectStrength;
                uv.x += offset;
                
                // Pixelation scales with effectStrength
                float pixels = mix(1000.0, uMinPixels, effectStrength);
                uv = floor(uv * pixels) / pixels;
                
                vec4 colorA = texture2D(uTexA, uv);
                vec4 colorB = texture2D(uTexB, uv);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    pixelate_mosaic: {
        uniforms: { uMinSize: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uMinSize;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Mosaic size: small at t=0/1, large at t=0.5
                float size = mix(0.001, uMinSize, effectStrength);
                vec2 mosaic = floor(vUv / size) * size;
                
                vec4 colorA = texture2D(uTexA, mosaic);
                vec4 colorB = texture2D(uTexB, mosaic);
                
                // Randomized reveal per mosaic cell
                float cellHash = hash(mosaic);
                float revealThreshold = t + (cellHash - 0.5) * 0.2 * effectStrength;
                
                gl_FragColor = mix(colorA, colorB, smoothstep(0.4, 0.6, revealThreshold));
            }
        `
    },

    pixelate_retro: {
        uniforms: { uMinResolution: 64.0, uColorDepth: 4.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uMinResolution;
            uniform float uColorDepth;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Resolution scales with effectStrength (high at t=0/1)
                float resolution = mix(512.0, uMinResolution, effectStrength);
                vec2 retroUv = floor(vUv * resolution) / resolution;
                
                vec4 colorA = texture2D(uTexA, retroUv);
                vec4 colorB = texture2D(uTexB, retroUv);
                
                // Color quantization scales with effectStrength
                float colorLevels = mix(256.0, uColorDepth, effectStrength);
                colorA.rgb = floor(colorA.rgb * colorLevels) / colorLevels;
                colorB.rgb = floor(colorB.rgb * colorLevels) / colorLevels;
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    pixelate_8bit: {
        uniforms: { uMinGrid: 32.0, uColorBits: 8.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uMinGrid;
            uniform float uColorBits;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Grid size scales with effectStrength
                float grid = mix(256.0, uMinGrid, effectStrength);
                vec2 gridUv = floor(vUv * grid) / grid;
                
                vec4 colorA = texture2D(uTexA, gridUv);
                vec4 colorB = texture2D(uTexB, gridUv);
                
                vec4 color = mix(colorA, colorB, t);
                
                // Color reduction scales with effectStrength
                float colorLevels = mix(256.0, uColorBits, effectStrength);
                color.rgb = floor(color.rgb * colorLevels) / colorLevels;
                
                gl_FragColor = color;
            }
        `
    },

    pixelate_quantize: {
        uniforms: { uMinLevels: 2.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uMinLevels;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Quantization levels: 255 at t=0/1, uMinLevels at t=0.5
                float q = mix(255.0, uMinLevels, effectStrength);
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                vec4 color = mix(colorA, colorB, t);
                
                color.rgb = floor(color.rgb * q) / q;
                
                gl_FragColor = color;
            }
        `
    }
};

export default PIXELATE_VARIANTS;

