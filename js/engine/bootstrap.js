import { registerAllEngines as registerEnginesFromIndex } from './shaders/index.js';

/**
 * Modern bootstrap for the Pure WebGL engine.
 * Delegating registration to the specialized shader index.
 */
export function registerAllEngines() {
    registerEnginesFromIndex();

}
