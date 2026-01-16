// NOTE: Keep format. Parsed by Python regex.


import { SHADER_COMMON } from './common.glsl.js';

export const ZOOM_VARIANTS = {
    zoom_in: {
        uniforms: { uScale: 1.3 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScale;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);

                float scaleA = 1.0 + (uScale - 1.0) * bell * (1.0 - uProgress) * uIntensity;
                float scaleB = 1.0 + (uScale - 1.0) * bell * uProgress * uIntensity;

                vec2 uvA = (vUv - center) / scaleA + center;
                vec2 uvB = (vUv - center) / scaleB + center;

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                // Vignette during zoom
                float vignette = 1.0 - bell * 0.2 * length(vUv - 0.5) * uIntensity;

                vec4 result = mix(colorA, colorB, uProgress);
                result.rgb *= vignette;

                gl_FragColor = result;
            }
        `
    },

    zoom_out: {
        uniforms: { uScale: 0.7 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScale;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);

                float scaleA = 1.0 + (1.0 - uScale) * bell * uProgress * uIntensity;
                float scaleB = 1.0 + (1.0 - uScale) * bell * (1.0 - uProgress) * uIntensity;

                vec2 uvA = (vUv - center) * scaleA + center;
                vec2 uvB = (vUv - center) * scaleB + center;

                vec4 colorA = texture2D(uTexA, clamp(uvA, 0.0, 1.0));
                vec4 colorB = texture2D(uTexB, clamp(uvB, 0.0, 1.0));

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    zoom_push: {
        uniforms: { uScale: 1.2, uOffset: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScale;
            uniform float uOffset;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);
                float t = easeInOutCubic(uProgress);

                // A zooms in and moves right
                float scaleA = 1.0 + (uScale - 1.0) * t * uIntensity;
                vec2 offsetA = vec2(uOffset * t * uIntensity, 0.0);
                vec2 uvA = (vUv - center - offsetA) / scaleA + center;

                // B zooms from small
                float scaleB = mix(0.8, 1.0, t);
                vec2 uvB = (vUv - center) / scaleB + center;

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                // Light drag effect
                float drag = bell * 0.02 * uIntensity;
                colorA.rgb += drag;

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    zoom_pull: {
        uniforms: { uScale: 1.2 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScale;

            void main() {
                vec2 center = vec2(0.5);
                float t = easeInOutCubic(uProgress);

                // A stays, B pulls forward
                vec2 uvA = vUv;
                float scaleB = mix(1.3, 1.0, t);
                vec2 uvB = (vUv - center) / scaleB + center;

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    zoom_rotate: {
        uniforms: { uScale: 1.15, uAngle: 0.2 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScale;
            uniform float uAngle;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);
                float t = uProgress;

                // Combine zoom and rotation
                float angle = uAngle * bell * uIntensity;
                float scale = 1.0 + (uScale - 1.0) * bell * uIntensity;

                vec2 uvA = rotate2D(vUv, center, -angle);
                uvA = (uvA - center) / scale + center;

                vec2 uvB = rotate2D(vUv, center, angle);
                uvB = (uvB - center) / scale + center;

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    zoom_blur: {
        uniforms: { uScale: 1.2, uBlurStrength: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScale;
            uniform float uBlurStrength;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);
                float t = uProgress;

                // Radial blur during zoom
                vec4 colorA = vec4(0.0);
                vec4 colorB = vec4(0.0);
                float samples = 8.0;

                for (float i = 0.0; i < 8.0; i++) {
                    float offset = (i / samples) * uBlurStrength * bell * uIntensity;
                    vec2 blurOffset = (vUv - center) * offset;

                    colorA += texture2D(uTexA, vUv - blurOffset);
                    colorB += texture2D(uTexB, vUv + blurOffset);
                }

                colorA /= samples;
                colorB /= samples;

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    zoom_swirl: {
        uniforms: { uScale: 1.15, uSwirl: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScale;
            uniform float uSwirl;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);
                float t = uProgress;

                // Swirl distortion
                vec2 d = vUv - center;
                float dist = length(d);
                float swirlAmount = uSwirl * bell * (1.0 - dist) * uIntensity;

                vec2 uvA = swirl(vUv, center, -swirlAmount, 0.7);
                vec2 uvB = swirl(vUv, center, swirlAmount, 0.7);

                // Apply zoom
                float scale = 1.0 + (uScale - 1.0) * bell * uIntensity;
                uvA = (uvA - center) / scale + center;
                uvB = (uvB - center) / scale + center;

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    zoom_warp: {
        uniforms: { uScale: 1.2, uWarpStrength: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uScale;
            uniform float uWarpStrength;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);
                float t = uProgress;

                // Barrel distortion
                float warp = uWarpStrength * bell * uIntensity;
                vec2 uvA = barrelDistort(vUv, -warp);
                vec2 uvB = barrelDistort(vUv, warp);

                // Apply zoom
                float scale = 1.0 + (uScale - 1.0) * bell * uIntensity;
                uvA = (uvA - center) / scale + center;
                uvB = (uvB - center) / scale + center;

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    }
};

export default ZOOM_VARIANTS;

