// NOTE: Keep format. Parsed by Python regex.
/**
 * ShutterMotion Engine - Camera/shutter-based transitions
 * 
 * TRANSITION LOGIC:
 * - t=0: Clip A shown normally
 * - t=0.5: Maximum shutter/motion effect
 * - t=1: Clip B shown normally
 * - effectStrength = sin(t * PI) creates 0→1→0 curve
 */

import { SHADER_COMMON } from './common.glsl.js';

export const SHUTTER_VARIANTS = {
    directional_smear: {
        uniforms: { uSmearStrength: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSmearStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Motion blur amount scales with effectStrength
                float blur = uSmearStrength * effectStrength;
                
                vec4 sum = vec4(0.0);
                float total = 0.0;
                
                for(float i = -4.0; i <= 4.0; i++) {
                    vec2 offset = vec2(i * blur * 0.1, 0.0);
                    float weight = 1.0 - abs(i) / 5.0;
                    
                    vec4 colorA = texture2D(uTexA, vUv + offset);
                    vec4 colorB = texture2D(uTexB, vUv + offset);
                    
                    sum += mix(colorA, colorB, t) * weight;
                    total += weight;
                }
                
                gl_FragColor = sum / total;
            }
        `
    },

    frame_echo: {
        uniforms: { uEchoStrength: 0.3 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uEchoStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Echo frame at quantized time
                float echo = floor(t * 5.0) / 5.0;
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                vec4 color = mix(colorA, colorB, t);
                vec4 echoColor = mix(colorA, colorB, echo);
                
                // Echo blend scales with effectStrength
                gl_FragColor = mix(color, echoColor, uEchoStrength * effectStrength);
            }
        `
    },

    time_ghost: {
        uniforms: { uGhostStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uGhostStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                vec4 currentColor = mix(colorA, colorB, t);
                
                // Delayed ghost frame
                float t2 = clamp(t - 0.1, 0.0, 1.0);
                vec4 ghostColor = mix(colorA, colorB, t2);
                
                // Ghost blend scales with effectStrength
                float ghostAlpha = uGhostStrength * effectStrength;
                gl_FragColor = mix(currentColor, ghostColor, ghostAlpha);
            }
        `
    },

    shutter_strobe_soft: {
        uniforms: { uStrobeSpeed: 20.0, uStrobeStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uStrobeSpeed;
            uniform float uStrobeStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Strobe effect scales with effectStrength
                float strobe = abs(sin(t * uStrobeSpeed));
                float brightness = 1.0 + strobe * uStrobeStrength * effectStrength;
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                vec4 color = mix(colorA, colorB, t);
                color.rgb *= brightness;
                
                gl_FragColor = clamp(color, 0.0, 1.0);
            }
        `
    },

    micro_zoom_push: {
        uniforms: { uZoomStrength: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uZoomStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                
                // Zoom scales with effectStrength (1.0 at t=0/1)
                float zoom = 1.0 - uZoomStrength * effectStrength;
                vec2 zoomedUv = center + (vUv - center) * zoom;
                
                vec4 colorA = texture2D(uTexA, zoomedUv);
                vec4 colorB = texture2D(uTexB, zoomedUv);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    micro_parallax_fake: {
        uniforms: { uParallaxStrength: 0.05 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uParallaxStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Parallax offset scales with effectStrength
                float offset = uParallaxStrength * effectStrength;
                
                // A moves right as it fades, B moves left as it appears
                vec2 uvA = vUv + vec2(offset * t, 0.0);
                vec2 uvB = vUv - vec2(offset * (1.0 - t), 0.0);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                gl_FragColor = mix(colorA, colorB, t);
            }
        `
    },

    velocity_blur_fake: {
        uniforms: { uVelocityStrength: 0.05 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uVelocityStrength;

            void main() {
                float t = uProgress;
                float bell = sin(t * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 dir = normalize(vUv - 0.5 + 0.001);
                
                // Velocity blur scales with effectStrength
                float blur = uVelocityStrength * effectStrength;
                
                vec4 sum = vec4(0.0);
                float total = 0.0;
                
                for(float i = 0.0; i < 5.0; i++) {
                    vec2 offset = dir * blur * (i / 5.0);
                    vec4 colorA = texture2D(uTexA, vUv + offset);
                    vec4 colorB = texture2D(uTexB, vUv + offset);
                    sum += mix(colorA, colorB, t);
                    total += 1.0;
                }
                
                gl_FragColor = sum / total;
            }
        `
    },

    easing_snap: {
        uniforms: {},
        fragment: `
            ${SHADER_COMMON}

            void main() {
                float t = uProgress;
                
                // Sharp easing for snappy transition
                float snapT = easeInOutExpo(t);
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                gl_FragColor = mix(colorA, colorB, snapT);
            }
        `
    }
};

export default SHUTTER_VARIANTS;

