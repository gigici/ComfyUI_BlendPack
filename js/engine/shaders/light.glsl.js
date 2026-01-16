// NOTE: Keep format. Parsed by Python regex.


import { SHADER_COMMON } from './common.glsl.js';

export const LIGHT_VARIANTS = {
    soft_leak: {
        uniforms: { uLeakColor: [1.0, 0.9, 0.7], uBloomIntensity: 0.4 },
        fragment: `
            ${SHADER_COMMON}
            uniform vec3 uLeakColor;
            uniform float uBloomIntensity;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float bell = sin(uProgress * 3.14159265);
                float t = easeInOutCubic(uProgress);

                // Exposure shift
                float exposureA = 1.0 + (1.0 - t) * 0.2 * bell * uIntensity;
                float exposureB = 1.0 + t * 0.2 * bell * uIntensity;

                vec4 result = mix(colorA * exposureA, colorB * exposureB, t);

                // Soft light leak
                vec2 leakCenter = vec2(0.5 + sin(uTime * 0.5) * 0.2, 0.5);
                float leakMask = 1.0 - length(vUv - leakCenter);
                leakMask = pow(max(0.0, leakMask), 2.0);

                result.rgb += uLeakColor * leakMask * bell * uIntensity * 0.3;

                // Bloom
                float bloom = max(0.0, luminance(result.rgb) - 0.7);
                result.rgb += bloom * uBloomIntensity * bell;

                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    hard_leak: {
        uniforms: { uLeakColor: [1.0, 0.6, 0.3], uBloomIntensity: 0.6 },
        fragment: `
            ${SHADER_COMMON}
            uniform vec3 uLeakColor;
            uniform float uBloomIntensity;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float bell = sin(uProgress * 3.14159265);
                float t = uProgress;

                vec4 result = mix(colorA, colorB, easeInOutCubic(t));

                // Hard directional leak
                float leakMask = vUv.x + vUv.y - 1.0 + (1.0 - t);
                leakMask = smoothstep(0.0, 0.5, leakMask);

                result.rgb += uLeakColor * leakMask * bell * uIntensity * 0.5;

                // Strong bloom
                float bloom = max(0.0, luminance(result.rgb) - 0.6);
                result.rgb += bloom * uBloomIntensity * bell;

                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    halation_melt: {
        uniforms: { uHalationColor: [1.0, 0.4, 0.2] },
        fragment: `
            ${SHADER_COMMON}
            uniform vec3 uHalationColor;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float bell = sin(uProgress * 3.14159265);
                float t = easeInOutCubic(uProgress);

                // Film halation: red glow around bright areas
                float lumA = luminance(colorA.rgb);
                float lumB = luminance(colorB.rgb);

                // Spread halation
                vec4 halationA = vec4(0.0);
                vec4 halationB = vec4(0.0);
                for (float i = -2.0; i <= 2.0; i++) {
                    for (float j = -2.0; j <= 2.0; j++) {
                        vec2 offset = vec2(i, j) * 0.01 * bell;
                        halationA += texture2D(uTexA, vUv + offset);
                        halationB += texture2D(uTexB, vUv + offset);
                    }
                }
                halationA /= 25.0;
                halationB /= 25.0;

                // Apply halation to bright areas
                vec4 result = mix(colorA, colorB, t);
                float halationMask = smoothstep(0.5, 0.9, mix(lumA, lumB, t));
                result.rgb += uHalationColor * halationMask * bell * uIntensity * 0.4;

                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    glow_veil: {
        uniforms: { uGlowColor: [1.0, 1.0, 0.95] },
        fragment: `
            ${SHADER_COMMON}
            uniform vec3 uGlowColor;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float bell = sin(uProgress * 3.14159265);
                float t = easeInOutCubic(uProgress);

                vec4 result = mix(colorA, colorB, t);

                // Soft glow veil overlay
                float veilMask = 1.0 - abs(vUv.y - 0.5) * 2.0;
                veilMask = pow(veilMask, 0.5);

                result.rgb += uGlowColor * veilMask * bell * uIntensity * 0.25;

                // Slight desaturation for dreamy effect
                float lum = luminance(result.rgb);
                result.rgb = mix(result.rgb, vec3(lum), bell * 0.2);

                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    highlight_carry: {
        uniforms: {},
        fragment: `
            ${SHADER_COMMON}

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float bell = sin(uProgress * 3.14159265);
                float t = easeInOutCubic(uProgress);

                // Carry highlights from A to B
                float lumA = luminance(colorA.rgb);
                float highlightMask = smoothstep(0.6, 0.9, lumA);

                vec4 result = mix(colorA, colorB, t);

                // Add A's highlights during transition
                result.rgb += colorA.rgb * highlightMask * bell * uIntensity * (1.0 - t) * 0.5;

                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    exposure_roll: {
        uniforms: { uExposureRange: 0.4 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uExposureRange;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float t = uProgress;

                // Rolling exposure change
                float exposureA = 1.0 + uExposureRange * (1.0 - t) * uIntensity;
                float exposureB = 1.0 - uExposureRange * (1.0 - t) * uIntensity + uExposureRange * t * uIntensity;

                vec4 result = mix(colorA * exposureA, colorB * exposureB, easeInOutCubic(t));

                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    flare_hint: {
        uniforms: { uFlareColor: [1.0, 0.95, 0.8] },
        fragment: `
            ${SHADER_COMMON}
            uniform vec3 uFlareColor;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float bell = sin(uProgress * 3.14159265);
                float t = easeInOutCubic(uProgress);

                vec4 result = mix(colorA, colorB, t);

                // Subtle lens flare
                vec2 flareCenter = vec2(0.7, 0.3);
                float flareDist = length(vUv - flareCenter);
                float flare = 1.0 - smoothstep(0.0, 0.4, flareDist);
                flare *= bell * uIntensity * 0.15;

                // Secondary flare
                vec2 flare2Center = vec2(0.3, 0.7);
                float flare2 = 1.0 - smoothstep(0.0, 0.3, length(vUv - flare2Center));
                flare2 *= bell * uIntensity * 0.1;

                result.rgb += uFlareColor * (flare + flare2);

                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    gradient_bloom: {
        uniforms: { uBloomColor: [1.0, 0.9, 0.8] },
        fragment: `
            ${SHADER_COMMON}
            uniform vec3 uBloomColor;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float bell = sin(uProgress * 3.14159265);
                float t = easeInOutCubic(uProgress);

                vec4 result = mix(colorA, colorB, t);

                // Directional gradient bloom
                float gradient = vUv.x * 0.5 + vUv.y * 0.5;
                float bloomMask = smoothstep(0.3, 0.7, gradient) * bell * uIntensity;

                // Threshold bloom on bright pixels
                float lum = luminance(result.rgb);
                float brightMask = smoothstep(0.5, 0.8, lum);

                result.rgb += uBloomColor * bloomMask * brightMask * 0.3;

                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    }
};

export default LIGHT_VARIANTS;

