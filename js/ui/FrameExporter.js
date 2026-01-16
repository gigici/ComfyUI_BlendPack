

import { WebGLRenderer } from '../renderer/WebGLRenderer.js';
import { EngineRegistry } from '../engine/EngineRegistry.js';
import { bezierYForX } from '../utils/MathUtils.js';
import { solveTimeline, solveFullTimeline, getFullTimelineFrameCount } from '../utils/TimelineUtils.js';

export class FrameExporter {
    constructor(state) {
        this.state = state;
        this._renderer = null;
        this.exportedFrames = [];
        this._isExporting = false;
        this.exportProgress = 0;

        this._cloneA = null;
        this._cloneB = null;
        this._cloneContainer = null;

        this._aborted = false;
    }

    async exportAllFrames(videoA, videoB, targetWidth, targetHeight, onProgress) {
        this._aborted = false;

        const engine = this.state.get('engine') || 'Dissolve';
        const variant = this.state.get('variant') || 'powder';
        const transitionDuration = this.state.get('duration') ?? 2.0;
        const fps = this.state.get('fps') ?? 30;
        const exportFullVideos = this.state.get('exportFullVideos') ?? false;

        await this._createVideoClones(videoA, videoB);
        if (this._aborted) return [];

        const videoDurA = this._cloneA?.duration || 10;
        const videoDurB = this._cloneB?.duration || 10;

        // Calculate frame count based on export mode
        let numFrames;
        if (exportFullVideos) {
            numFrames = getFullTimelineFrameCount({
                transitionDuration,
                videoDurA,
                videoDurB,
                fps
            });
        } else {
            numFrames = Math.ceil(transitionDuration * fps);
        }


        this._renderer = new WebGLRenderer(targetWidth, targetHeight);

        const shaderSource = EngineRegistry.getShaderSource(engine, variant);
        if (shaderSource) {
            this._renderer.compileAndSetShader(`${engine}_${variant}`, shaderSource);
        }

        this.exportedFrames = new Array(numFrames);
        this._isExporting = true;
        this.exportProgress = 0;

        const MAX_CONCURRENT_UPLOADS = 4;
        const uploadQueue = [];
        let activeUploads = 0;

        for (let i = 0; i < numFrames; i++) {
            if (this._aborted) break;

            let tInfo;
            if (exportFullVideos) {
                tInfo = solveFullTimeline(i / (numFrames - 1 || 1), {
                    transitionDuration,
                    videoDurA,
                    videoDurB
                });
            } else {
                tInfo = solveTimeline(i / (numFrames - 1 || 1), {
                    transitionDuration,
                    clipAStart: this.state.get('clipAStart') ?? 0,
                    clipBStart: this.state.get('clipBStart') ?? 0,
                    videoDurA,
                    videoDurB
                });
            }

            await this._extractFrame(this._cloneA, tInfo.timeA, 'A');
            if (this._aborted) break;
            await this._extractFrame(this._cloneB, tInfo.timeB, 'B');
            if (this._aborted) break;

            const easedProgress = this._getEaseProgress(tInfo.transitionProgress);
            this._renderer.setImages(this._cloneA, this._cloneB);

            const defaults = EngineRegistry.getUniforms(engine, variant);
            const uniforms = { ...defaults, ...this.state.getSnapshot() };

            this._renderer.render(easedProgress, this.state.get('intensity') || 1.0, uniforms);

            const canvas = this._renderer.getCanvas();
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.90));

            if (this._aborted) break;

            while (activeUploads >= MAX_CONCURRENT_UPLOADS) {
                await Promise.race(uploadQueue);
            }

            activeUploads++;
            const uploadPromise = this._uploadFrame(blob, `frame_${i.toString().padStart(5, '0')}.webp`)
                .then(filename => {
                    this.exportedFrames[i] = filename;
                    activeUploads--;

                    this.exportProgress = (i + 1) / numFrames;
                    if (onProgress) onProgress(this.exportProgress);

                    const idx = uploadQueue.indexOf(uploadPromise);
                    if (idx > -1) uploadQueue.splice(idx, 1);
                })
                .catch(err => {
                    console.error(`[FrameExporter] Upload failed for frame ${i}:`, err);
                    activeUploads--;
                });

            uploadQueue.push(uploadPromise);
        }

        if (uploadQueue.length > 0) await Promise.all(uploadQueue);

        this._isExporting = false;
        const finalFrames = this.exportedFrames.filter(f => f);

        this._cleanupClones();

        if (this._renderer) {
            this._renderer.dispose();
            this._renderer = null;
        }

        return finalFrames;
    }

    async _createVideoClones(videoA, videoB) {
        this._destroyClones();
        if (this._renderer) {
            this._renderer.dispose();
            this._renderer = null;
        }

        this._cloneContainer = document.createElement('div');
        Object.assign(this._cloneContainer.style, {
            position: 'fixed', top: '-9999px', left: '-9999px',
            width: '1px', height: '1px', visibility: 'hidden',
            pointerEvents: 'none', zIndex: '-1000'
        });
        document.body.appendChild(this._cloneContainer);

        const createClone = (srcVideo, label) => {
            return new Promise((resolve) => {
                if (this._aborted) { resolve(null); return; }
                if (!srcVideo || !srcVideo.src) {
                    console.warn(`[FrameExporter] No source video for ${label}`);
                    resolve(null);
                    return;
                }

                const clone = document.createElement('video');
                clone.crossOrigin = 'anonymous';
                clone.muted = true;
                clone.playsInline = true;
                clone.autoplay = false;
                clone.preload = 'auto';

                clone.width = srcVideo.videoWidth || 1280;
                clone.height = srcVideo.videoHeight || 720;

                this._cloneContainer.appendChild(clone);

                let resolved = false;
                const finish = () => {
                    if (resolved) return;
                    resolved = true;
                    clone.onloadedmetadata = null;
                    clone.onloadeddata = null;
                    clone.onerror = null;
                    resolve(clone);
                };

                clone.onloadedmetadata = () => {
                    if (clone.duration && clone.duration > 0) {

                        finish();
                    }
                };

                clone.onloadeddata = () => {
                    if (!resolved && clone.readyState >= 2) {

                        finish();
                    }
                };

                clone.onerror = (e) => {
                    console.error(`[FrameExporter] Error loading clone ${label}:`, e);
                    finish();
                };

                clone.src = srcVideo.src;
                clone.load();

                setTimeout(() => {
                    if (!resolved) {
                        console.warn(`[FrameExporter] Timeout waiting for clone ${label} metadata, proceeding anyway`);
                        finish();
                    }
                }, 5000);
            });
        };

        this._cloneA = await createClone(videoA, 'A');
        this._cloneB = await createClone(videoB, 'B');
    }

    async _extractFrame(video, time, which, retries = 5) {
        return new Promise((resolve) => {
            if (this._aborted || !video) return resolve();

            const clampedTime = Math.max(0, Math.min(time, video.duration || 999));

            let settled = false;
            let timeoutId = null;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                video.removeEventListener('seeked', onSeeked);
            };

            const finish = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve();
            };

            const onSeeked = () => finish();

            if (video.readyState === 0) video.load();

            video.addEventListener('seeked', onSeeked, { once: true });

            try {
                video.currentTime = clampedTime;
            } catch (e) {
                console.error(`[FrameExporter] Error setting currentTime for ${which}:`, e);
                return finish();
            }

            timeoutId = setTimeout(() => {
                if (settled || this._aborted) return;
                cleanup();

                if (retries > 0) {
                    setTimeout(() => {
                        if (this._aborted) return resolve();
                        resolve(this._extractFrame(video, time, which, retries - 1));
                    }, 100);
                } else {
                    resolve();
                }
            }, 500);
        });
    }

    _destroyClones() {
        if (this._cloneA) {
            try {
                this._cloneA.pause();
                this._cloneA.onloadedmetadata = null;
                this._cloneA.onloadeddata = null;
                this._cloneA.onerror = null;
                this._cloneA.onseeked = null;
            } catch (e) { /* ignore */ }
            this._cloneA.src = '';
            this._cloneA.remove();
            this._cloneA = null;
        }
        if (this._cloneB) {
            try {
                this._cloneB.pause();
                this._cloneB.onloadedmetadata = null;
                this._cloneB.onloadeddata = null;
                this._cloneB.onerror = null;
                this._cloneB.onseeked = null;
            } catch (e) { /* ignore */ }
            this._cloneB.src = '';
            this._cloneB.remove();
            this._cloneB = null;
        }
        if (this._cloneContainer) {
            this._cloneContainer.innerHTML = '';
            this._cloneContainer.remove();
            this._cloneContainer = null;
        }
    }

    _cleanupClones() {
        this._aborted = true;
        this._destroyClones();
    }

    async _uploadFrame(blob, filename) {
        if (this._aborted) return null;

        const formData = new FormData();
        formData.append('image', blob, filename);
        formData.append('type', 'temp');

        const response = await fetch('/upload/image', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);

        const result = await response.json();
        return {
            name: result.name || filename,
            subfolder: 'blendpack_export',
            type: 'temp'
        };
    }

    _getEaseProgress(linearT) {
        const easing = this.state.get('easing') || 'linear';
        if (easing === 'linear') return linearT;

        const p0 = this.state.get('curveP0') || { x: 0, y: 0 };
        const c0 = this.state.get('curveC0') || { x: 0.45, y: 0 };
        const c1 = this.state.get('curveC1') || { x: 0.55, y: 1 };
        const p1 = this.state.get('curveP1') || { x: 1, y: 1 };

        return bezierYForX(linearT, p0, c0, c1, p1, 20);
    }

    getStatus() {
        return {
            isExporting: this._isExporting,
            progress: this.exportProgress,
            frameCount: this.exportedFrames.length
        };
    }

    abort() {
        this._aborted = true;
        this._isExporting = false;
    }

    clear() {
        this._aborted = true;
        this.exportedFrames = [];
        this.exportProgress = 0;
        this._isExporting = false;
        if (this._renderer) {
            this._renderer.dispose();
            this._renderer = null;
        }
        this._cleanupClones();
    }
}
