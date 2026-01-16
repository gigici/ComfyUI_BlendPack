// shader index

import { EngineRegistry } from '../EngineRegistry.js';

// Import all shader variants
import { DISSOLVE_VARIANTS } from './dissolve.glsl.js';
import { WIPE_VARIANTS } from './wipe.glsl.js';
import { ZOOM_VARIANTS } from './zoom.glsl.js';
import { BLUR_VARIANTS } from './blur.glsl.js';
import { ROTATE_VARIANTS } from './rotate.glsl.js';
import { LIGHT_VARIANTS } from './light.glsl.js';
import { PRISM_VARIANTS } from './prism.glsl.js';
import { GLITCH_VARIANTS } from './glitch.glsl.js';
import { MORPH_VARIANTS } from './morph.glsl.js';
import { PIXELATE_VARIANTS } from './pixelate.glsl.js';
import { REFRACTION_VARIANTS } from './refraction.glsl.js';
import { SHUTTER_VARIANTS } from './shutter.glsl.js';
import { OTHER_VARIANTS } from './other.glsl.js';
import { CROSSFADE_VARIANTS } from './crossfade.glsl.js';

export {
    DISSOLVE_VARIANTS,
    WIPE_VARIANTS,
    ZOOM_VARIANTS,
    BLUR_VARIANTS,
    ROTATE_VARIANTS,
    LIGHT_VARIANTS,
    PRISM_VARIANTS,
    GLITCH_VARIANTS,
    MORPH_VARIANTS,
    PIXELATE_VARIANTS,
    REFRACTION_VARIANTS,
    SHUTTER_VARIANTS,
    OTHER_VARIANTS,
    CROSSFADE_VARIANTS
};

export const ALL_ENGINES = {
    Dissolve: DISSOLVE_VARIANTS,
    Wipe: WIPE_VARIANTS,
    Zoom: ZOOM_VARIANTS,
    Blur: BLUR_VARIANTS,
    Rotate: ROTATE_VARIANTS,
    Light: LIGHT_VARIANTS,
    Prism: PRISM_VARIANTS,
    GlitchClean: GLITCH_VARIANTS,
    Morph: MORPH_VARIANTS,
    Pixelate: PIXELATE_VARIANTS,
    Refraction: REFRACTION_VARIANTS,
    ShutterMotion: SHUTTER_VARIANTS,

    Other: OTHER_VARIANTS,
    Crossfade: CROSSFADE_VARIANTS
};


export function registerAllEngines() {
    for (const [engineName, variants] of Object.entries(ALL_ENGINES)) {
        EngineRegistry.registerEngine(engineName, variants);
    }
}

