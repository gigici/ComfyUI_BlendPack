// NOTE: Keep format. Parsed by Python regex.
/**
 * Morph Engine - Shape-warping transitions
 * 
 * TRANSITION LOGIC:
 * - t=0: Clip A shown normally (uvA = vUv, no distortion)
 * - t=0.5: Maximum morph effect
 * - t=1: Clip B shown normally (uvB = vUv, no distortion)
 * - effectStrength = sin(t * PI) creates 0→1→0 curve
 */

import { SHADER_COMMON } from './common.glsl.js';

export const MORPH_VARIANTS = {
    morph_smooth: {
        uniforms: { uWarpStrength: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uWarpStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                vec2 dir = vUv - center;
                float dist = length(dir);
                
                // Warp amount scales with effectStrength (0 at t=0 and t=1)
                float warp = uWarpStrength * effectStrength;
                vec2 warpOffset = dir * warp * (1.0 - dist);
                
                // A gets less distortion as t increases, B gets more
                vec2 uvA = vUv - warpOffset * (1.0 - t);
                vec2 uvB = vUv - warpOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    morph_warp: {
        uniforms: { uWarpStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uWarpStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Horizontal warp scaled by effectStrength
                float warpAmount = uWarpStrength * effectStrength * 0.2;
                
                // uvA distorted only when t is low, uvB distorted only when t is high
                vec2 uvA = vUv + vec2(warpAmount * (1.0 - t), 0.0);
                vec2 uvB = vUv - vec2(warpAmount * t, 0.0);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    morph_liquify: {
        uniforms: { uDistortStrength: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uDistortStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 p = vUv * 2.0 - 1.0;
                float r = length(p);
                float a = atan(p.y, p.x);
                
                // Radial distortion scaled by effectStrength
                float distort = sin(r * 10.0 - t * 5.0) * uDistortStrength * effectStrength;
                vec2 distortOffset = vec2(cos(a), sin(a)) * distort;
                
                // Apply distortion proportionally
                vec2 uvA = vUv + distortOffset * (1.0 - t);
                vec2 uvB = vUv + distortOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    morph_twist: {
        uniforms: { uTwistAmount: 2.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uTwistAmount;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                vec2 d = vUv - center;
                float dist = length(d);
                
                // Twist angle scales with effectStrength
                float twistAngle = uTwistAmount * effectStrength * (1.0 - smoothstep(0.0, 0.5, dist));
                float s = sin(twistAngle);
                float c = cos(twistAngle);
                
                vec2 twisted = vec2(d.x * c - d.y * s, d.x * s + d.y * c) + center;
                
                // Blend between normal UV and twisted UV
                vec2 uvA = mix(vUv, twisted, effectStrength * (1.0 - t));
                vec2 uvB = mix(vUv, twisted, effectStrength * t);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    morph_bulge: {
        uniforms: { uBulgeStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uBulgeStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                vec2 d = vUv - center;
                float r = length(d);
                
                // Bulge factor scales with effectStrength
                float bulgeFactor = 1.0 - uBulgeStrength * effectStrength * (1.0 - r);
                vec2 bulged = center + d * bulgeFactor;
                
                // Apply bulge proportionally
                vec2 uvA = mix(vUv, bulged, 1.0 - t);
                vec2 uvB = mix(vUv, bulged, t);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    morph_pinch: {
        uniforms: { uPinchStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uPinchStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                vec2 d = vUv - center;
                float r = length(d);
                
                // Pinch (negative bulge)
                float pinchFactor = 1.0 + uPinchStrength * effectStrength * (1.0 - r);
                vec2 pinched = center + d * pinchFactor;
                
                // Apply pinch proportionally
                vec2 uvA = mix(vUv, pinched, 1.0 - t);
                vec2 uvB = mix(vUv, pinched, t);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    morph_wave: {
        uniforms: { uWaveFrequency: 10.0, uWaveAmplitude: 0.05 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uWaveFrequency;
            uniform float uWaveAmplitude;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Wave offset scales with effectStrength
                float wave = sin(vUv.y * uWaveFrequency + t * 10.0) * uWaveAmplitude * effectStrength;
                
                // Apply wave proportionally
                vec2 uvA = vUv + vec2(wave * (1.0 - t), 0.0);
                vec2 uvB = vUv + vec2(wave * t, 0.0);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    morph_ripple: {
        uniforms: { uRippleFrequency: 50.0, uRippleAmplitude: 0.02 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uRippleFrequency;
            uniform float uRippleAmplitude;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                float d = length(vUv - center);
                vec2 dir = normalize(vUv - center + 0.001);
                
                // Ripple offset scales with effectStrength
                float ripple = sin(d * uRippleFrequency - t * 20.0) * uRippleAmplitude * effectStrength;
                vec2 rippleOffset = dir * ripple;
                
                // Apply ripple proportionally
                vec2 uvA = vUv + rippleOffset * (1.0 - t);
                vec2 uvB = vUv + rippleOffset * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    }
};

export default MORPH_VARIANTS;

