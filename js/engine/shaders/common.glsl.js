// NOTE: Keep format. Parsed by Python regex.


export const VERTEX_SHADER = `
    attribute vec2 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vUv;

    void main() {
        vUv = aTexCoord;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`;

export const FRAGMENT_HEADER = `
    precision highp float;

    uniform sampler2D uTexA;
    uniform sampler2D uTexB;
    uniform float uProgress;
    uniform float uIntensity;
    uniform float uTime;
    uniform vec2 uResolution;

    varying vec2 vUv;
`;

export const EASING_FUNCTIONS = `
    float easeLinear(float t) {
        return t;
    }

    float easeInQuad(float t) {
        return t * t;
    }

    float easeOutQuad(float t) {
        return 1.0 - (1.0 - t) * (1.0 - t);
    }

    float easeInOutQuad(float t) {
        return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0;
    }

    float easeInCubic(float t) {
        return t * t * t;
    }

    float easeOutCubic(float t) {
        return 1.0 - pow(1.0 - t, 3.0);
    }

    float easeInOutCubic(float t) {
        return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
    }

    float easeInSine(float t) {
        return 1.0 - cos(t * 3.14159265 / 2.0);
    }

    float easeOutSine(float t) {
        return sin(t * 3.14159265 / 2.0);
    }

    float easeInOutSine(float t) {
        return -(cos(3.14159265 * t) - 1.0) / 2.0;
    }

    float easeInExpo(float t) {
        return t == 0.0 ? 0.0 : pow(2.0, 10.0 * t - 10.0);
    }

    float easeOutExpo(float t) {
        return t == 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t);
    }

    float easeInOutExpo(float t) {
        if (t == 0.0) return 0.0;
        if (t == 1.0) return 1.0;
        if (t < 0.5) return pow(2.0, 20.0 * t - 10.0) / 2.0;
        return (2.0 - pow(2.0, -20.0 * t + 10.0)) / 2.0;
    }

    float easeOutElastic(float t) {
        if (t == 0.0) return 0.0;
        if (t == 1.0) return 1.0;
        float c4 = (2.0 * 3.14159265) / 3.0;
        return pow(2.0, -10.0 * t) * sin((t * 10.0 - 0.75) * c4) + 1.0;
    }

    float easeOutBounce(float t) {
        float n1 = 7.5625;
        float d1 = 2.75;
        if (t < 1.0 / d1) return n1 * t * t;
        if (t < 2.0 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
        if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
        t -= 2.625 / d1;
        return n1 * t * t + 0.984375;
    }
`;

export const NOISE_FUNCTIONS = `

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float hash3(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    }


    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f); // Smoothstep

        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));

        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }


    float fbm(vec2 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;

        for (int i = 0; i < 8; i++) {
            if (i >= octaves) break;
            value += amplitude * noise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return value;
    }


    float snoise(vec2 p) {
        const float K1 = 0.366025404; // (sqrt(3)-1)/2
        const float K2 = 0.211324865; // (3-sqrt(3))/6

        vec2 i = floor(p + (p.x + p.y) * K1);
        vec2 a = p - i + (i.x + i.y) * K2;
        float m = step(a.y, a.x);
        vec2 o = vec2(m, 1.0 - m);
        vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0 * K2;

        vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
        vec3 n = h * h * h * h * vec3(dot(a, vec2(hash(i) - 0.5, hash(i + vec2(1.0, 0.0)) - 0.5)),
                                        dot(b, vec2(hash(i + o) - 0.5, hash(i + o + vec2(1.0, 0.0)) - 0.5)),
                                        dot(c, vec2(hash(i + 1.0) - 0.5, hash(i + 1.0 + vec2(1.0, 0.0)) - 0.5)));
        return dot(n, vec3(70.0));
    }


    float voronoi(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);

        float minDist = 1.0;

        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec2 neighbor = vec2(float(x), float(y));
                vec2 point = vec2(hash(i + neighbor), hash(i + neighbor + vec2(17.0, 31.0)));
                vec2 diff = neighbor + point - f;
                float dist = length(diff);
                minDist = min(minDist, dist);
            }
        }
        return minDist;
    }


    vec2 worley(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);

        float d1 = 1.0;
        float d2 = 1.0;

        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec2 neighbor = vec2(float(x), float(y));
                vec2 point = vec2(hash(i + neighbor), hash(i + neighbor + vec2(17.0, 31.0)));
                float dist = length(neighbor + point - f);

                if (dist < d1) {
                    d2 = d1;
                    d1 = dist;
                } else if (dist < d2) {
                    d2 = dist;
                }
            }
        }
        return vec2(d1, d2);
    }
`;

export const COLOR_FUNCTIONS = `

    vec3 rgb2hsl(vec3 c) {
        float maxc = max(max(c.r, c.g), c.b);
        float minc = min(min(c.r, c.g), c.b);
        float l = (maxc + minc) / 2.0;
        float s = 0.0;
        float h = 0.0;

        if (maxc != minc) {
            float d = maxc - minc;
            s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);

            if (maxc == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
            else if (maxc == c.g) h = (c.b - c.r) / d + 2.0;
            else h = (c.r - c.g) / d + 4.0;
            h /= 6.0;
        }
        return vec3(h, s, l);
    }


    float hue2rgb(float p, float q, float t) {
        if (t < 0.0) t += 1.0;
        if (t > 1.0) t -= 1.0;
        if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
        if (t < 1.0/2.0) return q;
        if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
        return p;
    }

    vec3 hsl2rgb(vec3 hsl) {
        float h = hsl.x;
        float s = hsl.y;
        float l = hsl.z;

        if (s == 0.0) return vec3(l);

        float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
        float p = 2.0 * l - q;
        return vec3(
            hue2rgb(p, q, h + 1.0/3.0),
            hue2rgb(p, q, h),
            hue2rgb(p, q, h - 1.0/3.0)
        );
    }


    float luminance(vec3 c) {
        return dot(c, vec3(0.299, 0.587, 0.114));
    }


    vec3 adjustContrast(vec3 c, float contrast) {
        return (c - 0.5) * contrast + 0.5;
    }


    vec3 adjustSaturation(vec3 c, float saturation) {
        float lum = luminance(c);
        return mix(vec3(lum), c, saturation);
    }
`;

export const BLEND_FUNCTIONS = `

    vec3 blendNormal(vec3 base, vec3 blend) {
        return blend;
    }

    vec3 blendMultiply(vec3 base, vec3 blend) {
        return base * blend;
    }

    vec3 blendScreen(vec3 base, vec3 blend) {
        return 1.0 - (1.0 - base) * (1.0 - blend);
    }

    vec3 blendOverlay(vec3 base, vec3 blend) {
        return vec3(
            base.r < 0.5 ? (2.0 * base.r * blend.r) : (1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r)),
            base.g < 0.5 ? (2.0 * base.g * blend.g) : (1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g)),
            base.b < 0.5 ? (2.0 * base.b * blend.b) : (1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b))
        );
    }

    vec3 blendSoftLight(vec3 base, vec3 blend) {
        return mix(
            sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
            2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
            step(0.5, blend)
        );
    }

    vec3 blendHardLight(vec3 base, vec3 blend) {
        return blendOverlay(blend, base);
    }

    vec3 blendDifference(vec3 base, vec3 blend) {
        return abs(base - blend);
    }

    vec3 blendAdd(vec3 base, vec3 blend) {
        return min(base + blend, 1.0);
    }

    vec3 blendLighten(vec3 base, vec3 blend) {
        return max(base, blend);
    }

    vec3 blendDarken(vec3 base, vec3 blend) {
        return min(base, blend);
    }
`;

export const UTILITY_FUNCTIONS = `

    vec2 rotate2D(vec2 p, vec2 center, float angle) {
        vec2 d = p - center;
        float c = cos(angle);
        float s = sin(angle);
        return vec2(d.x * c - d.y * s, d.x * s + d.y * c) + center;
    }


    vec2 scale2D(vec2 p, vec2 center, float scale) {
        return (p - center) / scale + center;
    }


    vec2 warpUV(vec2 uv, vec2 center, float amount) {
        vec2 d = uv - center;
        float dist = length(d);
        float warp = 1.0 + amount * (1.0 - dist);
        return center + d * warp;
    }


    vec2 barrelDistort(vec2 uv, float k) {
        vec2 centered = uv - 0.5;
        float r2 = dot(centered, centered);
        float distortion = 1.0 + k * r2;
        return centered * distortion + 0.5;
    }


    vec2 swirl(vec2 uv, vec2 center, float amount, float radius) {
        vec2 d = uv - center;
        float dist = length(d);
        float angle = amount * smoothstep(radius, 0.0, dist);
        return rotate2D(uv, center, angle);
    }


    vec2 ripple(vec2 uv, vec2 center, float frequency, float amplitude, float time) {
        vec2 d = uv - center;
        float dist = length(d);
        float offset = sin(dist * frequency - time) * amplitude;
        return uv + normalize(d) * offset;
    }


    float bell(float t) {
        return sin(t * 3.14159265);
    }


    float threshold(float value, float thresh, float softness) {
        return smoothstep(thresh - softness, thresh + softness, value);
    }


    float vignette(vec2 uv, float radius, float softness) {
        float dist = length(uv - 0.5);
        return 1.0 - smoothstep(radius - softness, radius + softness, dist);
    }
`;


export const SHADER_COMMON = `
    ${FRAGMENT_HEADER}
    ${EASING_FUNCTIONS}
    ${NOISE_FUNCTIONS}
    ${COLOR_FUNCTIONS}
    ${BLEND_FUNCTIONS}
    ${UTILITY_FUNCTIONS}
`;


export const CROSSFADE_SHADER = `
    ${SHADER_COMMON}

    void main() {
        vec4 colorA = texture2D(uTexA, vUv);
        vec4 colorB = texture2D(uTexB, vUv);
        float t = easeInOutCubic(uProgress);
        gl_FragColor = mix(colorA, colorB, t);
    }
`;

