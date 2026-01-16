// NOTE: Keep format. Parsed by Python regex.


import { SHADER_COMMON } from './common.glsl.js';

export const GLITCH_VARIANTS = {
    scan_jitter_micro: {
        uniforms: { uJitterAmount: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uJitterAmount;

            void main() {
                float bell = sin(uProgress * 3.14159265);


                float scanline = floor(vUv.y * uResolution.y);
                float jitter = (hash(vec2(scanline, floor(uTime * 30.0))) - 0.5) * 2.0;
                jitter *= uJitterAmount * bell * uIntensity * 0.01;

                vec2 uvJittered = vUv + vec2(jitter, 0.0);

                vec4 colorA = texture2D(uTexA, uvJittered);
                vec4 colorB = texture2D(uTexB, uvJittered);

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    line_tear_subtle: {
        uniforms: { uTearStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uTearStrength;

            void main() {
                float bell = sin(uProgress * 3.14159265);


                float tearLine = floor(vUv.y * 30.0);
                float tearActive = step(0.9, hash(vec2(tearLine, floor(uTime * 10.0))));
                float tearOffset = (hash(vec2(tearLine * 2.0, uTime)) - 0.5) * uTearStrength * bell * uIntensity * 0.05;

                vec2 uvTorn = vUv + vec2(tearOffset * tearActive, 0.0);

                vec4 colorA = texture2D(uTexA, uvTorn);
                vec4 colorB = texture2D(uTexB, uvTorn);

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    block_drift_soft: {
        uniforms: { uBlockSize: 16.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uBlockSize;

            void main() {
                float bell = sin(uProgress * 3.14159265);


                vec2 block = floor(vUv * uBlockSize);
                float driftX = (hash(block + floor(uTime * 5.0)) - 0.5) * bell * uIntensity * 0.03;
                float driftY = (hash(block.yx + floor(uTime * 5.0)) - 0.5) * bell * uIntensity * 0.01;

                vec2 uvDrifted = vUv + vec2(driftX, driftY);

                vec4 colorA = texture2D(uTexA, uvDrifted);
                vec4 colorB = texture2D(uTexB, uvDrifted);

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    sync_offset: {
        uniforms: { uOffsetAmount: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uOffsetAmount;

            void main() {
                float bell = sin(uProgress * 3.14159265);


                float offset = sin(vUv.y * 50.0 + uTime * 10.0) * uOffsetAmount * bell * uIntensity * 0.01;

                vec2 uvOffset = vUv + vec2(offset, 0.0);

                vec4 colorA = texture2D(uTexA, uvOffset);
                vec4 colorB = texture2D(uTexB, uvOffset);


                colorA.r = texture2D(uTexA, uvOffset + vec2(0.002, 0.0)).r;
                colorB.r = texture2D(uTexB, uvOffset + vec2(0.002, 0.0)).r;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    interlace_flicker: {
        uniforms: { uFlickerSpeed: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uFlickerSpeed;

            void main() {
                float bell = sin(uProgress * 3.14159265);


                float scanline = mod(floor(vUv.y * uResolution.y), 2.0);
                float flicker = sin(uTime * uFlickerSpeed * 60.0) * 0.5 + 0.5;


                float lineMask = mix(1.0, 0.85 + flicker * 0.15, scanline * bell * uIntensity);

                vec4 colorA = texture2D(uTexA, vUv) * lineMask;
                vec4 colorB = texture2D(uTexB, vUv) * lineMask;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    },

    noise_bands: {
        uniforms: { uBandCount: 5.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uBandCount;

            void main() {
                float bell = sin(uProgress * 3.14159265);


                float band = floor(vUv.y * uBandCount);
                float bandNoise = hash(vec2(band, floor(uTime * 8.0)));
                float bandActive = step(0.7, bandNoise);

                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);


                float noise = hash(vUv * uResolution + uTime) * 0.3;
                vec4 result = mix(colorA, colorB, uProgress);
                result.rgb = mix(result.rgb, result.rgb + noise - 0.15, bandActive * bell * uIntensity);

                gl_FragColor = result;
            }
        `
    },

    compression_shimmer: {
        uniforms: { uShimmerStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uShimmerStrength;

            void main() {
                float bell = sin(uProgress * 3.14159265);


                vec2 blockUv = floor(vUv * 16.0) / 16.0;
                float blockHash = hash(blockUv + floor(uTime * 15.0));


                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float shimmer = (blockHash - 0.5) * uShimmerStrength * bell * uIntensity * 0.1;

                vec4 result = mix(colorA, colorB, uProgress);
                result.rgb += shimmer;


                float quant = 32.0 - bell * uIntensity * 16.0;
                result.rgb = floor(result.rgb * quant) / quant;

                gl_FragColor = result;
            }
        `
    },

    smear_blocks_clean: {
        uniforms: { uSmearLength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSmearLength;

            void main() {
                float bell = sin(uProgress * 3.14159265);


                vec2 block = floor(vUv * 8.0);
                float smearActive = step(0.85, hash(block + floor(uTime * 6.0)));
                float smearDir = hash(block) > 0.5 ? 1.0 : -1.0;
                float smear = smearActive * smearDir * uSmearLength * bell * uIntensity * 0.1;

                vec4 colorA = vec4(0.0);
                vec4 colorB = vec4(0.0);


                for (float i = 0.0; i < 5.0; i++) {
                    float offset = (i / 5.0) * smear;
                    colorA += texture2D(uTexA, vUv + vec2(offset, 0.0));
                    colorB += texture2D(uTexB, vUv + vec2(offset, 0.0));
                }
                colorA /= 5.0;
                colorB /= 5.0;

                gl_FragColor = mix(colorA, colorB, uProgress);
            }
        `
    }
};

export default GLITCH_VARIANTS;

