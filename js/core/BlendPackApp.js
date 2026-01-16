
import { EventBus, globalEventBus } from './EventBus.js';
import { LifecycleManager } from './LifecycleManager.js';
import { StateManager } from './StateManager.js';
import { EngineRegistry } from '../engine/EngineRegistry.js';

let instance = null;

export class BlendPackApp {
    constructor() {
        if (instance) {
            return instance;
        }
        instance = this;

        this.nodes = new Map();
        this.eventBus = globalEventBus;
        this.initialized = false;
        this.version = '3.0.0';
    }

    static getInstance() {
        if (!instance) {
            instance = new BlendPackApp();
        }
        return instance;
    }

    init(app) {
        if (this.initialized) {
            return;
        }

        this.comfyApp = app;
        this.initialized = true;

        this.eventBus.on('graph:clear', () => this.disposeAllNodes());
    }

    registerNode(node) {
        if (this.nodes.has(node.id)) {
            const existingContext = this.nodes.get(node.id);
            if (existingContext.node === node) return existingContext;
            this.unregisterNode(node.id);
        }

        const context = {
            node,
            id: node.id,
            lifecycle: new LifecycleManager(node.id),
            state: new StateManager(this._getDefaultState()),
            events: new EventBus(),
        };

        this.nodes.set(node.id, context);

        return context;
    }

    unregisterNode(nodeId) {
        const context = this.nodes.get(nodeId);
        if (!context) return;
        context.lifecycle.dispose();
        context.state.dispose();
        context.events.clear();
        this.nodes.delete(nodeId);
    }

    getNodeContext(nodeId) {
        return this.nodes.get(nodeId) || null;
    }

    disposeAllNodes() {
        for (const nodeId of this.nodes.keys()) {
            this.unregisterNode(nodeId);
        }
    }

    _getDefaultState() {
        return {
            engine: 'Dissolve',
            variant: 'powder',

            duration: 2.0,
            fps: 30,
            curve: 'easeInOut',

            intensity: 1.0,
            timelinePos: 50,
            previewPolicy: 'loop',
            isPlaying: true,
            isRealPreview: false,

            clipAStart: 0.0,
            clipBStart: 0.0,

            expanded: true,
            showCurveEditor: false,

            grain: 0,
            bloom: 0,
            chroma: 0,
            vignette: 0,
            flavor: 'clean',
            use_source_fps: false,

            curveP0: { x: 0, y: 0 },
            curveC0: { x: 0.45, y: 0 },
            curveC1: { x: 0.55, y: 1 },
            curveP1: { x: 1, y: 1 },
        };
    }

    getEngines() {
        return EngineRegistry.getEngines();
    }

    getVariants(engine) {
        return EngineRegistry.getVariants(engine);
    }

    getVariantDescription(engineName, variantName) {
        return EngineRegistry.getVariantDescription(engineName, variantName);
    }

    getNodeCount() {
        return this.nodes.size;
    }
}

export const getApp = () => BlendPackApp.getInstance();
