// NOTE: Keep format. Parsed by Python regex.


import { SHADER_COMMON } from './common.glsl.js';

export const WIPE_VARIANTS = {
    left: {
        uniforms: { uSoftness: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;
                
                float mask = 1.0 - vUv.x;
                
                float soft = uSoftness * (1.0 + uIntensity * 2.0);

                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    right: {
        uniforms: { uSoftness: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;

                float mask = vUv.x;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    up: {
        uniforms: { uSoftness: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;

                float mask = vUv.y;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    down: {
        uniforms: { uSoftness: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;

                float mask = 1.0 - vUv.y;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    diagonal_lr: {
        uniforms: { uSoftness: 0.03 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;


                float mask = (vUv.x + vUv.y) * 0.5;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    diagonal_rl: {
        uniforms: { uSoftness: 0.03 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;


                float mask = ((1.0 - vUv.x) + vUv.y) * 0.5;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    radial_center: {
        uniforms: { uSoftness: 0.05 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                vec2 center = vec2(0.5);
                float dist = length(vUv - center);
                float maxDist = length(vec2(0.5));
                

                float mask = dist / maxDist;

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    radial_edge: {
        uniforms: { uSoftness: 0.05 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                vec2 center = vec2(0.5);
                float dist = length(vUv - center);
                float maxDist = length(vec2(0.5));
                

                float mask = 1.0 - dist / maxDist;

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    spiral: {
        uniforms: { uSoftness: 0.03, uSpirals: 3.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;
            uniform float uSpirals;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                vec2 center = vec2(0.5);
                vec2 d = vUv - center;
                float dist = length(d);
                float angle = atan(d.y, d.x) / (2.0 * 3.14159265) + 0.5;

                float spiral = fract(angle * uSpirals + dist * 3.0);
                float mask = spiral;

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    clock: {
        uniforms: { uSoftness: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                vec2 center = vec2(0.5);
                vec2 d = vUv - center;
                float angle = atan(d.y, d.x);


                float mask = (angle + 3.14159265) / (2.0 * 3.14159265);
                mask = 1.0 - fract(mask + 0.25);

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    iris: {
        uniforms: { uSoftness: 0.04 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                vec2 center = vec2(0.5);
                float dist = length(vUv - center);

                float mask = dist; 
                
                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);
                

                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    barn_door: {
        uniforms: { uSoftness: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float distortion = (fbm(vUv * 10.0 + uTime * 0.5, 2) - 0.5) * 0.5 * uIntensity;
                float soft = uSoftness * (1.0 + uIntensity * 2.0);


                float mask = abs(vUv.x - 0.5) * 2.0;

                float edge = smoothstep(mask + distortion - soft, mask + distortion + soft, uProgress);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    }
};

export default WIPE_VARIANTS;

