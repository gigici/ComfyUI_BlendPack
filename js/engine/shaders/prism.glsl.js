// NOTE: Keep format. Parsed by Python regex.


import { SHADER_COMMON } from './common.glsl.js';

export const PRISM_VARIANTS = {
    rgb_split_thin: {
        uniforms: { uOffset: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uOffset;

            void main() {
                float bell = sin(uProgress * 3.14159265);
                float offset = uOffset * bell * uIntensity * 0.015;

                vec4 colorA, colorB;

                colorA.r = texture2D(uTexA, vUv + vec2(offset, 0.0)).r;
                colorA.g = texture2D(uTexA, vUv).g;
                colorA.b = texture2D(uTexA, vUv - vec2(offset, 0.0)).b;
                colorA.a = 1.0;

                colorB.r = texture2D(uTexB, vUv + vec2(offset, 0.0)).r;
                colorB.g = texture2D(uTexB, vUv).g;
                colorB.b = texture2D(uTexB, vUv - vec2(offset, 0.0)).b;
                colorB.a = 1.0;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    rgb_split_wide: {
        uniforms: { uOffset: 1.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uOffset;

            void main() {
                float bell = sin(uProgress * 3.14159265);
                float offset = uOffset * bell * uIntensity * 0.03;

                vec2 dir = vec2(1.0, 0.3);
                dir = normalize(dir);

                vec4 colorA, colorB;

                colorA.r = texture2D(uTexA, vUv + dir * offset).r;
                colorA.g = texture2D(uTexA, vUv).g;
                colorA.b = texture2D(uTexA, vUv - dir * offset).b;
                colorA.a = 1.0;

                colorB.r = texture2D(uTexB, vUv + dir * offset).r;
                colorB.g = texture2D(uTexB, vUv).g;
                colorB.b = texture2D(uTexB, vUv - dir * offset).b;
                colorB.a = 1.0;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    spectral_smear: {
        uniforms: { uSmearStrength: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSmearStrength;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);

                vec2 dir = normalize(vUv - center);
                float dist = length(vUv - center);
                float smear = uSmearStrength * bell * uIntensity * dist * 0.05;

                vec4 colorA, colorB;

                colorA.r = texture2D(uTexA, vUv + dir * smear).r;
                colorA.g = texture2D(uTexA, vUv).g;
                colorA.b = texture2D(uTexA, vUv - dir * smear).b;
                colorA.a = 1.0;

                colorB.r = texture2D(uTexB, vUv + dir * smear).r;
                colorB.g = texture2D(uTexB, vUv).g;
                colorB.b = texture2D(uTexB, vUv - dir * smear).b;
                colorB.a = 1.0;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    chroma_pulse: {
        uniforms: { uPulseSpeed: 2.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uPulseSpeed;

            void main() {
                float bell = sin(uProgress * 3.14159265);
                float pulse = sin(uTime * uPulseSpeed) * 0.5 + 0.5;
                float offset = bell * uIntensity * pulse * 0.02;

                vec4 colorA, colorB;

                colorA.r = texture2D(uTexA, vUv + vec2(offset, 0.0)).r;
                colorA.g = texture2D(uTexA, vUv + vec2(0.0, offset * 0.5)).g;
                colorA.b = texture2D(uTexA, vUv - vec2(offset, 0.0)).b;
                colorA.a = 1.0;

                colorB.r = texture2D(uTexB, vUv + vec2(offset, 0.0)).r;
                colorB.g = texture2D(uTexB, vUv + vec2(0.0, offset * 0.5)).g;
                colorB.b = texture2D(uTexB, vUv - vec2(offset, 0.0)).b;
                colorB.a = 1.0;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    aberration_mid_only: {
        uniforms: { uOffset: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uOffset;

            void main() {
                float bell = sin(uProgress * 3.14159265);

                // Only apply aberration in the middle of frame
                float midMask = 1.0 - abs(vUv.x - 0.5) * 2.0;
                midMask = smoothstep(0.0, 0.5, midMask);

                float offset = uOffset * bell * uIntensity * midMask * 0.02;

                vec4 colorA, colorB;

                colorA.r = texture2D(uTexA, vUv + vec2(offset, 0.0)).r;
                colorA.g = texture2D(uTexA, vUv).g;
                colorA.b = texture2D(uTexA, vUv - vec2(offset, 0.0)).b;
                colorA.a = 1.0;

                colorB.r = texture2D(uTexB, vUv + vec2(offset, 0.0)).r;
                colorB.g = texture2D(uTexB, vUv).g;
                colorB.b = texture2D(uTexB, vUv - vec2(offset, 0.0)).b;
                colorB.a = 1.0;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    prism_scatter: {
        uniforms: { uScatter: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScatter;

            void main() {
                float bell = sin(uProgress * 3.14159265);

                // Random scatter direction per pixel
                float angle = hash(floor(vUv * 20.0)) * 6.28318;
                vec2 dir = vec2(cos(angle), sin(angle));
                float scatter = uScatter * bell * uIntensity * 0.015;

                vec4 colorA, colorB;

                colorA.r = texture2D(uTexA, vUv + dir * scatter).r;
                colorA.g = texture2D(uTexA, vUv).g;
                colorA.b = texture2D(uTexA, vUv - dir * scatter).b;
                colorA.a = 1.0;

                colorB.r = texture2D(uTexB, vUv + dir * scatter).r;
                colorB.g = texture2D(uTexB, vUv).g;
                colorB.b = texture2D(uTexB, vUv - dir * scatter).b;
                colorB.a = 1.0;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    dual_prism: {
        uniforms: { uOffset: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uOffset;

            void main() {
                float bell = sin(uProgress * 3.14159265);
                float offset = uOffset * bell * uIntensity * 0.02;

                // Horizontal and vertical split
                vec4 colorA, colorB;

                colorA.r = texture2D(uTexA, vUv + vec2(offset, offset * 0.5)).r;
                colorA.g = texture2D(uTexA, vUv).g;
                colorA.b = texture2D(uTexA, vUv - vec2(offset, offset * 0.5)).b;
                colorA.a = 1.0;

                colorB.r = texture2D(uTexB, vUv + vec2(offset, -offset * 0.5)).r;
                colorB.g = texture2D(uTexB, vUv).g;
                colorB.b = texture2D(uTexB, vUv - vec2(offset, -offset * 0.5)).b;
                colorB.a = 1.0;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    rainbow_micro: {
        uniforms: { uRainbowStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRainbowStrength;

            void main() {
                float bell = sin(uProgress * 3.14159265);
                float t = uProgress;

                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                // Subtle rainbow shift based on position
                float rainbow = (vUv.x + vUv.y) * 0.5;
                vec3 shift = vec3(
                    sin(rainbow * 6.28318) * 0.5 + 0.5,
                    sin(rainbow * 6.28318 + 2.094) * 0.5 + 0.5,
                    sin(rainbow * 6.28318 + 4.188) * 0.5 + 0.5
                );

                vec4 result = mix(colorA, colorB, t);
                result.rgb = mix(result.rgb, result.rgb * shift, bell * uRainbowStrength * uIntensity * 0.3);

                gl_FragColor = result;
            }
        `
    }
};

export default PRISM_VARIANTS;

