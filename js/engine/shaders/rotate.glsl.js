// NOTE: Keep format. Parsed by Python regex.


import { SHADER_COMMON } from './common.glsl.js';

export const ROTATE_VARIANTS = {
    rotate_cw: {
        uniforms: { uAngle: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uAngle;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);
                float angle = uAngle * bell * uIntensity;

                vec2 uvA = rotate2D(vUv, center, -angle * (1.0 - uProgress));
                vec2 uvB = rotate2D(vUv, center, angle * uProgress);

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    rotate_ccw: {
        uniforms: { uAngle: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uAngle;

            void main() {
                vec2 center = vec2(0.5);
                float bell = sin(uProgress * 3.14159265);
                float angle = -uAngle * bell * uIntensity;

                vec2 uvA = rotate2D(vUv, center, -angle * (1.0 - uProgress));
                vec2 uvB = rotate2D(vUv, center, angle * uProgress);

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    rotate_flip: {
        uniforms: {},
        fragment: `
            ${SHADER_COMMON}

            void main() {
                vec2 center = vec2(0.5);
                float t = easeInOutCubic(uProgress);

                // Flip effect using scale
                float scaleX = cos(t * 3.14159265);
                vec2 uvA = vec2((vUv.x - 0.5) * abs(scaleX) + 0.5, vUv.y);
                vec2 uvB = vec2((vUv.x - 0.5) * abs(scaleX) + 0.5, vUv.y);

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                // Switch at midpoint
                gl_FragColor = t < 0.5 ? colorA : colorB;
            }
        `
    },

    rotate_3d: {
        uniforms: { uAngle: 0.3 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uAngle;

            void main() {
                vec2 center = vec2(0.5);
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);

                // Pseudo 3D rotation with perspective
                float perspective = 1.0 - bell * 0.3 * uIntensity;
                vec2 uvA = vec2(
                    (vUv.x - 0.5) / perspective + 0.5,
                    vUv.y
                );
                vec2 uvB = vec2(
                    (vUv.x - 0.5) * perspective + 0.5,
                    vUv.y
                );

                // Add rotation
                float angle = uAngle * bell * uIntensity;
                uvA = rotate2D(uvA, center, -angle);
                uvB = rotate2D(uvB, center, angle);

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    rotate_spin: {
        uniforms: { uSpins: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSpins;

            void main() {
                vec2 center = vec2(0.5);
                float t = easeInOutCubic(uProgress);

                // Full spin(s)
                float angle = uSpins * 6.28318 * t * uIntensity;

                vec2 uvA = rotate2D(vUv, center, -angle * 0.5);
                vec2 uvB = rotate2D(vUv, center, angle * 0.5);

                // Scale during spin
                float scale = 1.0 - sin(t * 3.14159265) * 0.2;
                uvA = (uvA - center) / scale + center;
                uvB = (uvB - center) / scale + center;

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    rotate_tumble: {
        uniforms: { uAngle: 0.4 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uAngle;

            void main() {
                vec2 center = vec2(0.5);
                float t = uProgress;
                float bell = sin(uProgress * 3.14159265);

                // Tumbling with bounce
                float bounce = abs(sin(t * 3.14159265 * 2.0)) * (1.0 - t);
                float angle = uAngle * t * (1.0 + bounce) * uIntensity;

                vec2 uvA = rotate2D(vUv, center, -angle);
                vec2 uvB = rotate2D(vUv, center, angle * 0.5);

                // Slight vertical offset for tumble
                uvA.y += bounce * 0.05;
                uvB.y -= bounce * 0.05 * (1.0 - t);

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, easeOutBounce(t));
            }
        `
    },

    rotate_orbit: {
        uniforms: { uRadius: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRadius;

            void main() {
                vec2 center = vec2(0.5);
                float t = easeInOutCubic(uProgress);
                float angle = t * 3.14159265;

                // Orbital motion
                vec2 orbitOffset = vec2(cos(angle), sin(angle)) * uRadius * uIntensity;

                vec2 uvA = vUv - orbitOffset * (1.0 - t);
                vec2 uvB = vUv + orbitOffset * t;

                // Add rotation
                uvA = rotate2D(uvA, center, -angle * 0.3);
                uvB = rotate2D(uvB, center, angle * 0.3);

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    rotate_swirl: {
        uniforms: { uSwirl: 2.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSwirl;

            void main() {
                vec2 center = vec2(0.5);
                float t = uProgress;
                float bell = sin(uProgress * 3.14159265);

                // Swirl distortion
                float swirlAmount = uSwirl * bell * uIntensity;

                vec2 uvA = swirl(vUv, center, -swirlAmount, 0.6);
                vec2 uvB = swirl(vUv, center, swirlAmount, 0.6);

                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);

                gl_FragColor = mix(colorA, colorB, easeInOutCubic(t));
            }
        `
    }
};

export default ROTATE_VARIANTS;

