// NOTE: Keep format. Parsed by Python regex.


import { SHADER_COMMON } from './common.glsl.js';

const BLUR_FUNCTION = `
    vec4 blur9(sampler2D tex, vec2 uv, vec2 resolution, vec2 direction) {
        vec4 color = vec4(0.0);
        vec2 off1 = vec2(1.3846153846) * direction;
        vec2 off2 = vec2(3.2307692308) * direction;
        color += texture2D(tex, uv) * 0.2270270270;
        color += texture2D(tex, uv + (off1 / resolution)) * 0.3162162162;
        color += texture2D(tex, uv - (off1 / resolution)) * 0.3162162162;
        color += texture2D(tex, uv + (off2 / resolution)) * 0.0702702703;
        color += texture2D(tex, uv - (off2 / resolution)) * 0.0702702703;
        return color;
    }
`;

export const BLUR_VARIANTS = {
    blur_gaussian: {
        uniforms: { uRadius: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            ${BLUR_FUNCTION}
            uniform float uRadius;

            void main() {
                float bell = sin(uProgress * 3.14159265) * uIntensity;
                float blurAmount = uRadius * bell * 15.0;

                // Two-pass blur approximation
                vec4 colorA = blur9(uTexA, vUv, uResolution, vec2(blurAmount, 0.0));
                colorA = blur9(uTexA, vUv, uResolution, vec2(0.0, blurAmount));

                vec4 colorB = blur9(uTexB, vUv, uResolution, vec2(blurAmount, 0.0));
                colorB = blur9(uTexB, vUv, uResolution, vec2(0.0, blurAmount));

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    blur_motion: {
        uniforms: { uRadius: 1.0, uAngle: 0.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRadius;
            uniform float uAngle;

            void main() {
                float bell = sin(uProgress * 3.14159265) * uIntensity;
                vec2 dir = vec2(cos(uAngle), sin(uAngle)) * uRadius * bell * 0.03;

                vec4 colorA = vec4(0.0);
                vec4 colorB = vec4(0.0);
                float samples = 10.0;

                for (float i = 0.0; i < 10.0; i++) {
                    float t = (i / samples) - 0.5;
                    colorA += texture2D(uTexA, vUv + dir * t);
                    colorB += texture2D(uTexB, vUv + dir * t);
                }

                colorA /= samples;
                colorB /= samples;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    blur_radial: {
        uniforms: { uRadius: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRadius;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265) * uIntensity;

                vec4 colorA = vec4(0.0);
                vec4 colorB = vec4(0.0);
                float samples = 10.0;

                for (float i = 0.0; i < 10.0; i++) {
                    float angle = (i / samples) * 6.28318;
                    float dist = uRadius * bell * 0.02;
                    vec2 offset = vec2(cos(angle), sin(angle)) * dist;

                    colorA += texture2D(uTexA, vUv + offset);
                    colorB += texture2D(uTexB, vUv + offset);
                }

                colorA /= samples;
                colorB /= samples;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    blur_zoom: {
        uniforms: { uRadius: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRadius;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265) * uIntensity;

                vec4 colorA = vec4(0.0);
                vec4 colorB = vec4(0.0);
                float samples = 10.0;

                for (float i = 0.0; i < 10.0; i++) {
                    float scale = 1.0 + (i / samples) * uRadius * bell * 0.1;
                    vec2 uvScaled = (vUv - center) * scale + center;

                    colorA += texture2D(uTexA, uvScaled);
                    colorB += texture2D(uTexB, uvScaled);
                }

                colorA /= samples;
                colorB /= samples;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    blur_directional: {
        uniforms: { uRadius: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRadius;

            void main() {
                float bell = sin(uProgress * 3.14159265) * uIntensity;
                vec2 dir = vec2(1.0, 0.0) * uRadius * bell * 0.02;

                vec4 colorA = vec4(0.0);
                vec4 colorB = vec4(0.0);
                float samples = 12.0;

                for (float i = 0.0; i < 12.0; i++) {
                    float t = (i / samples) - 0.5;
                    vec2 offset = dir * t;
                    colorA += texture2D(uTexA, vUv + offset);
                    colorB += texture2D(uTexB, vUv + offset);
                }

                colorA /= samples;
                colorB /= samples;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    blur_tilt: {
        uniforms: { uRadius: 1.0, uFocusY: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            ${BLUR_FUNCTION}
            uniform float uRadius;
            uniform float uFocusY;

            void main() {
                float bell = sin(uProgress * 3.14159265) * uIntensity;

                // Tilt-shift: blur based on distance from focus line
                float focusDist = abs(vUv.y - uFocusY);
                float blurAmount = focusDist * uRadius * bell * 20.0;

                vec4 colorA = blur9(uTexA, vUv, uResolution, vec2(0.0, blurAmount));
                vec4 colorB = blur9(uTexB, vUv, uResolution, vec2(0.0, blurAmount));

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    blur_swirl: {
        uniforms: { uRadius: 1.0, uSwirl: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRadius;
            uniform float uSwirl;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265) * uIntensity;

                vec4 colorA = vec4(0.0);
                vec4 colorB = vec4(0.0);
                float samples = 10.0;

                for (float i = 0.0; i < 10.0; i++) {
                    float angle = (i / samples) * uSwirl * bell;
                    vec2 uvSwirled = swirl(vUv, center, angle * 0.5, 0.8);

                    colorA += texture2D(uTexA, uvSwirled);
                    colorB += texture2D(uTexB, uvSwirled);
                }

                colorA /= samples;
                colorB /= samples;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    blur_dreamy: {
        uniforms: { uRadius: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            ${BLUR_FUNCTION}
            uniform float uRadius;

            void main() {
                float bell = sin(uProgress * 3.14159265) * uIntensity;
                float blurAmount = uRadius * bell * 12.0;

                // Gaussian blur
                vec4 blurredA = blur9(uTexA, vUv, uResolution, vec2(blurAmount, blurAmount * 0.5));
                vec4 blurredB = blur9(uTexB, vUv, uResolution, vec2(blurAmount, blurAmount * 0.5));

                // Sharp original
                vec4 sharpA = texture2D(uTexA, vUv);
                vec4 sharpB = texture2D(uTexB, vUv);

                // Dreamy = soft glow overlay
                vec4 colorA = mix(sharpA, blurredA, 0.5 + bell * 0.3);
                vec4 colorB = mix(sharpB, blurredB, 0.5 + bell * 0.3);

                // Add bloom
                colorA.rgb += blurredA.rgb * bell * 0.2;
                colorB.rgb += blurredB.rgb * bell * 0.2;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    }
};

export default BLUR_VARIANTS;

