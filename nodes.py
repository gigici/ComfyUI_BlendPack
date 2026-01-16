import torch
import json
import sys
import os
import math
import numpy as np
from pathlib import Path
from PIL import Image
import folder_paths
import base64
import io

_THIS_DIR = Path(__file__).parent
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

_gpu_renderer = None
_gpu_available = False
try:
    import gpu_renderer as _gpu_module
    _gpu_renderer = _gpu_module.get_gpu_renderer()
    _gpu_available = True
except ImportError:
    pass
except Exception:
    pass

class BlendJoiner:
    RETURN_TYPES = ("IMAGE", "IMAGE", "MASK", "STRING", "FLOAT")
    RETURN_NAMES = ("frames_out", "clip_b_passthrough", "transition_mask", "blend_info", "frame_rate")
    FUNCTION = "blend_videos"
    CATEGORY = "BlendPack"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip_a": ("IMAGE,VIDEO",),
                "clip_b": ("IMAGE,VIDEO",),
            },
            "optional": {
                "_settings": ("STRING", {"default": "{}"}),
                "resolution_mode": (["auto", "max", "custom"], {"default": "auto"}),
                "custom_width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "custom_height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
            }
        }

    def _extract_frames(self, obj):
        """Extract frames from various input types (Tensor, video paths, custom objects)."""
        if obj is None:
            return torch.zeros(1, 64, 64, 3, dtype=torch.float32), 0.0

        if isinstance(obj, torch.Tensor):
            return obj, 0.0
        
        # Check for explicit video path accessor (e.g. VHS nodes)
        if hasattr(obj, 'get_video_path'): 
            return self._load_video_frames(obj.get_video_path())
            
        # Check for common attribute names used by various video loaders
        video_path = getattr(obj, 'video', getattr(obj, 'file', getattr(obj, 'path', None)))
        if video_path and isinstance(video_path, str) and os.path.exists(video_path):
             return self._load_video_frames(video_path)

        # Legacy/Fallback: inspect object properties for valid video files
        if not video_path and hasattr(obj, '__dict__'):
            video_extensions = ('.mp4', '.mov', '.avi', '.webm', '.mkv', '.gif')
            candidates = [
                v for k, v in obj.__dict__.items() 
                if isinstance(v, str) and ('path' in k.lower() or 'file' in k.lower())
            ]
            for path in candidates:
                if path.lower().endswith(video_extensions) and os.path.exists(path):
                    return self._load_video_frames(path)

        # Last resort: try to get components (some custom nodes setup)
        if hasattr(obj, 'get_components'):
            try:
                components = obj.get_components()
                if isinstance(components, torch.Tensor):
                    return components, 0.0
            except Exception:
                pass
        
        return torch.zeros(1, 64, 64, 3, dtype=torch.float32), 0.0
    
    def _load_video_frames(self, video_path, max_frames=1000):
        fps = 30.0
        try:
            import cv2
            cap = cv2.VideoCapture(str(video_path))
            fps = cap.get(cv2.CAP_PROP_FPS)
            if not fps or fps < 1: fps = 30.0
            
            frames = []
            count = 0
            while cap.isOpened() and count < max_frames:
                ret, frame = cap.read()
                if not ret: break
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame_tensor = torch.from_numpy(frame_rgb).float() / 255.0
                frames.append(frame_tensor)
                count += 1
            cap.release()
            if frames:
                return torch.stack(frames), fps
        except Exception as e:
            print(f"[BlendPack] Warning: Failed to load video frames: {e}")
        
        return torch.zeros(1, 64, 64, 3, dtype=torch.float32), 30.0

    def _map_engine_to_shader(self, engine: str, variant: str) -> str:
        engine_clean = str(engine).lower().replace(' ', '_')
        variant_clean = str(variant).lower().replace(' ', '_').replace('-', '_')
        primary_name = f"{engine_clean}_{variant_clean}"
        
        if not (_gpu_available and _gpu_renderer):
            return 'crossfade'
            
        available = _gpu_renderer.get_available_shaders()

        if primary_name in available: return primary_name
        
        for avail in available:
            if avail.lower() == primary_name.lower(): return avail
                
        if variant_clean in available: return variant_clean
            
        matches = [v for v in available if v.lower().startswith(f"{engine_clean}_") and variant_clean in v.lower()]
        if matches: return min(matches, key=len)

        for avail in available:
            if variant_clean in avail.lower(): return avail
        
        return 'crossfade'

    def blend_videos(self, clip_a, clip_b, _settings='{}', **kwargs):
        try:
            settings = json.loads(_settings) if _settings else {}
        except Exception as e:
            print(f"[BlendPack] Warning: Failed to parse settings JSON: {e}")
            settings = {}

        debug_info = {
            'engine': settings.get('engine', 'Dissolve'),
            'variant': settings.get('variant', 'powder'),
            'fps': settings.get('fps', 30),
            'intensity': settings.get('intensity', 1.0),
            'render_backend': 'CPU'
        }

        pre_rendered = settings.get('preRenderedFrames', None)
        if pre_rendered and len(pre_rendered) > 0:
            result = self._load_pre_rendered_frames(pre_rendered)
            frames_b, _ = self._extract_frames(clip_b)
            if frames_b.dim() == 3: frames_b = frames_b.unsqueeze(0)
            debug_info['render_backend'] = 'WebGL (Client)'
            if result is not None:
                debug_info['frame_count'] = result.shape[0]
                debug_info['output_res'] = f'{result.shape[2]}x{result.shape[1]}'
                
                # Generate mask for pre-rendered frames
                num_frames = result.shape[0]
                duration = settings.get('duration', 2.0)
                curve_p0 = settings.get('curveP0', {'x': 0, 'y': 0})
                curve_c0 = settings.get('curveC0', {'x': 0.4, 'y': 0})
                curve_c1 = settings.get('curveC1', {'x': 0.6, 'y': 1})
                curve_p1 = settings.get('curveP1', {'x': 1, 'y': 1})
                
                mask_frames = []
                for i in range(num_frames):
                    t = self._bezier_solve(i / max(num_frames - 1, 1), curve_p0, curve_c0, curve_c1, curve_p1)
                    mask_frame = torch.full((result.shape[1], result.shape[2]), t, dtype=torch.float32)
                    mask_frames.append(mask_frame)
                transition_mask = torch.stack(mask_frames)
            else:
                transition_mask = torch.zeros(1, 64, 64, dtype=torch.float32)
                
            return (result, frames_b, transition_mask, json.dumps(debug_info, indent=2), debug_info.get("fps", 30))

        engine = settings.get('engine', 'Dissolve')
        variant = settings.get('variant', 'powder')
        duration = settings.get('duration', 2.0)
        fps = settings.get('fps', 30)
        intensity = settings.get('intensity', 1.0)
        clip_a_start = settings.get('clip_a_start', settings.get('clipAStart', 0))
        clip_b_start = settings.get('clip_b_start', settings.get('clipBStart', 0))
        export_full_videos = settings.get('exportFullVideos', False)
        use_source_fps_val = settings.get('use_source_fps', False)
        
        curve_p0 = settings.get('curveP0', {'x': 0, 'y': 0})
        curve_c0 = settings.get('curveC0', {'x': 0.4, 'y': 0})
        curve_c1 = settings.get('curveC1', {'x': 0.6, 'y': 1})
        curve_p1 = settings.get('curveP1', {'x': 1, 'y': 1})

        shader_name = self._map_engine_to_shader(engine, variant)
        
        frames_a, fps_a = self._extract_frames(clip_a)
        frames_b, fps_b = self._extract_frames(clip_b)

        source_fps_used = False
        if settings.get('use_source_fps', False):
            if fps_a > 1:
                fps = fps_a
                source_fps_used = True
            elif fps_b > 1:
                fps = fps_b
                source_fps_used = True
            else:
                # FPS could not be extracted (tensor input has no FPS metadata)
                print(f"[BlendPack] Warning: use_source_fps enabled but source FPS unavailable (fps_a={fps_a}, fps_b={fps_b}). Using Animation FPS: {fps}")
        
        debug_info.update({
            'engine': engine, 'variant': variant, 'shader_used': shader_name,
            'intensity': intensity, 'fps': fps,
            'use_source_fps': use_source_fps_val, 'source_fps_used': source_fps_used,
            'source_fps_a': fps_a, 'source_fps_b': fps_b
        })
        
        if frames_a.dim() == 3: frames_a = frames_a.unsqueeze(0)
        if frames_b.dim() == 3: frames_b = frames_b.unsqueeze(0)
            
        debug_info['source_a'] = f'{frames_a.shape[2]}x{frames_a.shape[1]} ({frames_a.shape[0]} frames)'
        debug_info['source_b'] = f'{frames_b.shape[2]}x{frames_b.shape[1]} ({frames_b.shape[0]} frames)'

        res_mode = kwargs.get('resolution_mode', 'auto')
        if res_mode == 'auto':
            out_h, out_w = frames_a.shape[1], frames_a.shape[2]
        elif res_mode == 'max':
            out_h, out_w = max(frames_a.shape[1], frames_b.shape[1]), max(frames_a.shape[2], frames_b.shape[2])
        else:
            out_h, out_w = kwargs.get('custom_height', 512), kwargs.get('custom_width', 512)

        debug_info['resolution_mode'] = res_mode
        debug_info['target_res'] = f'{out_w}x{out_h}'

        # Calculate frame counts based on export mode
        if export_full_videos:
            # Full video mode: Clip A + Transition + Clip B
            clip_a_frames = frames_a.shape[0]
            clip_b_frames = frames_b.shape[0]
            transition_frames = max(2, math.ceil(duration * fps))
            num_frames = clip_a_frames + transition_frames + clip_b_frames
            a_start = 0
            b_start = 0
            total_duration = (clip_a_frames / fps) + duration + (clip_b_frames / fps)
            debug_info['export_mode'] = 'full_videos'
            debug_info['duration'] = f'{total_duration:.2f}s'
            debug_info['transition_duration'] = f'{duration:.2f}s'
            debug_info['structure'] = f'ClipA({clip_a_frames}) + Transition({transition_frames}) + ClipB({clip_b_frames})'
        else:
            # Normal mode: Only transition
            num_frames = max(2, math.ceil(duration * fps))
            a_start = min(max(0, int(clip_a_start * fps)), frames_a.shape[0] - 1)
            b_start = min(max(0, int(clip_b_start * fps)), frames_b.shape[0] - 1)
            debug_info['export_mode'] = 'transition_only'
            debug_info['duration'] = f'{duration:.2f}s'
        
        explicit_args = ['engine', 'variant', 'duration', 'fps', 'intensity', 'easing',
                         'clipAStart', 'clipBStart', 'isRealPreview', 'use_source_fps',
                         'curveP0', 'curveC0', 'curveC1', 'curveP1', 'preRenderedFrames',
                         'exportFullVideos', 'clip_a_start', 'clip_b_start']
        
        gpu_settings = {k: v for k, v in settings.items() if k not in explicit_args}
        result = None
        transition_mask = None
        
        if _gpu_available and _gpu_renderer:
            try:
                transition_frame_count = max(2, math.ceil(duration * fps)) if export_full_videos else None
                result, transition_mask = _gpu_renderer.render_transition(
                    frames_a, frames_b, num_frames,
                    shader_name=shader_name, intensity=intensity,
                    clip_a_start=a_start, clip_b_start=b_start,
                    curve_p0=curve_p0, curve_c0=curve_c0, curve_c1=curve_c1, curve_p1=curve_p1,
                    target_width=out_w, target_height=out_h,
                    export_full_videos=export_full_videos,
                    transition_frames=transition_frame_count,
                    **gpu_settings
                )
                debug_info['render_backend'] = 'ModernGL'
            except Exception:
                import traceback
                traceback.print_exc()
                debug_info['render_backend'] = 'CPU Fallback'
        
        if result is None:
            result = self._cpu_crossfade(frames_a, frames_b, num_frames, a_start, b_start, 
                                          curve_p0, curve_c0, curve_c1, curve_p1, out_h, out_w)
            debug_info['render_backend'] = 'CPU (Fallback)'
            
        debug_info['frame_count'] = result.shape[0]
        debug_info['output_res'] = f'{result.shape[2]}x{result.shape[1]}'
        
        # fallback for mask if not provided by GPU
        if transition_mask is None:
            mask_frames = []
            for i in range(num_frames):
                t = self._bezier_solve(i / max(num_frames - 1, 1), curve_p0, curve_c0, curve_c1, curve_p1)
                mask_frame = torch.full((out_h, out_w), t, dtype=torch.float32)
                mask_frames.append(mask_frame)
            transition_mask = torch.stack(mask_frames)
        
        return (result, frames_b, transition_mask, json.dumps(debug_info, indent=2), debug_info.get("fps", 30))

    def _bezier_solve(self, x, p0, c0, c1, p1):
        x0, y0 = p0.get('x', 0), p0.get('y', 0)
        x1, y1 = c0.get('x', 0.4), c0.get('y', 0)
        x2, y2 = c1.get('x', 0.6), c1.get('y', 1)
        x3, y3 = p1.get('x', 1), p1.get('y', 1)
        if x0==y0 and x1==y1 and x2==y2 and x3==y3: return x
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

    def _load_pre_rendered_frames(self, frames_data):
        frames = []
        for item in frames_data:
            try:
                img = None
                if isinstance(item, dict) and 'name' in item:
                    filename = item['name']
                    subfolder = item.get('subfolder', '')
                    folder_type = item.get('type', 'temp')
                    base_dir = folder_paths.get_temp_directory() if folder_type == 'temp' else folder_paths.get_input_directory()
                    if subfolder: base_dir = os.path.join(base_dir, subfolder)
                    img_path = os.path.join(base_dir, filename)
                    if os.path.exists(img_path): img = Image.open(img_path)
                elif isinstance(item, str) and (item.startswith('data:') or len(item) > 100):
                    b64 = item.split(',')[1] if ',' in item else item
                    img = Image.open(io.BytesIO(base64.b64decode(b64)))
                if img:
                    if img.mode != 'RGB': img = img.convert('RGB')
                    frames.append(torch.from_numpy(np.array(img)).float() / 255.0)
            except Exception:
                if frames: frames.append(frames[-1].clone())
        return torch.stack(frames) if frames else torch.zeros(1, 64, 64, 3)

    def _cpu_crossfade(self, frames_a, frames_b, num_frames, a_start, b_start, p0, c0, c1, p1, h, w):

        n_a, n_b = frames_a.shape[0], frames_b.shape[0]
        output = []
        for i in range(num_frames):
            t = self._bezier_solve(i / max(num_frames - 1, 1), p0, c0, c1, p1)
            frame_a = frames_a[min(a_start + i, n_a - 1)]
            frame_b = frames_b[min(b_start + i, n_b - 1)]
            if frame_a.shape[0] != h or frame_a.shape[1] != w:
                frame_a = torch.nn.functional.interpolate(frame_a.permute(2,0,1).unsqueeze(0), size=(h, w), mode='bilinear').squeeze(0).permute(1,2,0)
            if frame_b.shape[0] != h or frame_b.shape[1] != w:
                frame_b = torch.nn.functional.interpolate(frame_b.permute(2,0,1).unsqueeze(0), size=(h, w), mode='bilinear').squeeze(0).permute(1,2,0)
            output.append(frame_a * (1 - t) + frame_b * t)
        return torch.stack(output)

class BlendVideoCombine:
    """
    Combines image frames into animated GIF/WebP with preview support.
    Based on VideoHelperSuite's VideoCombine node pattern.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("FLOAT", {"default": 30.0, "min": 1.0, "max": 120.0, "step": 1.0}),
                "filename_prefix": ("STRING", {"default": "BlendPack"}),
                "format": (["webp", "gif"],),
                "save_output": ("BOOLEAN", {"default": True}),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
            },
            "optional": { 
                "blend_info": ("STRING", {"forceInput": True, "multiline": True}),
            },
            "hidden": { "prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO" },
        }

    RETURN_TYPES = ()
    FUNCTION = "combine_video"
    OUTPUT_NODE = True
    CATEGORY = "BlendPack"

    def combine_video(self, images, frame_rate, filename_prefix="BlendPack", format="webp", 
                      save_output=True, loop_count=0, blend_info="", prompt=None, extra_pnginfo=None):
        
        # Determine output directory based on save_output flag
        if save_output:
            output_dir = folder_paths.get_output_directory()
            file_type = "output"
        else:
            output_dir = folder_paths.get_temp_directory()
            file_type = "temp"
        
        full_out, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
            filename_prefix, output_dir, images[0].shape[1], images[0].shape[0]
        )
        
        # Convert tensors to PIL images
        pil_images = [Image.fromarray(np.clip(255.0 * img.cpu().numpy(), 0, 255).astype(np.uint8)) for img in images]
        
        duration_ms = int(1000.0 / frame_rate)
        file = f"{filename}_{counter:05}_.{format}"
        file_path = os.path.join(full_out, file)
        
        # Save animated image
        save_kwargs = {
            "save_all": True,
            "append_images": pil_images[1:],
            "duration": duration_ms,
            "loop": loop_count,
        }
        
        if format == "webp":
            save_kwargs["lossless"] = False
            save_kwargs["quality"] = 90
        elif format == "gif":
            save_kwargs["disposal"] = 2
        
        pil_images[0].save(file_path, **save_kwargs)
        
        # Parse blend info
        try:
            parsed = json.loads(blend_info) if blend_info else {}
        except Exception:
            parsed = {"raw": blend_info}
        
        # Return format matching VHS for proper video playback
        results = {
            "filename": file, 
            "subfolder": subfolder, 
            "type": file_type,
            "format": f"image/{format}",
        }
        
        return { 
            "ui": { 
                "gifs": [results],
                "blend_info": [parsed] 
            } 
        }

NODE_CLASS_MAPPINGS = { "BlendJoiner": BlendJoiner, "BlendVideoCombine": BlendVideoCombine }
NODE_DISPLAY_NAME_MAPPINGS = { "BlendJoiner": "Blend Joiner", "BlendVideoCombine": "Blend Video Combine" }
