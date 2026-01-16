// NOTE: Keep format. Parsed by Python regex.
/**
 * Refraction Engine - Glass/water distortion transitions
 * 
 * TRANSITION LOGIC:
 * - t=0: Clip A shown normally (no distortion)
 * - t=0.5: Maximum refraction effect
 * - t=1: Clip B shown normally (no distortion)
 * - effectStrength = sin(t * PI) creates 0→1→0 curve
 */

import { SHADER_COMMON } from './common.glsl.js';

export const REFRACTION_VARIANTS = {
    micro_lens: {
        uniforms: { uLensStrength: 0.2 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uLensStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Micro lens grid
                vec2 grid = fract(vUv * 20.0) - 0.5;
                float dist = length(grid);
                vec2 lensOffset = grid * uLensStrength * effectStrength * smoothstep(0.5, 0.0, dist);
                
                // Apply distortion proportionally to each clip
                vec2 uvA = vUv + lensOffset * (1.0 - t);
                vec2 uvB = vUv + lensOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    glass_ripple: {
        uniforms: { uRippleStrength: 0.05, uRippleFrequency: 40.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRippleStrength;
            uniform float uRippleFrequency;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                float dist = distance(vUv, vec2(0.5));
                vec2 dir = normalize(vUv - vec2(0.5) + 0.001);
                
                // Ripple offset scales with effectStrength
                float ripple = sin(dist * uRippleFrequency - t * 10.0) * uRippleStrength * effectStrength;
                vec2 rippleOffset = dir * ripple;
                
                // Apply ripple proportionally
                vec2 uvA = vUv + rippleOffset * (1.0 - t);
                vec2 uvB = vUv + rippleOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    heat_haze: {
        uniforms: { uHazeStrength: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uHazeStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Heat haze distortion scales with effectStrength
                float haze = snoise(vec2(vUv.x * 10.0, vUv.y * 10.0 - t * 5.0)) * uHazeStrength * effectStrength;
                vec2 hazeOffset = vec2(haze, 0.0);
                
                // Apply haze proportionally
                vec2 uvA = vUv + hazeOffset * (1.0 - t);
                vec2 uvB = vUv + hazeOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    watery_wobble: {
        uniforms: { uWobbleStrength: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uWobbleStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Wobble offset scales with effectStrength
                float w1 = sin(vUv.y * 10.0 + t * 5.0) * uWobbleStrength * effectStrength;
                float w2 = cos(vUv.x * 10.0 + t * 5.0) * uWobbleStrength * effectStrength;
                vec2 wobbleOffset = vec2(w1, w2);
                
                // Apply wobble proportionally
                vec2 uvA = vUv + wobbleOffset * (1.0 - t);
                vec2 uvB = vUv + wobbleOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    edge_refract: {
        uniforms: { uRefractStrength: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRefractStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 dist = vUv - 0.5;
                // Refraction stronger at edges, scales with effectStrength
                float strength = length(dist) * uRefractStrength * effectStrength;
                vec2 refractOffset = -dist * strength;
                
                // Apply refraction proportionally
                vec2 uvA = vUv + refractOffset * (1.0 - t);
                vec2 uvB = vUv + refractOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    center_refract: {
        uniforms: { uRefractStrength: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRefractStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 dist = vUv - 0.5;
                // Refraction stronger at center, scales with effectStrength
                float strength = (1.0 - length(dist)) * uRefractStrength * effectStrength;
                vec2 refractOffset = dist * strength;
                
                // Apply refraction proportionally
                vec2 uvA = vUv + refractOffset * (1.0 - t);
                vec2 uvB = vUv + refractOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    caustic_hint: {
        uniforms: { uCausticStrength: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uCausticStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Voronoi-based caustic pattern
                float n = voronoi(vUv * 10.0 + t);
                float pattern = smoothstep(0.0, 0.1, n);
                
                // Distortion scales with effectStrength
                vec2 causticOffset = vec2(n) * uCausticStrength * effectStrength;
                
                // Apply distortion proportionally
                vec2 uvA = vUv + causticOffset * (1.0 - t);
                vec2 uvB = vUv + causticOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                vec4 color = mix(colorA, colorB, t);
                
                // Caustic highlight also scales with effectStrength
                color.rgb += pattern * 0.2 * effectStrength;
                
                gl_FragColor = color;
            }
        `
    },

    prism_micro: {
        uniforms: { uSplitStrength: 0.01 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSplitStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Chromatic split scales with effectStrength
                float split = uSplitStrength * effectStrength;
                
                vec2 uvR = vUv + vec2(split, 0.0);
                vec2 uvG = vUv;
                vec2 uvB = vUv - vec2(split, 0.0);
                
                float r = mix(texture2D(uTexA, uvR).r, texture2D(uTexB, uvR).r, t);
                float g = mix(texture2D(uTexA, uvG).g, texture2D(uTexB, uvG).g, t);
                float b = mix(texture2D(uTexA, uvB).b, texture2D(uTexB, uvB).b, t);
                
                gl_FragColor = vec4(r, g, b, 1.0);
            }
        `
    }
};

export default REFRACTION_VARIANTS;

