import moderngl
import numpy as np
import torch
import re
from pathlib import Path

try:
    import cv2
    _CV2_AVAILABLE = True
except ImportError:
    _CV2_AVAILABLE = False

class ShaderLoader:
    @staticmethod
    def load_all_shaders() -> dict:
        shaders = {}
        shader_dir = Path(__file__).parent / "js" / "engine" / "shaders"
        
        if not shader_dir.exists():
            print(f"[ShaderLoader] ERROR: Shader directory NOT FOUND at {shader_dir}")
            return shaders
        
        common_glsl = ShaderLoader.get_common_glsl_code()
        
        for glsl_file in shader_dir.glob("*.glsl.js"):
            if glsl_file.name == "common.glsl.js" or glsl_file.name == "index.js":
                continue
            
            try:
                engine_shaders = ShaderLoader._parse_shader_file(glsl_file, common_glsl)
                shaders.update(engine_shaders)
            except Exception as e:
                print(f"[ShaderLoader] ERROR: Failed to parse {glsl_file.name}: {e}")
        
        return shaders
    
    @staticmethod
    def get_common_glsl_code() -> str:
        shader_dir = Path(__file__).parent / "js" / "engine" / "shaders"
        common_file = shader_dir / "common.glsl.js"
        
        if not common_file.exists():
            return ""
        
        content = common_file.read_text(encoding='utf-8')
        
        # Parse all exported constants: export const NAME = `VALUE`;
        exports = {}
        pattern = r"export\s+const\s+(\w+)\s*=\s*`([^`]+)`"
        for match in re.finditer(pattern, content, re.DOTALL):
            name = match.group(1)
            val = match.group(2)
            exports[name] = val
        
        # Function to recursively resolve dependencies
        def resolve(text, stack=None):
            if stack is None: stack = set()
            
            # Find all ${VAR} patterns
            placeholders = re.findall(r"\$\{([A-Z_]+)\}", text)
            
            result = text
            for ph in placeholders:
                if ph in exports:
                    if ph in stack: continue # avoid cycles
                    stack.add(ph)
                    replacement = resolve(exports[ph], stack)
                    result = result.replace(f"${{{ph}}}", replacement)
                    stack.remove(ph)
            
            return result
        
        # We start with SHADER_COMMON if it exists, otherwise concat all unique contents
        if "SHADER_COMMON" in exports:
            return resolve(exports["SHADER_COMMON"])
        
        # Fallback: manually construct if SHADER_COMMON is missing
        parts = []
        for key in ["FRAGMENT_HEADER", "EASING_FUNCTIONS", "NOISE_FUNCTIONS", "COLOR_FUNCTIONS", "BLEND_FUNCTIONS", "UTILITY_FUNCTIONS"]:
            if key in exports:
                parts.append(resolve(exports[key]))
                
        return "\n".join(parts)
    
    @staticmethod
    def _find_js_block(content: str, start_index: int) -> str:
        if start_index == -1: return ""
        open_brace = content.find('{', start_index)
        if open_brace == -1: return ""
        balance = 1
        current = open_brace + 1
        length = len(content)
        while current < length:
            char = content[current]
            if char in ("'", '"', "`"):
                quote = char
                current += 1
                while current < length:
                    if content[current] == quote and content[current-1] != '\\':
                        break
                    current += 1
            elif char == '{':
                balance += 1
            elif char == '}':
                balance -= 1
                if balance == 0:
                    return content[open_brace+1:current]
            current += 1
        return ""

    @staticmethod
    def _parse_shader_file(file_path: Path, common_glsl: str) -> dict:
        shaders = {}
        content = file_path.read_text(encoding='utf-8')
        base_engine_name = file_path.stem.replace('.glsl', '')
        
        engine_export_pattern = r"export\s+const\s+(\w+)_(SHADERS|VARIANTS)\s*="
        
        for match in re.finditer(engine_export_pattern, content):
            engine_name = match.group(1).lower()
            block_content = ShaderLoader._find_js_block(content, match.end())
            
            if block_content:
                makeshader_pattern = r"(\w+):\s*makeShader\s*\(\s*`([^`]+)`\s*\)"
                for vs_match in re.finditer(makeshader_pattern, block_content, re.DOTALL):
                    v_name = vs_match.group(1)
                    s_body = vs_match.group(2)
                    v_name_clean = v_name[len(engine_name)+1:] if v_name.lower().startswith(f"{engine_name}_") else v_name
                    fragment_code = f"void main() {{\n{s_body}\n}}"
                    shaders[f"{engine_name}_{v_name_clean}"] = {'fragment': fragment_code.strip(), 'uniforms': {}}

                pos = 0
                while True:
                    v_match = re.search(r"(\w+):\s*\{", block_content[pos:])
                    if not v_match: break
                    v_name = v_match.group(1)
                    v_start = pos + v_match.end() - 1 
                    v_inner = ShaderLoader._find_js_block(block_content, v_start)
                    if v_inner:
                        shader_match = re.search(r"fragment:\s*`([^`]+)`", v_inner, re.DOTALL)
                        if shader_match:
                            fragment_code = shader_match.group(1).replace('${SHADER_COMMON}', '').replace('${BLUR_FUNCTION}', ShaderLoader._get_blur_function())
                            v_uniforms = {}
                            uni_match = re.search(r"uniforms:\s*\{", v_inner)
                            if uni_match:
                                uni_inner = ShaderLoader._find_js_block(v_inner, uni_match.end() - 1)
                                if uni_inner:
                                    v_uniforms = ShaderLoader._parse_uniforms(uni_inner)
                            v_name_clean = v_name[len(engine_name)+1:] if v_name.lower().startswith(f"{engine_name}_") else v_name
                            shader_name = f"{engine_name}_{v_name_clean}"
                            if shader_name not in shaders:
                                shaders[shader_name] = {'fragment': fragment_code.strip(), 'uniforms': v_uniforms}
                        pos = v_start + len(v_inner) + 2
                    else:
                        pos = v_start + 1
        
        loose_makeshader_pattern = r"(\w+)\s*:\s*makeShader\s*\(\s*`([^`]+)`\s*\)"
        matches = re.finditer(loose_makeshader_pattern, content, re.DOTALL)
        for match in matches:
            variant_name = match.group(1)
            shader_body = match.group(2)
            variant_name = variant_name.replace("'", "").replace('"', "")
            v_name_clean = variant_name
            if variant_name.lower().startswith(f"{base_engine_name}_"):
                v_name_clean = variant_name[len(base_engine_name)+1:]
            shader_name = f"{base_engine_name}_{v_name_clean}"
            if shader_name not in shaders:
                fragment_code = f"void main() {{\n{shader_body}\n}}"
                shaders[shader_name] = { 'fragment': fragment_code.strip(), 'uniforms': {} }
        
        variant_pattern = r"(\w+):\s*\{[^}]*fragment:\s*`([^`]+)`"
        uniform_pattern = r"uniforms:\s*\{([^}]*)\}"
        matches = re.finditer(variant_pattern, content, re.DOTALL)
        for match in matches:
            variant_name = match.group(1)
            fragment_code = match.group(2)
            v_name_clean = variant_name
            if variant_name.lower().startswith(f"{base_engine_name}_"):
                v_name_clean = variant_name[len(base_engine_name)+1:]
            shader_name = f"{base_engine_name}_{v_name_clean}"
            if shader_name not in shaders:
                fragment_code = fragment_code.replace('${SHADER_COMMON}', '').replace('${BLUR_FUNCTION}', ShaderLoader._get_blur_function())
                uniforms = {}
                before_match = content[:match.start()]
                uniform_matches = list(re.finditer(uniform_pattern, before_match[-500:]))
                if uniform_matches:
                    uniform_str = uniform_matches[-1].group(1)
                    uniforms = ShaderLoader._parse_uniforms(uniform_str)
                shaders[shader_name] = { 'fragment': fragment_code.strip(), 'uniforms': uniforms }
        return shaders
    
    @staticmethod
    def _parse_uniforms(uniform_str: str) -> dict:
        uniforms = {}
        pattern = r'(\w+):\s*(\[[^\]]+\]|[\d.]+)'
        matches = re.finditer(pattern, uniform_str)
        for match in matches:
            name = match.group(1)
            value_str = match.group(2)
            if value_str.startswith('['):
                values = [float(v.strip()) for v in value_str[1:-1].split(',')]
                uniforms[name] = values
            else:
                uniforms[name] = float(value_str)
        return uniforms
    
    @staticmethod
    def _get_blur_function() -> str:
        return """
    vec4 blur9(sampler2D tex, vec2 uv, vec2 resolution, vec2 direction) {
        vec4 color = vec4(0.0);
        vec2 off1 = vec2(1.3846153846) * direction;
        vec2 off2 = vec2(3.2307692308) * direction;
        color += texture(tex, uv) * 0.2270270270;
        color += texture(tex, uv + (off1 / resolution)) * 0.3162162162;
        color += texture(tex, uv - (off1 / resolution)) * 0.3162162162;
        color += texture(tex, uv + (off2 / resolution)) * 0.0702702703;
        color += texture(tex, uv - (off2 / resolution)) * 0.0702702703;
        return color;
    }
"""

class GPURenderer:
    VERTEX_SHADER = """
        #version 330
        in vec2 aPosition;
        in vec2 aTexCoord;
        out vec2 vUv;
        void main() {
            vUv = aTexCoord;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    """
    
    # === GLSL COMMON & MRT DEFINITIONS ===
    # Standard common GLSL Header + Output Layouts (used as fallback if common.glsl.js is unavailable)
    _GLSL_COMMON_FALLBACK = """
        #version 330
        layout(location = 0) out vec4 outColor;
        layout(location = 1) out vec4 outMask;
        
        uniform sampler2D uTexA;
        uniform sampler2D uTexB;
        uniform float uProgress;
        uniform float uIntensity;
        uniform float uTime;
        uniform vec2 uResolution;
        in vec2 vUv;
        
        // Easing functions
        float easeLinear(float t) { return t; }
        float easeInQuad(float t) { return t * t; }
        float easeOutQuad(float t) { return 1.0 - (1.0 - t) * (1.0 - t); }
        float easeInOutQuad(float t) { return t < 0.5 ? 2.0 * t * t : 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0; }
        float easeInCubic(float t) { return t * t * t; }
        float easeOutCubic(float t) { return 1.0 - pow(1.0 - t, 3.0); }
        float easeInOutCubic(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
        float easeInSine(float t) { return 1.0 - cos(t * 3.14159265 / 2.0); }
        float easeOutSine(float t) { return sin(t * 3.14159265 / 2.0); }

        // Hash and noise functions
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p, int octaves) {
            float value = 0.0; float amplitude = 0.5; float frequency = 1.0;
            for (int i = 0; i < 8; i++) {
                if (i >= octaves) break;
                value += amplitude * noise(p * frequency);
                amplitude *= 0.5; frequency *= 2.0;
            }
            return value;
        }
    """
    
    def __init__(self):
        self.ctx = None
        self.programs = {}
        self.vbo = None
        self._initialized = False
        self.current_w = 0
        self.current_h = 0
        self.shader_library = ShaderLoader.load_all_shaders()
        
        # Load complete common GLSL from common.glsl.js (includes voronoi, fbm, etc.)
        loaded_common = ShaderLoader.get_common_glsl_code()
        
        # Filter out uniform/varying/precision declarations from loaded_common
        # Keep only function definitions to avoid duplicate declarations
        filtered_lines = []
        for line in loaded_common.split('\n'):
            stripped = line.strip()
            # Skip declaration lines
            if stripped.startswith('precision '):
                continue
            if stripped.startswith('uniform '):
                continue
            if stripped.startswith('varying '):
                continue
            if stripped.startswith('in ') and not 'int ' in stripped and '{' not in stripped:
                # Skip "in vec2 vUv;" style declarations, but allow "int" and function internals
                if stripped.endswith(';') and 'vec' in stripped:
                    continue
            filtered_lines.append(line)
        
        filtered_common = '\n'.join(filtered_lines)
        
        # Build full common GLSL: Version + MRT layouts + filtered common functions
        self.glsl_common = """
        #version 330
        layout(location = 0) out vec4 outColor;
        layout(location = 1) out vec4 outMask;
        
        uniform sampler2D uTexA;
        uniform sampler2D uTexB;
        uniform float uProgress;
        uniform float uIntensity;
        uniform float uTime;
        uniform vec2 uResolution;
        in vec2 vUv;
        """ + filtered_common

        if 'crossfade' not in self.shader_library:
            self.shader_library['crossfade'] = {
                'fragment': '''
                    void main() {
                        vec4 colorA = texture(uTexA, vUv);
                        vec4 colorB = texture(uTexB, vUv);
                        float t = easeInOutCubic(uProgress);
                        gl_FragColor = mix(colorA, colorB, t);
                    }
                ''',
                'uniforms': {}
            }
    
    def _init_context(self, width: int, height: int):
        if self._initialized and self.ctx:
            if self.current_w == width and self.current_h == height:
                return True
        try:
            if not self.ctx:
                self.ctx = moderngl.create_standalone_context()
                vertices = np.array([
                    -1.0, -1.0,   0.0, 0.0,
                     1.0, -1.0,   1.0, 0.0,
                    -1.0,  1.0,   0.0, 1.0,
                     1.0,  1.0,   1.0, 1.0,
                ], dtype='f4')
                self.vbo = self.ctx.buffer(vertices)
            self.current_w = width
            self.current_h = height
            self._initialized = True
            return True
        except Exception as e:
            print(f"[BlendPack GPU] Failed to create context: {e}")
            raise

    def _convert_webgl_to_opengl33(self, fragment_code: str) -> str:
        code = fragment_code
        
        # 1. Clean up WebGL specific keywords
        code = code.replace('varying', 'in').replace('texture2D', 'texture')
        code = re.sub(r'precision\s+\w+\s+float;', '', code)
        
        # Inject Safe Casting Helpers (Overloading)
        # We perform injection after version directive or at start
        helper_funcs = """
vec4 _bp_toVec4(vec4 v) { return v; }
vec4 _bp_toVec4(vec3 v) { return vec4(v, 1.0); }
vec4 _bp_toVec4(float v) { return vec4(v, v, v, 1.0); }
"""
        # Find position to insert helpers (after version/layouts, before main or other funcs)
        # Safest is to append to common code area, but here we can prepend to code 
        # provided it doesn't break version/layout. 
        # Since modern GLSL requires #version at top, we assume it's handled by ctx.program or prepended later.
        # But wait, we are modifying the body. Let's insert before 'void main'.
        if "void main" in code:
            code = code.replace("void main", f"{helper_funcs}\nvoid main")
        else:
            code = helper_funcs + "\n" + code

        # Helper functions for parsing
        def parse_mix_args(mix_content: str) -> tuple:
            """Parse mix(A, B, mask) arguments handling nested parentheses."""
            args = []
            current = ""
            depth = 0
            
            for char in mix_content:
                if char == '(':
                    depth += 1
                    current += char
                elif char == ')':
                    depth -= 1
                    current += char
                elif char == ',' and depth == 0:
                    args.append(current.strip())
                    current = ""
                else:
                    current += char
            
            if current.strip():
                args.append(current.strip())
            
            return tuple(args) if len(args) == 3 else None
        
        def find_mix_call(text: str, start: int) -> tuple:
            """Find mix(...) starting from 'mix(' and return (end_index, content)."""
            depth = 1
            i = start
            while i < len(text) and depth > 0:
                if text[i] == '(':
                    depth += 1
                elif text[i] == ')':
                    depth -= 1
                i += 1
            return (i, text[start:i-1]) if depth == 0 else (start, "")
        
        mask_captured = False
        
        # === STRATEGY 1: Direct assignment ===
        # gl_FragColor = mix(A, B, mask);
        pattern = r'gl_FragColor\s*=\s*mix\s*\('
        match = re.search(pattern, code)
        
        if match:
            mix_start = match.end()
            mix_end, mix_content = find_mix_call(code, mix_start)
            
            if mix_content:
                args = parse_mix_args(mix_content)
                
                if args and len(args) == 3:
                    arg_a, arg_b, mask_val = args
                    semi_pos = code.find(';', mix_end)
                    if semi_pos == -1:
                        semi_pos = mix_end
                    
                    replacement = f"""
        vec4 _bp_colA = _bp_toVec4({arg_a});
        vec4 _bp_colB = _bp_toVec4({arg_b});
        float _bp_mask = {mask_val};
        outColor = mix(_bp_colA, _bp_colB, _bp_mask);
        outMask = vec4(_bp_mask, _bp_mask, _bp_mask, 1.0);
        """
                    code = code[:match.start()] + replacement + code[semi_pos+1:]
                    mask_captured = True
        
        # === STRATEGY 2: Variable assignment then output ===
        # vec4 result = mix(A, B, mask); ... gl_FragColor = result;
        if not mask_captured:
            # Find: [type] result = mix(A, B, mask);
            # Group 1: Optional type (e.g. vec4)
            # Group 2: Variable name
            result_mix_pattern = r'(?:(\w+)\s+)?(\w+)\s*=\s*mix\s*\('
            matches = list(re.finditer(result_mix_pattern, code))
            
            for match in reversed(matches):  # Start from last match (likely final blend)
                var_type = match.group(1) # None if just assignment
                var_name = match.group(2)
                
                mix_start = match.end()
                mix_end, mix_content = find_mix_call(code, mix_start)
                
                if mix_content:
                    args = parse_mix_args(mix_content)
                    
                    if args and len(args) == 3:
                        arg_a, arg_b, mask_val = args
                        
                        # ANTI-RECURSION CHECK:
                        # If the variable being assigned to is also one of the input arguments,
                        # this is likely a post-process effect (e.g. result = mix(result, ...)).
                        # We should skip this and look for the previous mix call (the primary blend).
                        # We use simple string check; could be more robust but sufficient for variable names.
                        if var_name == arg_a.strip() or var_name == arg_b.strip():
                            continue

                        # Check if this variable is later assigned to gl_FragColor
                        frag_assign_pattern = rf'gl_FragColor\s*=\s*{re.escape(var_name)}\s*;'
                        frag_match = re.search(frag_assign_pattern, code[mix_end:])
                        
                        if frag_match:
                            
                            # Find semicolon after mix
                            semi_pos = code.find(';', mix_end)
                            if semi_pos == -1:
                                semi_pos = mix_end
                            
                            # Determine declaration prefix (e.g., "vec4 " or "")
                            decl_prefix = f"{var_type} " if var_type else ""
                            
                            # Replace the mix assignment with mask capture
                            replacement = f"""
        vec4 _bp_colA = _bp_toVec4({arg_a});
        vec4 _bp_colB = _bp_toVec4({arg_b});
        float _bp_mask = {mask_val};
        {decl_prefix}{var_name} = mix(_bp_colA, _bp_colB, _bp_mask);
        outMask = vec4(_bp_mask, _bp_mask, _bp_mask, 1.0);
        """
                            code = code[:match.start()] + replacement + code[semi_pos+1:]
                            
                            # Also replace gl_FragColor = var with outColor = var
                            code = re.sub(rf'gl_FragColor\s*=\s*{re.escape(var_name)}', f'outColor = {var_name}', code)
                            mask_captured = True
                            break
        
        # === FALLBACK: Just replace gl_FragColor with outColor ===
        if not mask_captured:
            code = code.replace('gl_FragColor', 'outColor')
            # Note: outMask will remain at clear color (black), resulting in black-to-white fade
            
        return code
    
    def _get_program(self, shader_name: str):
        if shader_name in self.programs:
            return self.programs[shader_name]
        
        # Get/Default Shader
        if shader_name not in self.shader_library:
            shader_name = 'crossfade'
            
        shader_def = self.shader_library[shader_name]
        fragment_code = shader_def['fragment']
        
        # PROCESS CODE
        processed_code = self._convert_webgl_to_opengl33(fragment_code)
        
        # COMBINE
        full_fragment = self.glsl_common + '\n' + processed_code
        
        try:
            program = self.ctx.program(
                vertex_shader=self.VERTEX_SHADER,
                fragment_shader=full_fragment,
            )
            self.programs[shader_name] = program
            return program
        except Exception as e:
            print(f"[BlendPack GPU] Shader compilation failed for {shader_name}: {e}")
            if shader_name != 'crossfade':
                return self._get_program('crossfade')
            raise

    def _create_texture(self, image):
        """Create a GPU texture from a numpy image array."""
        h, w = image.shape[:2]
        channels = image.shape[2] if image.ndim == 3 else 1
        if image.dtype in (np.float32, np.float64):
            image = (np.clip(image, 0, 1) * 255).astype(np.uint8)
        elif image.dtype != np.uint8:
            image = image.astype(np.uint8)
        image = np.flipud(image).copy()
        if channels == 3:
            texture = self.ctx.texture((w, h), 3, image.tobytes())
        elif channels == 4:
            texture = self.ctx.texture((w, h), 4, image.tobytes())
        else:
            texture = self.ctx.texture((w, h), 1, image.tobytes())
        texture.filter = (moderngl.LINEAR, moderngl.LINEAR)
        return texture

    def _bezier_ease(self, x, p0, c0, c1, p1):
        """Apply bezier curve easing to a linear value."""
        x0, y0 = p0.get('x', 0), p0.get('y', 0)
        x1, y1 = c0.get('x', 0.4), c0.get('y', 0)
        x2, y2 = c1.get('x', 0.6), c1.get('y', 1)
        x3, y3 = p1.get('x', 1), p1.get('y', 1)
        if x0 == y0 and x1 == y1 and x2 == y2 and x3 == y3: return x
        t = x
        for _ in range(8):
            tm = 1 - t
            bx = (tm**3 * x0) + (3 * tm**2 * t * x1) + (3 * tm * t**2 * x2) + (t**3 * x3)
            dx = 3 * tm**2 * (x1 - x0) + 6 * tm * t * (x2 - x1) + 3 * t**2 * (x3 - x2)
            if abs(dx) < 1e-6: break
            diff = bx - x
            if abs(diff) < 1e-4: break
            t = t - diff / dx
        t = max(0.0, min(1.0, t))
        tm = 1 - t
        return (tm**3 * y0) + (3 * tm**2 * t * y1) + (3 * tm * t**2 * y2) + (t**3 * y3)

    def _resize_frame(self, frame: np.ndarray, target_w: int, target_h: int) -> np.ndarray:
        """Resize a frame to target dimensions using available backend."""
        if frame.shape[0] != target_h or frame.shape[1] != target_w:
            if _CV2_AVAILABLE:
                return cv2.resize(frame, (target_w, target_h))
            else:
                t_frame = torch.from_numpy(frame).permute(2, 0, 1).unsqueeze(0)
                t_frame = torch.nn.functional.interpolate(t_frame, size=(target_h, target_w), mode='bilinear', align_corners=False)
                return t_frame.squeeze(0).permute(1, 2, 0).numpy()
        return frame

    def render_transition(
        self,
        frames_a: torch.Tensor,
        frames_b: torch.Tensor,
        num_output_frames: int,
        shader_name: str = 'crossfade',
        intensity: float = 1.0,
        clip_a_start: int = 0,
        clip_b_start: int = 0,
        curve_p0: dict = None,
        curve_c0: dict = None,
        curve_c1: dict = None,
        curve_p1: dict = None,
        target_width: int = None,
        target_height: int = None,
        export_full_videos: bool = False,
        transition_frames: int = None,
        **extra_uniforms
    ) -> tuple[torch.Tensor, torch.Tensor]:
        if curve_p0 is None: curve_p0 = {'x': 0, 'y': 0}
        if curve_c0 is None: curve_c0 = {'x': 0.4, 'y': 0}
        if curve_c1 is None: curve_c1 = {'x': 0.6, 'y': 1}
        if curve_p1 is None: curve_p1 = {'x': 1, 'y': 1}
        
        # Convert Torch -> Numpy
        if isinstance(frames_a, torch.Tensor):
            frames_a = frames_a.cpu().numpy()
        if isinstance(frames_b, torch.Tensor):
            frames_b = frames_b.cpu().numpy()
            
        n_a, h_a, w_a = frames_a.shape[:3]
        n_b, h_b, w_b = frames_b.shape[:3]
        
        if target_width is not None and target_height is not None:
            target_w, target_h = target_width, target_height
        else:
            target_h, target_w = max(h_a, h_b), max(w_a, w_b)

        if not self.ctx or self.current_w != target_w or self.current_h != target_h:
            if not self._init_context(target_w, target_h):
                raise RuntimeError("Failed to initialize ModernGL context")
        
        prog = self._get_program(shader_name)
        if not prog:
            prog = self._get_program('crossfade')
            
        try:
            # MRT SETUP: 2 Textures (Color, Mask)
            color_attachment = self.ctx.texture((target_w, target_h), 4)
            mask_attachment = self.ctx.texture((target_w, target_h), 4)
            
            # Framebuffer with multiple attachments
            fbo = self.ctx.framebuffer(color_attachments=[color_attachment, mask_attachment])
            vao = self.ctx.vertex_array(prog, [(self.vbo, '2f 2f', 'aPosition', 'aTexCoord')])
            fbo.use()
        except Exception as e:
            print(f"[BlendPack GPU ERROR] Failed to setup FBO/VAO: {e}")
            raise e
            
        output_frames = []
        output_masks = []

        # Full video mode: [Clip A] + [Transition] + [Clip B]
        if export_full_videos and transition_frames is not None:
            clip_a_frame_count = n_a
            clip_b_frame_count = n_b
            trans_frame_count = transition_frames
        else:
            clip_a_frame_count = 0
            clip_b_frame_count = 0
            trans_frame_count = num_output_frames

        try:
            for i in range(num_output_frames):
                # Determine phase and calculate t, a_idx, b_idx
                if export_full_videos and transition_frames is not None:
                    if i < clip_a_frame_count:
                        # Phase 1: CLIP_A only
                        t = 0.0
                        linear_t = 0.0
                        a_idx = min(i, n_a - 1)
                        b_idx = 0
                    elif i < clip_a_frame_count + trans_frame_count:
                        # Phase 2: TRANSITION
                        trans_i = i - clip_a_frame_count
                        linear_t = trans_i / max(trans_frame_count - 1, 1)
                        t = self._bezier_ease(linear_t, curve_p0, curve_c0, curve_c1, curve_p1)
                        # A continues from end, B starts from beginning
                        a_idx = min(clip_a_frame_count + trans_i, n_a - 1)
                        b_idx = min(trans_i, n_b - 1)
                    else:
                        # Phase 3: CLIP_B only
                        t = 1.0
                        linear_t = 1.0
                        clip_b_i = i - clip_a_frame_count - trans_frame_count
                        a_idx = n_a - 1
                        b_idx = min(trans_frame_count + clip_b_i, n_b - 1)
                else:
                    # Normal transition-only mode
                    linear_t = i / max(num_output_frames - 1, 1)
                    t = self._bezier_ease(linear_t, curve_p0, curve_c0, curve_c1, curve_p1)
                    a_idx = min(clip_a_start + i, n_a - 1)
                    b_idx = min(clip_b_start + i, n_b - 1)

                frame_a = self._resize_frame(frames_a[a_idx], target_w, target_h)
                frame_b = self._resize_frame(frames_b[b_idx], target_w, target_h)
                
                # For CLIP_A (t=0) and CLIP_B (t=1) phases, bypass shader and use raw frames
                is_clip_a_phase = export_full_videos and transition_frames is not None and i < clip_a_frame_count
                is_clip_b_phase = export_full_videos and transition_frames is not None and i >= clip_a_frame_count + trans_frame_count
                
                if is_clip_a_phase:
                    # Use frame_a directly without shader
                    if frame_a.dtype in (np.float32, np.float64):
                        color_frame = frame_a[:, :, :3] if frame_a.shape[2] >= 3 else frame_a
                    else:
                        color_frame = frame_a[:, :, :3].astype(np.float32) / 255.0
                    mask_frame = np.zeros((target_h, target_w), dtype=np.float32)
                    output_frames.append(color_frame)
                    output_masks.append(mask_frame)
                    continue
                
                if is_clip_b_phase:
                    # Use frame_b directly without shader
                    if frame_b.dtype in (np.float32, np.float64):
                        color_frame = frame_b[:, :, :3] if frame_b.shape[2] >= 3 else frame_b
                    else:
                        color_frame = frame_b[:, :, :3].astype(np.float32) / 255.0
                    mask_frame = np.ones((target_h, target_w), dtype=np.float32)
                    output_frames.append(color_frame)
                    output_masks.append(mask_frame)
                    continue
                
                tex_a = None
                tex_b = None
                try:
                    tex_a = self._create_texture(frame_a)
                    tex_b = self._create_texture(frame_b)
                    
                    tex_a.use(0)
                    tex_b.use(1)
                    
                    if 'uTexA' in prog: prog['uTexA'].value = 0
                    if 'uTexB' in prog: prog['uTexB'].value = 1
                    if 'uProgress' in prog: prog['uProgress'].value = float(t)
                    if 'uIntensity' in prog: prog['uIntensity'].value = float(intensity)
                    if 'uTime' in prog: prog['uTime'].value = float(linear_t)
                    if 'uResolution' in prog: prog['uResolution'].value = (float(target_w), float(target_h))
                    
                    # Set custom uniforms
                    shader_def = self.shader_library.get(shader_name, {})
                    default_uniforms = shader_def.get('uniforms', {})
                    all_custom = {**default_uniforms, **extra_uniforms}
                    
                    for u_name, u_val in all_custom.items():
                        glsl_name = u_name if u_name in prog else f"u{u_name[0].upper()}{u_name[1:]}"
                        if glsl_name in prog:
                            try:
                                if isinstance(u_val, (int, float)):
                                    prog[glsl_name].value = float(u_val)
                                elif isinstance(u_val, (list, tuple)):
                                    prog[glsl_name].value = tuple(u_val)
                            except Exception as uniform_err:
                                # Log uniform setting errors for debugging (non-critical)
                                pass  # Uniform may not exist in shader or type mismatch
                    
                    # MRT Clear: Clear both color and mask targets
                    # Color clean (black), Mask clean (black)
                    self.ctx.clear(0.0, 0.0, 0.0, 0.0) 
                    
                    vao.render(moderngl.TRIANGLE_STRIP)
                    
                    # Read Color Buffer (Attachment 0)
                    color_data = fbo.read(components=4, attachment=0)
                    result_color = np.frombuffer(color_data, dtype=np.uint8).reshape((target_h, target_w, 4))
                    result_color = np.flipud(result_color)
                    
                    # Read Mask Buffer (Attachment 1)
                    mask_data = fbo.read(components=4, attachment=1)
                    result_mask = np.frombuffer(mask_data, dtype=np.uint8).reshape((target_h, target_w, 4))
                    result_mask = np.flipud(result_mask)
                    
                    # Process outputs
                    color_frame = result_color[:, :, :3].astype(np.float32) / 255.0
                    
                    # Mask from Red Channel (since we write vec4(mask, mask, mask, 1.0))
                    mask_frame = result_mask[:, :, 0].astype(np.float32) / 255.0
                    
                    output_frames.append(color_frame)
                    output_masks.append(mask_frame)
                
                finally:
                    if tex_a: tex_a.release()
                    if tex_b: tex_b.release()
            
        except Exception as e:
            current_frame = i if 'i' in locals() else -1
            print(f"[BlendPack GPU] Render loop failed at frame {current_frame}: {e}")
            raise e
        finally:
            if color_attachment: color_attachment.release()
            if mask_attachment: mask_attachment.release()
            if fbo: fbo.release()
            if vao: vao.release()

        if not output_frames:
            return torch.zeros((1, target_h, target_w, 3)), torch.zeros((1, target_h, target_w))
            
        return torch.from_numpy(np.stack(output_frames)), torch.from_numpy(np.stack(output_masks))
    
    def cleanup(self):
        if self.ctx:
            for program in self.programs.values():
                program.release()
            if self.vbo:
                self.vbo.release()
            self.ctx.release()
            self._initialized = False
    
    def get_available_shaders(self) -> list:
        return list(self.shader_library.keys())

_gpu_renderer = None

def get_gpu_renderer():
    global _gpu_renderer
    if _gpu_renderer is None:
        _gpu_renderer = GPURenderer()
    return _gpu_renderer
