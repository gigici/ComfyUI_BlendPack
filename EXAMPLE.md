# Quick Start: Adding a New Shader

This example shows how to add a new transition effect called "Ripple".

## Step 1: Create the Shader

Create `js/engine/shaders/ripple.glsl.js`:

```javascript
import { SHADER_COMMON } from './common.glsl.js';

export const RIPPLE_VARIANTS = {
    center: {
        uniforms: { uRipples: 5.0, uSpeed: 2.0 },
        description: "Ripple from center",
        fragment: `
            ${SHADER_COMMON}
            uniform float uRipples;
            uniform float uSpeed;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                vec2 center = vec2(0.5, 0.5);
                float dist = length(vUv - center);
                float ripple = sin(dist * uRipples * 20.0 - uTime * uSpeed) * 0.5 + 0.5;
                float threshold = uProgress * 1.5;
                float mask = smoothstep(threshold - 0.1, threshold + 0.1, dist + ripple * 0.2);
                
                gl_FragColor = mix(colorA, colorB, mask);
            }
        `
    },

    horizontal: {
        uniforms: { uWaves: 8.0, uAmplitude: 0.05 },
        description: "Horizontal wave",
        fragment: `
            ${SHADER_COMMON}
            uniform float uWaves;
            uniform float uAmplitude;

            void main() {
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);

                float wave = sin(vUv.y * uWaves * 20.0 + uTime * 2.0) * uAmplitude;
                vec2 distortedUv = vUv + vec2(wave * (1.0 - uProgress), 0.0);
                vec4 distortedB = texture2D(uTexB, distortedUv);
                float mask = smoothstep(uProgress - 0.1, uProgress + 0.1, vUv.x);
                
                gl_FragColor = mix(colorA, distortedB, mask);
            }
        `
    }
};

export default RIPPLE_VARIANTS;
```

## Step 2: Register It

Edit `js/engine/shaders/index.js`:

```javascript
import { RIPPLE_VARIANTS } from './ripple.glsl.js';

export { RIPPLE_VARIANTS };

export const ALL_ENGINES = {
    // ... existing engines
    Ripple: RIPPLE_VARIANTS
};
```

## Step 3: Test

1. Restart ComfyUI
2. Add a BlendJoiner node
3. Select "Ripple" from the engine dropdown
4. Choose "center" or "horizontal" variant
5. Enable Real Preview

That's it. Your new effect is ready to use.

## Tips

- Use `uIntensity` to let users control effect strength
- Use `smoothstep` for smooth edge transitions
- Check browser console for shader compilation errors
- Keep shaders simple for better performance


