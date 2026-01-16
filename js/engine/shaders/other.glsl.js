// NOTE: Keep format. Parsed by Python regex.
/**
 * Other Engine - Artistic & Experimental Transitions
 * Complex, unique shaders that don't fit standard categories
 * 
 * TRANSITION LOGIC:
 * - t=0: Show Clip A normally (no effect)
 * - t=0.5: Maximum effect intensity
 * - t=1: Show Clip B normally (no effect)
 * - bell = sin(t * PI) creates 0→1→0 curve for effect intensity
 */

import { SHADER_COMMON } from './common.glsl.js';

export const OTHER_VARIANTS = {
    /**
     * Kaleidoscope Mirror - Fractal mirror reflections
     * Effect builds up from normal, peaks at middle, returns to normal
     */
    kaleidoscope: {
        uniforms: { uSegments: 6.0, uRotation: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSegments;
            uniform float uRotation;

            void main() {
                vec2 center = vec2(0.5);
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);
                
                // Effect strength: 0 at start/end, 1 at middle
                float effectStrength = bell * uIntensity;
                
                vec2 uv = vUv - center;
                float angle = atan(uv.y, uv.x);
                float radius = length(uv);
                
                // Kaleidoscope only during transition (scaled by effectStrength)
                float segmentAngle = 6.28318 / uSegments;
                float kaleidoAngle = mod(angle + uRotation * effectStrength, segmentAngle);
                kaleidoAngle = abs(kaleidoAngle - segmentAngle * 0.5);
                
                // Blend between normal angle and kaleidoscope angle
                float finalAngle = mix(angle, kaleidoAngle, effectStrength);
                
                vec2 effectUv = vec2(cos(finalAngle), sin(finalAngle)) * radius + center;
                
                // Add rotation during transition (also scaled)
                effectUv = rotate2D(effectUv, center, effectStrength * 0.5);
                
                // Blend UV: at t=0 use vUv, at t=1 use vUv, in between use effect
                vec2 uvA = mix(vUv, effectUv, effectStrength * (1.0 - t));
                vec2 uvB = mix(vUv, effectUv, effectStrength * t);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                // Color shift at edges (only during transition)
                float edgeGlow = smoothstep(0.3, 0.5, radius) * effectStrength * 0.3;
                
                vec4 result = mix(colorA, colorB, t);
                result.rgb += vec3(edgeGlow * 0.5, edgeGlow * 0.3, edgeGlow * 0.8);
                
                gl_FragColor = result;
            }
        `
    },

    /**
     * Liquid Metal - Mercury-like fluid simulation
     */
    liquid_metal: {
        uniforms: { uViscosity: 0.5, uReflectivity: 0.8 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uViscosity;
            uniform float uReflectivity;

            void main() {
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Liquid flow simulation - scales with effect strength
                vec2 flow = vec2(
                    fbm(vUv * 3.0 + uTime * 0.3, 4),
                    fbm(vUv * 3.0 + vec2(100.0) + uTime * 0.3, 4)
                ) - 0.5;
                
                flow *= uViscosity * effectStrength * 0.15;
                
                // At t=0, uvA=vUv (no effect). At t=1, uvB=vUv (no effect)
                vec2 uvA = vUv + flow * (1.0 - t);
                vec2 uvB = vUv - flow * t;
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                // Metallic reflection (only during transition)
                float metallic = fbm(vUv * 8.0 + uTime * 0.5, 3);
                metallic = pow(metallic, 2.0) * uReflectivity * effectStrength;
                
                vec4 result = mix(colorA, colorB, t);
                
                // Add specular highlights
                float specular = pow(max(0.0, metallic - 0.5) * 2.0, 3.0);
                result.rgb += vec3(specular) * 0.5;
                
                // Subtle color separation
                result.r = mix(result.r, texture2D(uTexB, uvB + vec2(0.003, 0.0)).r, metallic * 0.3);
                result.b = mix(result.b, texture2D(uTexA, uvA - vec2(0.003, 0.0)).b, metallic * 0.3);
                
                gl_FragColor = result;
            }
        `
    },

    /**
     * Neon Dreams - Cyberpunk-style neon glow transitions
     */
    neon_dreams: {
        uniforms: { uGlowIntensity: 1.0, uNeonColor: [1.0, 0.2, 0.8] },
        fragment: `
            ${SHADER_COMMON}
            uniform float uGlowIntensity;
            uniform vec3 uNeonColor;

            void main() {
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                // Edge detection for neon outline
                float edgeStrength = 0.0;
                vec4 currentTex = mix(colorA, colorB, t);
                for (float i = 0.0; i < 4.0; i++) {
                    float angle = i * 1.5708;
                    vec2 offset = vec2(cos(angle), sin(angle)) * 0.005;
                    float sample1 = luminance(mix(
                        texture2D(uTexA, vUv + offset),
                        texture2D(uTexB, vUv + offset),
                        t
                    ).rgb);
                    float sample2 = luminance(mix(
                        texture2D(uTexA, vUv - offset),
                        texture2D(uTexB, vUv - offset),
                        t
                    ).rgb);
                    edgeStrength += abs(sample1 - sample2);
                }
                edgeStrength = smoothstep(0.1, 0.4, edgeStrength);
                
                // Scan line effect
                float scanline = sin(vUv.y * 200.0 + uTime * 10.0) * 0.5 + 0.5;
                scanline = pow(scanline, 8.0);
                
                vec4 result = mix(colorA, colorB, t);
                
                // Add neon glow (scaled by effectStrength)
                vec3 neonGlow = uNeonColor * edgeStrength * effectStrength * uGlowIntensity;
                result.rgb += neonGlow;
                
                // Scanline overlay
                result.rgb += scanline * 0.05 * effectStrength;
                
                // Chromatic aberration at edges
                float aberration = effectStrength * 0.008;
                result.r = mix(result.r, texture2D(uTexB, vUv + vec2(aberration, 0.0)).r, t * edgeStrength * effectStrength);
                result.b = mix(result.b, texture2D(uTexA, vUv - vec2(aberration, 0.0)).b, (1.0 - t) * edgeStrength * effectStrength);
                
                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    /**
     * Paint Splatter - Artistic watercolor splash effect
     */
    paint_splatter: {
        uniforms: { uSplatterSize: 0.5, uDrip: 0.3 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uSplatterSize;
            uniform float uDrip;

            void main() {
                float t = uProgress;
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Create organic splatter pattern
                float splatter = 0.0;
                for (float i = 0.0; i < 5.0; i++) {
                    vec2 center = vec2(
                        hash(vec2(i * 1.3, 0.7)),
                        hash(vec2(0.3, i * 1.7))
                    );
                    
                    float radius = 0.1 + hash(vec2(i, i * 0.5)) * uSplatterSize * 0.3;
                    float dist = length(vUv - center);
                    
                    float edgeNoise = fbm(vUv * 20.0 + i * 10.0, 3) * 0.3;
                    float blob = 1.0 - smoothstep(radius - 0.05 + edgeNoise, radius + edgeNoise, dist);
                    
                    splatter = max(splatter, blob * hash(vec2(i * 2.3, i)));
                }
                
                // Dripping effect
                float drip = fbm(vec2(vUv.x * 10.0, vUv.y * 2.0 - uTime * 0.5), 4);
                drip = smoothstep(0.4, 0.6, drip) * uDrip * effectStrength;
                
                // Mask reveals B through A based on progress
                float revealProgress = t * 2.0; // Speed up reveal
                float mask = (splatter + drip) * revealProgress;
                mask = smoothstep(0.2, 0.8, mask);
                mask = clamp(mask, 0.0, 1.0);
                
                // Ensure clean start and end
                mask = mix(0.0, mask, smoothstep(0.0, 0.1, t));
                mask = mix(mask, 1.0, smoothstep(0.9, 1.0, t));
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                // Paper texture simulation
                float paper = noise(vUv * 100.0) * 0.1 * effectStrength;
                
                vec4 result = mix(colorA, colorB, mask);
                result.rgb += paper;
                
                gl_FragColor = result;
            }
        `
    },

    /**
     * Glass Shatter - Breaking glass effect with flying shards
     */
    glass_shatter: {
        uniforms: { uShardCount: 20.0, uExplosion: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uShardCount;
            uniform float uExplosion;

            void main() {
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Voronoi-based shard pattern
                vec2 cellUv = vUv * uShardCount;
                vec2 cellId = floor(cellUv);
                vec2 cellFract = fract(cellUv);
                
                float minDist = 1.0;
                vec2 closestPoint = vec2(0.0);
                
                for (int y = -1; y <= 1; y++) {
                    for (int x = -1; x <= 1; x++) {
                        vec2 neighbor = vec2(float(x), float(y));
                        vec2 point = vec2(
                            hash(cellId + neighbor),
                            hash(cellId + neighbor + vec2(17.0, 31.0))
                        );
                        vec2 diff = neighbor + point - cellFract;
                        float dist = length(diff);
                        if (dist < minDist) {
                            minDist = dist;
                            closestPoint = cellId + neighbor + point;
                        }
                    }
                }
                
                // Each shard offset scaled by effectStrength (0 at start/end)
                float shardHash = hash(closestPoint);
                vec2 shardOffset = (vec2(hash(closestPoint + 1.0), hash(closestPoint + 2.0)) - 0.5) * 2.0;
                shardOffset *= uExplosion * effectStrength * 0.3;
                
                float shardRotation = (shardHash - 0.5) * effectStrength * 0.5;
                
                vec2 shardUv = vUv - shardOffset;
                shardUv = rotate2D(shardUv, closestPoint / uShardCount, shardRotation);
                
                // At t=0, use vUv. At t=1, use vUv. In between, use shardUv
                vec2 uvA = mix(vUv, shardUv, effectStrength * (1.0 - t));
                vec2 uvB = mix(vUv, shardUv, effectStrength * t);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                // Crack lines
                float crack = smoothstep(0.02, 0.0, minDist) * effectStrength;
                
                vec4 result = mix(colorA, colorB, t);
                result.rgb += crack * 0.3;
                
                // Refraction at cracks
                float refract = crack * 0.02;
                result.r = mix(result.r, texture2D(uTexB, vUv + vec2(refract, 0.0)).r, crack * 0.5);
                
                gl_FragColor = result;
            }
        `
    },

    /**
     * Aurora Borealis - Northern lights flowing effect
     */
    aurora: {
        uniforms: { uFlowSpeed: 1.0, uWaveCount: 3.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uFlowSpeed;
            uniform float uWaveCount;

            void main() {
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                // Aurora wave pattern
                float aurora = 0.0;
                for (float i = 0.0; i < 3.0; i++) {
                    float wave = sin(vUv.x * 6.28318 * (i + 1.0) + uTime * uFlowSpeed * (1.0 + i * 0.3));
                    wave += fbm(vec2(vUv.x * 5.0 + uTime * 0.2, i), 3) * 0.5;
                    wave = wave * 0.5 + 0.5;
                    
                    float mask = smoothstep(0.3 + i * 0.15, 0.35 + i * 0.15, vUv.y + wave * 0.2);
                    mask *= smoothstep(0.5 + i * 0.15, 0.45 + i * 0.15, vUv.y + wave * 0.2);
                    
                    aurora += mask * (1.0 - i * 0.3);
                }
                
                // Scale aurora by effectStrength (0 at start/end)
                aurora *= effectStrength;
                
                // Aurora colors
                vec3 auroraColor = mix(
                    vec3(0.1, 0.8, 0.3),
                    vec3(0.5, 0.2, 0.8),
                    vUv.y + sin(vUv.x * 3.0 + uTime) * 0.2
                );
                
                vec4 result = mix(colorA, colorB, t);
                result.rgb += auroraColor * aurora * 0.4;
                result.rgb += aurora * 0.1;
                
                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    /**
     * Ink in Water - Fluid ink dispersion simulation
     */
    ink_in_water: {
        uniforms: { uDispersion: 0.5, uInkColor: [0.1, 0.05, 0.2] },
        fragment: `
            ${SHADER_COMMON}
            uniform float uDispersion;
            uniform vec3 uInkColor;

            void main() {
                float t = uProgress;
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                float dist = length(vUv - center);
                
                // Organic flow
                float flow = fbm(vUv * 4.0 + uTime * 0.2, 5);
                float flow2 = fbm(vUv * 8.0 - uTime * 0.15, 4);
                
                // Ink reveal mask - progresses with t
                float revealRadius = t * 1.2;
                float inkMask = smoothstep(revealRadius, revealRadius - 0.2, dist + (flow - 0.5) * uDispersion * 0.5);
                
                // Add wispy edges
                float tendril = fbm(vec2(atan(vUv.y - 0.5, vUv.x - 0.5) * 3.0, dist * 5.0 - uTime), 4);
                tendril = smoothstep(0.4, 0.6, tendril);
                inkMask = max(inkMask, tendril * effectStrength * 0.5 * t);
                
                // Clean start (t=0) and end (t=1)
                inkMask = clamp(inkMask, 0.0, 1.0);
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                vec4 result = mix(colorA, colorB, inkMask);
                
                // Add ink color at edges (only during transition)
                float inkEdge = smoothstep(0.3, 0.5, inkMask) * (1.0 - smoothstep(0.5, 0.7, inkMask));
                result.rgb = mix(result.rgb, uInkColor, inkEdge * effectStrength * 0.5);
                
                gl_FragColor = result;
            }
        `
    },

    /**
     * Digital Corruption - Data moshing glitch art
     */
    digital_corruption: {
        uniforms: { uCorruptionLevel: 0.5, uBlockSize: 8.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uCorruptionLevel;
            uniform float uBlockSize;

            void main() {
                float t = uProgress;
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                // Block-based corruption
                vec2 blockUv = floor(vUv * uBlockSize) / uBlockSize;
                float blockHash = hash(blockUv + floor(uTime * 10.0));
                
                // Corruption only active during transition, scaled by effectStrength
                float corrupted = step(1.0 - uCorruptionLevel * effectStrength, blockHash);
                
                // Corrupt block offset
                vec2 corruptOffset = vec2(
                    (hash(blockUv * 2.0) - 0.5) * 0.2,
                    (hash(blockUv * 3.0) - 0.5) * 0.1
                ) * corrupted * effectStrength;
                
                float channelShift = corrupted * effectStrength * 0.03;
                
                vec2 uvR = vUv + corruptOffset + vec2(channelShift, 0.0);
                vec2 uvG = vUv + corruptOffset;
                vec2 uvB = vUv + corruptOffset - vec2(channelShift, 0.0);
                
                vec4 colorA, colorB;
                
                colorA.r = texture2D(uTexA, uvR).r;
                colorA.g = texture2D(uTexA, uvG).g;
                colorA.b = texture2D(uTexB, uvB).b;
                colorA.a = 1.0;
                
                colorB.r = texture2D(uTexB, uvR).r;
                colorB.g = texture2D(uTexB, uvG).g;
                colorB.b = texture2D(uTexB, uvB).b;
                colorB.a = 1.0;
                
                // Wrong frame mixing
                float wrongFrame = step(0.8, hash(blockUv + 100.0)) * corrupted * effectStrength;
                
                vec4 result = mix(colorA, colorB, t);
                result = mix(result, colorA, wrongFrame * (1.0 - t));
                
                // Digital noise (scaled by effectStrength)
                float noise = (hash(vUv * uResolution + uTime) - 0.5) * corrupted * 0.15;
                result.rgb += noise;
                
                // Quantization
                float quant = 32.0 - corrupted * effectStrength * 24.0;
                result.rgb = floor(result.rgb * quant) / quant;
                
                gl_FragColor = result;
            }
        `
    },

    /**
     * Firefly Dance - Magical particle trail effect
     */
    firefly_dance: {
        uniforms: { uParticleCount: 30.0, uGlowRadius: 0.1 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uParticleCount;
            uniform float uGlowRadius;

            void main() {
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec4 colorA = texture2D(uTexA, vUv);
                vec4 colorB = texture2D(uTexB, vUv);
                
                // Generate firefly particles
                float glow = 0.0;
                vec3 fireflyColor = vec3(0.0);
                
                for (float i = 0.0; i < 30.0; i++) {
                    if (i >= uParticleCount) break;
                    
                    float seed = i * 1.618;
                    vec2 basePos = vec2(
                        hash(vec2(seed, 0.0)),
                        hash(vec2(0.0, seed))
                    );
                    
                    float angle = uTime * (0.5 + hash(vec2(seed, seed)) * 0.5) + seed * 6.28;
                    float radius = 0.05 + hash(vec2(seed * 2.0, seed)) * 0.1;
                    vec2 offset = vec2(cos(angle), sin(angle)) * radius;
                    
                    vec2 particlePos = basePos + offset;
                    float dist = length(vUv - particlePos);
                    
                    float pulse = sin(uTime * 3.0 + seed * 10.0) * 0.5 + 0.5;
                    // Scale by effectStrength so particles fade in/out with transition
                    float particleGlow = smoothstep(uGlowRadius, 0.0, dist) * pulse * effectStrength;
                    
                    glow += particleGlow;
                    
                    vec3 pColor = mix(
                        vec3(1.0, 0.9, 0.4),
                        vec3(0.4, 0.8, 1.0),
                        hash(vec2(seed * 3.0, 0.0))
                    );
                    fireflyColor += pColor * particleGlow;
                }
                
                vec4 result = mix(colorA, colorB, t);
                result.rgb += fireflyColor * 0.5;
                result.rgb += glow * 0.1;
                
                gl_FragColor = clamp(result, 0.0, 1.0);
            }
        `
    },

    /**
     * Crystal Refraction - Gemstone-like light bending
     */
    crystal_refraction: {
        uniforms: { uFacets: 6.0, uRefractStrength: 0.5 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uFacets;
            uniform float uRefractStrength;

            void main() {
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                vec2 uv = vUv - center;
                
                float angle = atan(uv.y, uv.x);
                float facetAngle = 6.28318 / uFacets;
                float facet = floor((angle + 3.14159) / facetAngle);
                
                float facetHash = hash(vec2(facet, 0.0));
                vec2 refractDir = vec2(
                    cos(facet * facetAngle + facetHash),
                    sin(facet * facetAngle + facetHash)
                ) * uRefractStrength * effectStrength * 0.05;
                
                float dist = length(uv);
                refractDir *= smoothstep(0.0, 0.3, dist);
                
                // At t=0, uvA=vUv. At t=1, uvB=vUv
                vec2 uvA = vUv + refractDir * (1.0 - t);
                vec2 uvB = vUv - refractDir * t;
                
                vec4 colorA, colorB;
                float chromatic = effectStrength * 0.01;
                
                colorA.r = texture2D(uTexA, uvA + refractDir * 0.5 * effectStrength).r;
                colorA.g = texture2D(uTexA, uvA).g;
                colorA.b = texture2D(uTexA, uvA - refractDir * 0.5 * effectStrength).b;
                colorA.a = 1.0;
                
                colorB.r = texture2D(uTexB, uvB + refractDir * 0.5 * effectStrength).r;
                colorB.g = texture2D(uTexB, uvB).g;
                colorB.b = texture2D(uTexB, uvB - refractDir * 0.5 * effectStrength).b;
                colorB.a = 1.0;
                
                float edgeAngle = mod(angle + 3.14159, facetAngle);
                float edge = smoothstep(0.02, 0.0, min(edgeAngle, facetAngle - edgeAngle)) * dist;
                
                vec4 result = mix(colorA, colorB, t);
                result.rgb += edge * effectStrength * 0.3;
                
                float innerGlow = (1.0 - smoothstep(0.0, 0.4, dist)) * effectStrength * 0.15;
                result.rgb += innerGlow;
                
                gl_FragColor = result;
            }
        `
    },

    /**
     * Temporal Echo - Time-layered ghost images
     */
    temporal_echo: {
        uniforms: { uEchoCount: 4.0, uDecay: 0.7 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uEchoCount;
            uniform float uDecay;

            void main() {
                float t = uProgress;
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec4 result = vec4(0.0);
                float totalWeight = 0.0;
                
                for (float i = 0.0; i < 5.0; i++) {
                    if (i >= uEchoCount) break;
                    
                    // Echo time offset scaled by effectStrength
                    float echoT = t - i * 0.15 * effectStrength;
                    echoT = clamp(echoT, 0.0, 1.0);
                    
                    // Each echo offset also scaled by effectStrength
                    vec2 echoOffset = vec2(
                        sin(i * 1.5 + uTime) * 0.02,
                        cos(i * 2.1 + uTime) * 0.01
                    ) * effectStrength * i;
                    
                    vec2 echoUv = vUv + echoOffset;
                    
                    vec4 colorA = texture2D(uTexA, echoUv);
                    vec4 colorB = texture2D(uTexB, echoUv);
                    
                    float weight = pow(uDecay, i);
                    result += mix(colorA, colorB, echoT) * weight;
                    totalWeight += weight;
                }
                
                result /= totalWeight;
                
                // Color shift scaled by effectStrength
                result.r *= 1.0 + effectStrength * 0.1;
                result.b *= 1.0 - effectStrength * 0.05;
                
                gl_FragColor = result;
            }
        `
    },

    /**
     * Quantum Tunnel - Sci-fi portal/wormhole effect
     */
    quantum_tunnel: {
        uniforms: { uTunnelDepth: 1.0, uRotationSpeed: 1.0 },
        fragment: `
            ${SHADER_COMMON}
            uniform float uTunnelDepth;
            uniform float uRotationSpeed;

            void main() {
                float t = easeInOutCubic(uProgress);
                float bell = sin(uProgress * 3.14159265);
                float effectStrength = bell * uIntensity;
                
                vec2 center = vec2(0.5);
                vec2 uv = vUv - center;
                float dist = length(uv);
                float angle = atan(uv.y, uv.x);
                
                // Tunnel spiral - scales with effectStrength
                float spiral = angle + dist * uTunnelDepth * effectStrength * 5.0 + uTime * uRotationSpeed;
                
                // Radial waves
                float wave = sin(dist * 30.0 - uTime * 5.0) * effectStrength * 0.02;
                
                // Blend between normal UV and tunnel UV
                vec2 tunnelUv = center + vec2(cos(spiral), sin(spiral)) * (dist + wave);
                
                vec2 uvA = mix(vUv, tunnelUv, effectStrength * (1.0 - t));
                vec2 uvB = mix(vUv, tunnelUv, effectStrength * t);
                
                vec4 colorA = texture2D(uTexA, uvA);
                vec4 colorB = texture2D(uTexB, uvB);
                
                vec4 result = mix(colorA, colorB, t);
                
                // Center glow
                float glow = (1.0 - smoothstep(0.0, 0.3, dist)) * effectStrength * 0.3;
                result.rgb += vec3(0.3, 0.5, 1.0) * glow;
                
                // Edge darkening
                float vignette = smoothstep(0.5, 0.3, dist);
                result.rgb *= mix(1.0, vignette, effectStrength * 0.5);
                
                gl_FragColor = result;
            }
        `
    }
};

export default OTHER_VARIANTS;

