// NOTE: Keep format. Parsed by Python regex.


import { SHADER_COMMON } from './common.glsl.js';



export const DISSOLVE_VARIANTS = {
    powder: {
        uniforms: { uNoiseScale: 0.8, uSoftness: 0.12 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uNoiseScale;
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float n = fbm(vUv * uNoiseScale * 8.0 + uTime * 0.1, 4);
                
                float soft = uSoftness * uIntensity;
                float threshold = uProgress * (1.0 + soft * 2.0);
                
                float glowMask = smoothstep(n - soft * 2.0, n, threshold) * (1.0 - smoothstep(n, n + soft * 2.0, threshold));
                
                float edge = smoothstep(n - soft, n + soft, threshold);
                
                vec4 result = mix(colorA, colorB, edge);
                result.rgb += vec3(glowMask * 0.5 * uIntensity); // Add brightness
                
                gl_FragColor = result;
            }
        `
    },

    ink: {
        uniforms: { uNoiseScale: 1.0, uSoftness: 0.06 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uNoiseScale;
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);


                vec2 offset = vec2(0.0, -0.5) * (1.0 - uProgress) * 0.1;
                float n = fbm((vUv + offset) * uNoiseScale * 6.0, 5);
                n = pow(n, 0.7); // Sharper edges

                float soft = uSoftness * uIntensity;
                float threshold = uProgress * 1.3;
                float edge = smoothstep(n - soft * 0.5, n + soft * 0.5, threshold);


                float edgeDark = smoothstep(threshold - soft, threshold, n) *
                                (1.0 - smoothstep(threshold, threshold + soft, n));
                vec4 result = mix(colorA, colorB, edge);
                result.rgb -= edgeDark * 0.1 * uIntensity;

                gl_FragColor = result;
            }
        `
    },

    cellular: {
        uniforms: { uNoiseScale: 1.2, uSoftness: 0.08 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uNoiseScale;
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);


                float n = voronoi(vUv * uNoiseScale * 10.0);
                n = 1.0 - n; // Invert for cell centers

                float soft = uSoftness * uIntensity;
                float threshold = uProgress * 1.2;
                float edge = smoothstep(n - soft, n + soft, threshold);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    bokeh: {
        uniforms: { uNoiseScale: 0.5, uSoftness: 0.2 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uNoiseScale;
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);


                float n = 0.0;
                for (float i = 0.0; i < 7.0; i++) {
                    vec2 center = vec2(
                        hash(vec2(i * 1.3, 0.7)),
                        hash(vec2(0.3, i * 1.7))
                    );
                    float radius = 0.08 + hash(vec2(i, i * 0.5)) * 0.15;
                    float circle = 1.0 - smoothstep(radius - 0.03, radius, length(vUv - center));
                    n = max(n, circle * hash(vec2(i * 2.3, i)));
                }
                n = mix(n, fbm(vUv * uNoiseScale * 4.0, 3), 0.4);

                float soft = uSoftness * uIntensity;
                float threshold = uProgress * 1.4;
                float edge = smoothstep(n - soft, n + soft, threshold);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    fractal: {
        uniforms: { uNoiseScale: 1.5, uSoftness: 0.08 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uNoiseScale;
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);


                float n = fbm(vUv * uNoiseScale * 5.0 + uTime * 0.05, 6);
                n = pow(n, 1.2);

                float soft = uSoftness * uIntensity;
                float threshold = uProgress * 1.15;
                float edge = smoothstep(n - soft, n + soft, threshold);


                float edgeLine = abs(n - threshold);
                edgeLine = 1.0 - smoothstep(0.0, soft * 0.5, edgeLine);
                vec4 result = mix(colorA, colorB, edge);
                result.rgb += edgeLine * vec3(0.3, 0.5, 1.0) * uIntensity * 0.2;

                gl_FragColor = result;
            }
        `
    },

    ribbon: {
        uniforms: { uNoiseScale: 1.0, uSoftness: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uNoiseScale;
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);


                float stripe = sin(vUv.x * 20.0 + vUv.y * 10.0 + uTime * 2.0) * 0.5 + 0.5;
                float n = fbm(vUv * uNoiseScale * 4.0, 3);
                n = mix(n, stripe, 0.5);

                float soft = uSoftness * uIntensity;
                float threshold = uProgress * 1.2;
                float edge = smoothstep(n - soft, n + soft, threshold);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    edge_swell: {
        uniforms: { uNoiseScale: 0.8, uSoftness: 0.15 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uNoiseScale;
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);


                float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
                float n = fbm(vUv * uNoiseScale * 6.0, 4);
                n = mix(1.0 - edgeDist * 2.0, n, 0.5);

                float soft = uSoftness * uIntensity;
                float threshold = uProgress * 1.3;
                float edge = smoothstep(n - soft, n + soft, threshold);

                gl_FragColor = mix(colorA, colorB, edge);
            }
        `
    },

    filmgrain: {
        uniforms: { uNoiseScale: 2.0, uSoftness: 0.15 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uNoiseScale;
            uniform float uSoftness;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);


                float n = noise(vUv * uNoiseScale * 100.0 + uTime * 5.0);
                n = mix(n, fbm(vUv * uNoiseScale * 8.0, 4), 0.3);

                float soft = uSoftness * uIntensity;
                float threshold = uProgress * 1.1;
                float edge = smoothstep(n - soft, n + soft, threshold);


                float grain = (hash(vUv * uResolution + uTime) - 0.5) * 0.05 * uIntensity;
                vec4 result = mix(colorA, colorB, edge);
                result.rgb += grain;

                gl_FragColor = result;
            }
        `
    }
};

export default DISSOLVE_VARIANTS;

