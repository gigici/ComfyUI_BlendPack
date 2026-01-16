import { PreviewCanvas } from './components/PreviewCanvas.js';
import { TimelineBar } from './components/TimelineBar.js';
import { SliderControl } from './components/SliderControl.js';
import { EngineSelector } from './components/EngineSelector.js';
import { VariantSelector } from './components/VariantSelector.js';
import { CurveEditor } from './components/CurveEditor.js';
import { SectionHeader } from './components/SectionHeader.js';
import { ToggleControl } from './components/ToggleControl.js';
import { FlavorGroup } from './components/FlavorGroup.js';
import { RealPreviewButton } from './components/RealPreviewButton.js';
import { WebGLRenderer } from '../renderer/WebGLRenderer.js';
import { getApp } from '../core/BlendPackApp.js';
import { EngineRegistry } from '../engine/EngineRegistry.js';
import { bezierYForX } from '../utils/MathUtils.js';
import { THEME, LAYOUT } from './Theme.js';
import { createDefaultDemoImages } from '../utils/DemoImages.js';
import { FrameCache } from './FrameCache.js';
import { FrameExporter } from './FrameExporter.js';
import { solveTimeline } from '../utils/TimelineUtils.js';

export class NodeUI {
    constructor(node) {
        this.node = node;
        this.app = getApp();
        this._videoClones = {};
        this._syncCanvases = {
            'A': document.createElement('canvas'),
            'B': document.createElement('canvas')
        };

        this._frameCache = new FrameCache();

        this._frameExporter = null;
        this._exportedFrames = null;
        this._cacheReady = false;
        this._cacheProgress = 0;
        this._isQueueExporting = false;

        this.components = [];

        this._setupContext(node);

        const checkId = setInterval(() => {
            if (this.node.id !== undefined && this.node.id !== -1 && this.node.id !== (this.context?.id)) {
                this._setupContext(node);
            }
        }, 1000);
        this.lifecycle.addDisposable({ dispose: () => { clearInterval(checkId); this._cleanupVideoClones(); } });

        this.node.size[0] = 380;
        this.headerHeight = 28;
        this._bindNodeMethods();
        this._setupRenderLoop();
        this._setupQueueHook();

        if (!this.node._originalSlotNames) {
            this.node._originalSlotNames = {
                inputs: this.node.inputs?.map(s => s.name) || [],
                outputs: this.node.outputs?.map(s => s.name) || []
            };
        }
    }

    _drawSlotLabel(ctx, text, x, y, isInput) {
        if (!text || text.trim() === "") return;

        ctx.save();
        ctx.font = "bold 11px sans-serif";
        const padding = 6;
        const textWidth = ctx.measureText(text).width;
        const boxW = textWidth + padding * 2;
        const boxH = 18;

        const boxX = isInput ? x + 15 : x - boxW - 15;
        const boxY = y - boxH / 2;

        ctx.fillStyle = "rgba(30,30,30,0.95)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, 4);
        else ctx.rect(boxX, boxY, boxW, boxH);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, boxX + padding, y);
        ctx.restore();
    }

    _setupQueueHook() {
        if (!window.app?.api) return;

        if (window.app.api._blendPackHooked) return;

        const originalQueuePrompt = window.app.api.queuePrompt?.bind(window.app.api);
        if (!originalQueuePrompt) return;

        window.app.api._blendPackHooked = true;

        window.app.api.queuePrompt = async function (...args) {
            try {
                const graph = window.app?.graph;
                if (graph) {
                    const blendPackNodes = graph._nodes?.filter(n =>
                        n.type === 'BlendJoiner' || n.comfyClass === 'BlendJoiner'
                    ) || [];

                    const exportPromises = blendPackNodes.map(async (node) => {
                        if (node._blendPackUI && node._blendPackUI.exportForExecution) {
                            node._blendPackUI._isQueueExporting = true;
                            node._blendPackUI.node.setDirtyCanvas(true, true);

                            try {
                                await node._blendPackUI.exportForExecution();
                            } catch (err) {
                                console.error(`[BlendPack] Export failed for node ${node.id}:`, err);
                            } finally {
                                node._blendPackUI._isQueueExporting = false;
                                node._blendPackUI.node.setDirtyCanvas(true, true);
                            }
                        }
                    });

                    const timeout = new Promise(resolve => setTimeout(resolve, 10000));
                    await Promise.race([Promise.all(exportPromises), timeout]);
                }

                if (args[1] && args[1].output) {
                    const promptOutput = args[1].output;
                    const graph = window.app?.graph;

                    if (graph && graph._nodes) {
                        for (const node of graph._nodes) {
                            if ((node.type === 'BlendJoiner' || node.comfyClass === 'BlendJoiner') &&
                                node._blendPackUI &&
                                node._blendPackUI._exportedFrames) {

                                const nodeData = promptOutput[String(node.id)];
                                if (nodeData && nodeData.inputs && nodeData.inputs._settings) {
                                    try {
                                        let settings = JSON.parse(nodeData.inputs._settings);
                                        settings.preRenderedFrames = node._blendPackUI._exportedFrames;
                                        nodeData.inputs._settings = JSON.stringify(settings);

                                    } catch (e) {
                                        console.warn('[BlendPack] Failed to inject frames:', e);
                                    }
                                }
                            }
                        }
                    }
                }

            } catch (err) {
                console.error("[BlendPack] Critical error in queue hook:", err);
            }

            return originalQueuePrompt(...args);
        };
    }

    _setupContext(node) {
        const oldStateData = this.state ? this.state.getSnapshot() : null;

        this._frameExporter = null;

        this.context = this.app.registerNode(node);
        this.state = this.context.state;
        this.lifecycle = this.context.lifecycle;

        if (oldStateData) {
            this.state.update(oldStateData);
        }

        if (!this.context.renderer) {
            this.context.renderer = new WebGLRenderer(512, 288);
            const demo = createDefaultDemoImages(512, 288);
            this.context.renderer.setImages(demo.imageA, demo.imageB);
        }

        this._ensureSettingsWidget();

        if (this._stateUnsub) this._stateUnsub();
        this._stateUnsub = this.state.subscribeAll((key) => {
            if (key === 'engine' || key === 'variant') this._updateShader();

            if (['fps', 'duration', 'clipAStart', 'clipBStart'].includes(key)) {
                if (this.state.get('isRealPreview')) {
                    if (this._rebuildTimer) clearTimeout(this._rebuildTimer);
                    this._rebuildTimer = setTimeout(() => {
                        if (this.lifecycle && !this.lifecycle.isDisposed()) {
                            this.buildFrameCache();
                        }
                    }, 800);
                }
            }

            this._syncSettingsWidget();
            this.node.setDirtyCanvas(true, true);
        });

        this._updateShader();
        this._syncSettingsWidget();

        this._initComponents();
    }

    _ensureSettingsWidget() {
        if (!this.node.widgets) this.node.widgets = [];

        this._settingsWidget = this.node.widgets.find(w => w.name === '_settings');

        if (!this._settingsWidget) {
            this._settingsWidget = {
                name: '_settings',
                type: 'text',
                value: '{}',
                options: { serialize: true },
                computeSize: () => [0, 0],
                draw: () => { },
            };
            this.node.widgets.push(this._settingsWidget);
        }
    }

    _syncSettingsWidget() {
        let widget = this.node.widgets?.find(w => w.name === '_settings');

        if (!widget) {
            this._ensureSettingsWidget();
            widget = this.node.widgets?.find(w => w.name === '_settings');
        }

        if (!widget) return;

        const settings = {
            engine: this.state.get('engine') || 'Dissolve',
            variant: this.state.get('variant') || 'powder',
            duration: Number(this.state.get('duration') ?? 2.0),
            fps: Number(this.state.get('fps') ?? 30),
            intensity: Number(this.state.get('intensity') ?? 1.0),
            easing: this.state.get('easing') || 'linear',
            clipAStart: Number(this.state.get('clipAStart') ?? 0),
            clipBStart: Number(this.state.get('clipBStart') ?? 0),
            exportFullVideos: Boolean(this.state.get('exportFullVideos') ?? false),
            use_source_fps: Boolean(this.state.get('use_source_fps') ?? false),
            curveP0: this.state.get('curveP0') || { x: 0, y: 0 },
            curveC0: this.state.get('curveC0') || { x: 0.4, y: 0 },
            curveC1: this.state.get('curveC1') || { x: 0.6, y: 1 },
            curveP1: this.state.get('curveP1') || { x: 1, y: 1 },
        };

        const newValue = JSON.stringify(settings);

        if (widget.value !== newValue) {
            widget.value = newValue;
        }
    }

    _initComponents() {
        this.components = [
            new PreviewCanvas(this),
            new TimelineBar(this),
            new CurveEditor(this),

            new EngineSelector(this),
            new VariantSelector(this),
            new RealPreviewButton(this),
            new FlavorGroup(this),

            new SectionHeader(this, 'Transition Params'),
            new SliderControl(this, 'Intensity (Chaos)', 'intensity', 0.0, 2.0, 1.0),
            new SliderControl(this, 'Duration (Sec)', 'duration', 0.1, 10, 0.1),
            new SliderControl(this, 'Animation FPS', 'fps', 12, 60, 1),
            new ToggleControl(this, 'Use Source FPS', 'use_source_fps'),

            new SectionHeader(this, 'Clip Timing'),
            new SliderControl(this, 'Clip A Start (Sec)', 'clipAStart', -600, 600, 0.1),
            new SliderControl(this, 'Clip B Start (Sec)', 'clipBStart', -600, 600, 0.1),
            new ToggleControl(this, 'Export Full Videos', 'exportFullVideos'),
        ];
    }

    getRenderer() { return this.context.renderer; }

    getEaseProgress(linearT) {
        const p0 = this.state.get('curveP0'), c0 = this.state.get('curveC0'), c1 = this.state.get('curveC1'), p1 = this.state.get('curveP1');
        if (p0 && c0 && c1 && p1) return bezierYForX(linearT, p0, c0, c1, p1, 10);
        return linearT;
    }

    getUniforms() {
        const engine = this.state.get('engine') || 'Dissolve';
        const variant = this.state.get('variant') || 'powder';
        const defaults = EngineRegistry.getUniforms(engine, variant);
        return { ...defaults, ...this.state.getSnapshot() };
    }

    _updateShader() {
        const engine = this.state.get('engine'), variant = this.state.get('variant');
        const source = EngineRegistry.getShaderSource(engine, variant);
        if (source) this.context.renderer.compileAndSetShader(`${engine}_${variant}`, source);
    }

    _setupRenderLoop() {
        let lastTime = 0;

        const loop = (currentTime) => {
            if (this.lifecycle.isDisposed()) return;

            if (this.state.get('isPlaying')) {
                const tInfo = solveTimeline(0, {
                    transitionDuration: this.state.get('duration') ?? 2.0
                });
                const totalDuration = tInfo.totalDuration;

                if (lastTime === 0 || !this._wasPlaying) {
                    lastTime = currentTime;
                    this._wasPlaying = true;
                }

                const deltaTime = (currentTime - lastTime) / 1000;
                lastTime = currentTime;

                let t = this.state.get('timelinePos') || 0;
                t += (deltaTime / totalDuration) * 100;

                if (t >= 100) t = 0;
                this.state.set('timelinePos', t);
            } else {
                this._wasPlaying = false;
                lastTime = 0;
            }

            const isReal = this.state.get('isRealPreview');

            if ((this.state.get('isPlaying') || isReal) && !this._isQueueExporting) {
                this._syncImages();
                this.node.setDirtyCanvas(true, true);
            }

            this.lifecycle.requestAnimationFrame(loop);
        };

        this.lifecycle.requestAnimationFrame(loop);
    }

    async buildFrameCache() {
        this._syncImages();

        let retries = 0;
        const maxRetries = 20;

        while (retries < maxRetries) {
            const videoA = this._videoClones['A'];
            const videoB = this._videoClones['B'];

            if (videoA && videoB && videoA.readyState >= 1 && videoB.readyState >= 1 && videoA.videoWidth > 0 && videoB.videoWidth > 0) {
                const wasPlaying = this.state.get('isPlaying');
                this.state.set('isPlaying', false);

                const duration = this.state.get('duration') ?? 2.0;
                const fps = this.state.get('fps') ?? 30; const clipAStart = this.state.get('clipAStart') ?? 0.0;
                const clipBStart = this.state.get('clipBStart') ?? 0.0;

                this._cacheReady = false;
                this._cacheProgress = 0;

                const success = await this._frameCache.build(
                    videoA, videoB, duration, clipAStart, clipBStart, fps,
                    (progress) => {
                        this._cacheProgress = progress;
                        this.node.setDirtyCanvas(true, true);
                    }
                );

                this._cacheReady = success;
                this.state.set('isPlaying', wasPlaying);
                this.node.setDirtyCanvas(true, true);
                return success;
            }

            await new Promise(r => setTimeout(r, 250));
            this._syncImages();
            retries++;
        }

        console.warn('[BlendPack] Timeout waiting for videos to load');
        return false;
    }

    getCacheStatus() {
        return {
            isBuilding: this._frameCache.isBuilding,
            isReady: this._cacheReady,
            progress: this._cacheProgress,
            memoryMB: this._frameCache.getMemoryUsage()
        };
    }

    async exportForExecution() {
        this._syncImages();

        let retries = 0;
        const maxRetries = 40;

        while (retries < maxRetries) {
            const videoA = this._videoClones['A'];
            const videoB = this._videoClones['B'];

            if (videoA && videoB && videoA.readyState >= 1 && videoB.readyState >= 1 && videoA.videoWidth > 0 && videoB.videoWidth > 0) {
                const targetW = Math.max(videoA.videoWidth || 512, videoB.videoWidth || 512);
                const targetH = Math.max(videoA.videoHeight || 288, videoB.videoHeight || 288);

                this._frameExporter = new FrameExporter(this.state);

                try {
                    this._exportedFrames = await this._frameExporter.exportAllFrames(
                        videoA, videoB, targetW, targetH,
                        (progress) => {
                            this.node.setDirtyCanvas(true, true);
                        }
                    );

                    return true;
                } catch (e) {
                    console.error("[BlendPack] Export error:", e);
                    return false;
                }
            }

            await new Promise(r => setTimeout(r, 250));
            this._syncImages();
            retries++;
        }

        console.warn('[BlendPack] Export failed: videos not ready (Timeout)');
        return false;
    }

    getExportStatus() {
        if (!this._frameExporter) return { isExporting: false, progress: 0, frameCount: 0 };
        return this._frameExporter.getStatus();
    }

    clearExportedFrames() {
        this._exportedFrames = null;
        if (this._frameExporter) {
            this._frameExporter.clear();
        }
    }

    _syncImages(onlySide = null) {
        if (!this.node || !this.context.renderer) return;
        const renderer = this.context.renderer; const isRealMode = this.state.get('isRealPreview') || this._isQueueExporting;

        if (!isRealMode) {
            this._cleanupVideoClones();
            this._frameCache.clear();
            this._cacheReady = false;

            for (let i = 0; i < 2; i++) {
                const side = (i === 0 ? 'A' : 'B');
                if (onlySide && side !== onlySide) continue;
                if (this._lastImages && this._lastImages[side]?.isDemo) continue;

                const demo = createDefaultDemoImages(512, 288);
                const demoImg = (i === 0 ? demo.imageA : demo.imageB);
                demoImg.isDemo = true;
                renderer.updateImage(side, demoImg);

                if (!this._lastImages) this._lastImages = {};
                this._lastImages[side] = demoImg;
            }
            return;
        }

        let skipLiveSync = false;
        const progress = (this.state.get('timelinePos') || 0) / 100;

        if (this._cacheReady && this._frameCache.isReady()) {
            const syncCanvasA = this._syncCanvases['A'];
            const syncCanvasB = this._syncCanvases['B'];

            const frameA = this._frameCache.getFrame('A', progress);
            const frameB = this._frameCache.getFrame('B', progress);

            if (frameA && frameB) {
                syncCanvasA.width = frameA.width;
                syncCanvasA.height = frameA.height;
                syncCanvasA.getContext('2d', { alpha: false, willReadFrequently: true }).putImageData(frameA, 0, 0);
                renderer.updateImage('A', syncCanvasA);

                syncCanvasB.width = frameB.width;
                syncCanvasB.height = frameB.height;
                syncCanvasB.getContext('2d', { alpha: false, willReadFrequently: true }).putImageData(frameB, 0, 0);
                renderer.updateImage('B', syncCanvasB);

                skipLiveSync = true;
            }
        }

        if (!skipLiveSync) {
            for (let i = 0; i < 2; i++) {
                const side = (i === 0 ? 'A' : 'B');
                if (onlySide && side !== onlySide) continue;

                const input = this.node.inputs?.[i];
                if (!input?.link) continue; const link = this.node.graph.links[input.link];
                if (!link) continue;

                let originNode = this.node.graph.getNodeById(link.origin_id);
                const initialId = link.origin_id;

                let safety = 0;
                while (originNode && safety < 10) {
                    const type = (originNode.type || originNode.comfyClass || "").toLowerCase();
                    if (!type.includes("reroute") && !type.includes("wire") && !type.includes("pipe")) break;

                    const input = originNode.inputs?.[0];
                    if (!input?.link) break;
                    const nextLink = this.node.graph.links[input.link];
                    if (!nextLink) break;
                    originNode = this.node.graph.getNodeById(nextLink.origin_id);
                    safety++;
                }

                if (originNode) {
                    let sourceEl = null;

                    const findEl = (root) => {
                        if (!root) return null;
                        if (root.tagName === 'VIDEO' || root.tagName === 'CANVAS' || root.tagName === 'IMG') return root;
                        if (root.querySelector) {
                            const el = root.querySelector('video, canvas, img');
                            if (el) return el;
                        }
                        if (root.childNodes) {
                            for (const child of root.childNodes) {
                                const found = findEl(child);
                                if (found) return found;
                            }
                        }
                        return null;
                    };

                    sourceEl = originNode.video || originNode.canvas || originNode.previewElement ||
                        originNode.videoContainer || originNode.video_widget?.video ||
                        originNode.video_widget?.element || originNode.preview_widget?.video;

                    const validTags = ['VIDEO', 'CANVAS', 'IMG'];
                    if (sourceEl && typeof sourceEl !== 'string' && (!sourceEl.tagName || !validTags.includes(sourceEl.tagName))) {
                        sourceEl = findEl(sourceEl);
                    }

                    if (!sourceEl && originNode.widgets) {
                        for (const w of originNode.widgets) {
                            if (!w) continue;

                            if (w.videoEl && (w.videoEl.src || w.videoEl.readyState > 0)) {
                                sourceEl = w.videoEl;
                                break;
                            }
                            if (w.imgEl && w.imgEl.src) {
                                sourceEl = w.imgEl;
                                break;
                            }

                            const candidate = w.element || w.inputEl || w.video || w.canvas || w.img || w.value;
                            const found = findEl(candidate);
                            if (found) {
                                sourceEl = found;
                                break;
                            }
                        }
                    }
                    if (!sourceEl || typeof sourceEl === 'string') {
                        if (Array.isArray(originNode.imgs) && originNode.imgs.length > 0) {
                            sourceEl = originNode.imgs[0];
                        }
                        if (!sourceEl && Array.isArray(originNode.images) && originNode.images.length > 0) {
                            sourceEl = originNode.images[0];
                        }
                        if (!sourceEl && Array.isArray(originNode.cached_images)) {
                            sourceEl = originNode.cached_images[0];
                        }
                    }

                    if (sourceEl && typeof sourceEl === 'string') {
                        const found = (originNode.imgs || []).find(f => f.src && f.src.includes(sourceEl));
                        if (found) sourceEl = found;
                    }

                    if (sourceEl && !sourceEl.tagName) sourceEl = null;

                    if (sourceEl) {
                        let renderTarget = sourceEl;

                        if (sourceEl.tagName === 'VIDEO') {
                            renderTarget = this._getOrCreateVideoClone(side, sourceEl);

                            if (!renderTarget || renderTarget.readyState < 1) {
                                renderTarget = sourceEl;
                            } else {
                                if (!this._frameCache.isBuilding) {
                                    this._updateClonePosition(side, renderTarget, sourceEl);
                                }
                            }
                        }

                        if (renderTarget.tagName !== 'VIDEO' && this._lastImages && this._lastImages[side] === renderTarget) {
                            continue;
                        }

                        const syncCanvas = this._syncCanvases[side];
                        if (renderTarget.tagName === 'VIDEO' || renderTarget.tagName === 'CANVAS' || renderTarget.tagName === 'IMG') {
                            const isVideo = renderTarget.tagName === 'VIDEO';

                            const isReady = !isVideo || renderTarget.readyState >= 1;

                            const isSeeking = isVideo && renderTarget.seeking;

                            if (isReady) {
                                const targetW = renderer.width || 512;
                                const targetH = renderer.height || 288;

                                if (syncCanvas.width !== targetW || syncCanvas.height !== targetH) {
                                    syncCanvas.width = targetW;
                                    syncCanvas.height = targetH;
                                }

                                const sctx = syncCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
                                sctx.imageSmoothingEnabled = true;

                                if (!isSeeking) {
                                    try {
                                        sctx.drawImage(renderTarget, 0, 0, syncCanvas.width, syncCanvas.height);
                                        renderer.updateImage(side, syncCanvas);
                                    } catch (e) {
                                    }
                                }
                            }
                        } else {
                            renderer.updateImage(side, renderTarget);
                        }

                        if (!this._lastImages) this._lastImages = {};
                        this._lastImages[side] = renderTarget;
                    } else {
                        const side = (i === 0 ? 'A' : 'B');
                        if (this._lastImages && this._lastImages[side]?.isDemo) continue;

                        const demo = createDefaultDemoImages(512, 288);
                        const demoImg = (i === 0 ? demo.imageA : demo.imageB);
                        demoImg.isDemo = true;
                        renderer.updateImage(side, demoImg);

                        if (!this._lastImages) this._lastImages = {};
                        this._lastImages[side] = demoImg;
                    }
                } else {
                    const side = (i === 0 ? 'A' : 'B');
                    if (this._lastImages && this._lastImages[side]?.isDemo) continue;

                    const demo = createDefaultDemoImages(512, 288);
                    const demoImg = (i === 0 ? demo.imageA : demo.imageB);
                    demoImg.isDemo = true;
                    renderer.updateImage(side, demoImg);

                    if (!this._lastImages) this._lastImages = {};
                    this._lastImages[side] = demoImg;
                }
            }
        }

        const prog = this.getEaseProgress(progress);
        renderer.render(prog, this.state.get('intensity') || 1.0, this.getUniforms());
    }

    _getOrCreateVideoClone(side, sourceVideo) {
        const currentSrc = sourceVideo.src;

        if (this._videoClones[side]) {
            const clone = this._videoClones[side];

            if (clone._origSrc !== currentSrc) {
                clone.pause();
                clone.src = '';
                clone.remove();
                delete this._videoClones[side];
            } else {
                return clone;
            }
        }

        const clone = document.createElement('video');
        clone._origSrc = currentSrc; clone.src = currentSrc;
        clone.muted = true;
        clone.loop = false;
        clone.playsInline = true;
        clone.autoplay = false;
        clone.preload = 'auto';

        clone.style.cssText = 'position:fixed;left:0;top:0;width:64px;height:64px;pointer-events:none;opacity:0.02;z-index:-1;';
        document.body.appendChild(clone);

        clone.addEventListener('seeked', () => {
            if (clone._pendingTarget !== undefined) {
                const nextTarget = clone._pendingTarget;
                delete clone._pendingTarget;
                clone.currentTime = nextTarget;
                clone._lastTargetTime = nextTarget;
                return;
            }

            this._syncSingleSide(side);
        });

        clone.addEventListener('loadedmetadata', () => {
            clone.play().then(() => {
                clone.pause();
                this._updateClonePosition(side, clone, sourceVideo);
            }).catch(() => {
                this._updateClonePosition(side, clone, sourceVideo);
            });
        });

        this._videoClones[side] = clone;
        return clone;
    }

    _updateClonePosition(side, clone, sourceVideo) {
        if (!clone || clone.readyState < 1) return;

        const tInfo = solveTimeline((this.state.get('timelinePos') ?? 0) / 100, {
            transitionDuration: this.state.get('duration') ?? 2.0,
            clipAStart: this.state.get('clipAStart') ?? 0.0,
            clipBStart: this.state.get('clipBStart') ?? 0.0,
            videoDurA: side === 'A' ? (clone.duration || sourceVideo.duration || 10) : 10,
            videoDurB: side === 'B' ? (clone.duration || sourceVideo.duration || 10) : 10
        });

        const targetTime = (side === 'A') ? tInfo.timeA : tInfo.timeB;

        if (clone.seeking) {
            clone._pendingTarget = targetTime;
            return;
        }

        const lastTarget = clone._lastTargetTime ?? -1;
        const targetDiff = Math.abs(targetTime - lastTarget);

        if (targetDiff > 0.01) {
            clone.currentTime = targetTime;
            clone._lastTargetTime = targetTime;

            if (clone.currentTime === 0 && targetTime > 0.01) {
                clone.currentTime = targetTime;
            }
        } else if (clone._pendingTarget !== undefined) {
            delete clone._pendingTarget;
        }
    }

    _cleanupVideoClones() {
        for (const side of Object.keys(this._videoClones)) {
            const clone = this._videoClones[side];
            if (clone) {
                clone.pause();
                clone.src = '';
                clone.remove();
            }
        }
        this._videoClones = {};
    }

    _syncSingleSide(side) {
        const renderer = this.context.renderer;
        if (!renderer) return;

        const clone = this._videoClones[side];
        if (!clone || clone.readyState < 1) return;

        const syncCanvas = this._syncCanvases[side];
        const targetW = renderer.width || 512;
        const targetH = renderer.height || 288;

        if (syncCanvas.width !== targetW || syncCanvas.height !== targetH) {
            syncCanvas.width = targetW;
            syncCanvas.height = targetH;
        }

        const sctx = syncCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
        sctx.imageSmoothingEnabled = true;

        try {
            sctx.drawImage(clone, 0, 0, syncCanvas.width, syncCanvas.height);
            renderer.updateImage(side, syncCanvas);
        } catch (e) {
        }
    }

    _bindNodeMethods() {
        const self = this;

        this.node.drawWidgets = () => { };
        if (this.node.widgets) {
            this.node.widgets = this.node.widgets.filter(w => w.name === '_settings');
        }

        this.node.onDrawForeground = function (ctx) {
            if (this.flags?.collapsed) return;

            const w = this.size[0];
            let yCursor = 10;
            const px = LAYOUT.PADDING_X || 20;

            for (let i = 0; i < self.components.length; i++) {
                const comp = self.components[i];
                if (!comp) continue;

                if (comp instanceof EngineSelector) {
                    const nextV = self.components[i + 1];
                    comp.rect.x = px;
                    const eY = comp.draw(ctx, yCursor, (w - px * 2) / 2 - 4, self.lastMousePos);
                    if (nextV instanceof VariantSelector) {
                        nextV.rect.x = px + (w - px * 2) / 2 + 4;
                        const vY = nextV.draw(ctx, yCursor, (w - px * 2) / 2 - 4, self.lastMousePos);
                        yCursor = Math.max(eY, vY);
                        i++;
                    } else {
                        yCursor = eY;
                    }
                } else {
                    const returnedY = comp.draw(ctx, yCursor, w, self.lastMousePos);

                    if (typeof returnedY !== 'number' || returnedY <= yCursor) {
                        yCursor += comp.rect.height + LAYOUT.ROW_GAP;
                    } else {
                        yCursor = returnedY;
                    }
                }
            }

            const footerH = 28;
            this.size[1] = Math.max(this.size[1], yCursor + footerH + LAYOUT.PADDING_X);
            const fy = this.size[1] - footerH;

            ctx.fillStyle = THEME.bgCard;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, fy, w, footerH, [0, 0, LAYOUT.RADIUS_SM || 8, LAYOUT.RADIUS_SM || 8]);
            else ctx.rect(0, fy, w, footerH);
            ctx.fill();

            ctx.strokeStyle = THEME.border;
            ctx.beginPath();
            ctx.moveTo(0, fy);
            ctx.lineTo(w, fy);
            ctx.stroke();

            ctx.fillStyle = THEME.textMuted;
            ctx.font = LAYOUT.LABEL_FONT || '10px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const engine = self.state.get('engine');
            const variant = self.state.get('variant');
            const desc = self.app.getVariantDescription(engine, variant);
            ctx.fillText(`PRO: ${variant.toUpperCase()} - ${desc}`, LAYOUT.PADDING_X, fy + footerH / 2);


            if (self._isQueueExporting) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, 0, w, this.size[1]);

                ctx.fillStyle = THEME.primary;
                ctx.font = 'bold 16px "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const status = self.getExportStatus();
                const progress = status ? status.progress : 0;

                ctx.fillText('Exporting Frames...', w / 2, this.size[1] / 2 - 20);

                ctx.fillStyle = THEME.text;
                ctx.font = '12px monospace';
                ctx.fillText(`WebGL Render: ${(progress * 100).toFixed(0)}%`, w / 2, this.size[1] / 2 + 10);

                const barW = w * 0.6;
                const barH = 6;
                const barX = (w - barW) / 2;
                const barY = this.size[1] / 2 + 30;

                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 3);
                else ctx.fillRect(barX, barY, barW, barH);
                ctx.fill();

                ctx.fillStyle = THEME.primary;
                ctx.beginPath();
                const fillW = Math.max(0, Math.min(barW, barW * progress));
                if (ctx.roundRect) ctx.roundRect(barX, barY, fillW, barH, 3);
                else ctx.fillRect(barX, barY, fillW, barH);
                ctx.fill();
            }

            if (self.lastMousePos && self.node._originalSlotNames) {
                const mx = self.lastMousePos.x;
                const my = self.lastMousePos.y;
                let foundSlot = null;

                if (this.inputs) {
                    for (let i = 0; i < this.inputs.length; i++) {
                        const pos = this.getConnectionPos(true, i);
                        const localX = pos[0] - this.pos[0];
                        const localY = pos[1] - this.pos[1];
                        if (Math.abs(mx - localX) < 20 && Math.abs(my - localY) < 12) {
                            foundSlot = { text: self.node._originalSlotNames.inputs[i], x: localX, y: localY, isInput: true };
                            break;
                        }
                    }
                }

                if (!foundSlot && this.outputs) {
                    for (let i = 0; i < this.outputs.length; i++) {
                        const pos = this.getConnectionPos(false, i);
                        const localX = pos[0] - this.pos[0];
                        const localY = pos[1] - this.pos[1];
                        if (Math.abs(mx - localX) < 20 && Math.abs(my - localY) < 12) {
                            foundSlot = { text: self.node._originalSlotNames.outputs[i], x: localX, y: localY, isInput: false };
                            break;
                        }
                    }
                }

                if (foundSlot) {
                    self._drawSlotLabel(ctx, foundSlot.text, foundSlot.x, foundSlot.y, foundSlot.isInput);
                }
            }
        };

        this.node.onMouseMove = function (e, pos) {
            const lp = { x: pos[0], y: pos[1] };
            self.lastMousePos = lp;
            let hit = false;
            for (const c of self.components) {
                if (c.onMouseMove) c.onMouseMove(lp, e);
                if (c._isInRect && c._isInRect(lp)) {
                    if (!(c instanceof SectionHeader) && !(c instanceof PreviewCanvas)) hit = true;
                }
            }
            if (window.app?.canvas?.canvas) window.app.canvas.canvas.style.cursor = hit ? "pointer" : "default";
            this.setDirtyCanvas(true, true);
        };

        this.node.onMouseDown = function (e, pos) {
            const lp = { x: pos[0], y: pos[1] };
            for (const c of self.components) {
                if (c.onMouseDown && c.onMouseDown(lp, e)) return true;
            }
        };

        this.node.onMouseUp = function (e, pos) {
            const lp = { x: pos[0], y: pos[1] };
            for (const c of self.components) {
                if (c.onMouseUp) c.onMouseUp(lp, e);
            }
        };


        this.node.onMouseLeave = function (e) {
            for (const c of self.components) {
                if (c.onMouseUp) c.onMouseUp({ x: 0, y: 0 }, e);
            }
        };

        this.node.onConfigure = function (data) {
            if (this.widgets) {
                this.widgets = this.widgets.filter(w => w.name === '_settings');
            }
            self._ensureSettingsWidget();
            this.drawWidgets = () => { };

            if (this.properties?.blendPackState) {
                self.state.update(this.properties.blendPackState);
            }
            if (data?.widgets_values && data.widgets_values[0]) {
                try {
                    const savedSettings = JSON.parse(data.widgets_values[0]);
                    const updates = {};
                    if (savedSettings.engine) updates.engine = savedSettings.engine;
                    if (savedSettings.variant) updates.variant = savedSettings.variant;
                    if (savedSettings.duration !== undefined) updates.duration = savedSettings.duration;
                    if (savedSettings.fps !== undefined) updates.fps = savedSettings.fps;
                    if (savedSettings.intensity !== undefined) updates.intensity = savedSettings.intensity;

                    if (savedSettings.easing) updates.easing = savedSettings.easing;
                    if (savedSettings.curveP0) updates.curveP0 = savedSettings.curveP0;
                    if (savedSettings.curveC0) updates.curveC0 = savedSettings.curveC0;
                    if (savedSettings.curveC1) updates.curveC1 = savedSettings.curveC1;
                    if (savedSettings.curveP1) updates.curveP1 = savedSettings.curveP1;

                    if (savedSettings.clipAStart !== undefined) updates.clipAStart = savedSettings.clipAStart;
                    if (savedSettings.clipBStart !== undefined) updates.clipBStart = savedSettings.clipBStart;
                    if (savedSettings.exportFullVideos !== undefined) updates.exportFullVideos = savedSettings.exportFullVideos;
                    if (savedSettings.use_source_fps !== undefined) updates.use_source_fps = savedSettings.use_source_fps;

                    self.state.update(updates);
                } catch (e) { }
            }
            self._syncSettingsWidget();
        };

        this.node.onSerialize = function (data) {
            const currentSettings = {
                engine: self.state.get('engine') || 'Dissolve',
                variant: self.state.get('variant') || 'powder',
                duration: Number(self.state.get('duration') ?? 2.0),
                fps: Number(self.state.get('fps') ?? 30),
                intensity: Number(self.state.get('intensity') ?? 1.0),
                easing: self.state.get('easing') || 'linear',
                clipAStart: Number(self.state.get('clipAStart') ?? 0),
                clipBStart: Number(self.state.get('clipBStart') ?? 0),
                curveP0: self.state.get('curveP0') || { x: 0, y: 0 },
                curveC0: self.state.get('curveC0') || { x: 0.4, y: 0 },
                curveC1: self.state.get('curveC1') || { x: 0.6, y: 1 },
                curveP1: self.state.get('curveP1') || { x: 1, y: 1 },
                ...self.state.getSnapshot()
            };

            data.properties = data.properties || {};
            data.properties.blendPackState = self.state.getSnapshot();

            let settingsJson = JSON.stringify(currentSettings);

            if (self._exportedFrames && self._exportedFrames.length > 0) {
                try {
                    const settings = JSON.parse(settingsJson);
                    settings.preRenderedFrames = self._exportedFrames;
                    settingsJson = JSON.stringify(settings);
                } catch (e) {
                    console.error('[BlendPack] Failed to include pre-rendered frames:', e);
                }
            }

            data.widgets_values = [settingsJson];
        };

        this.node.onRemoved = function () {
            self.app.unregisterNode(this.id);
        };
    }
}
