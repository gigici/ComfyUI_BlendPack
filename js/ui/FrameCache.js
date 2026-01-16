import { solveTimeline } from '../utils/TimelineUtils.js';

export class FrameCache {
    constructor() {
        this.cacheA = [];
        this.cacheB = [];
        this.frameCount = 0;
        this.isBuilding = false;
        this.buildProgress = 0;
        this.fps = 30;

        this._workCanvas = document.createElement('canvas');
        this._workCanvas.width = 512;
        this._workCanvas.height = 288;
        this._workCtx = this._workCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
    }

    async build(videoA, videoB, transitionDuration, clipAStart, clipBStart, fps, onProgress) {
        if (this.isBuilding) {
            this._aborted = true;
            await new Promise(r => setTimeout(r, 100));
        }

        this._aborted = false;
        this.isBuilding = true;
        this.buildProgress = 0;
        this.cacheA = [];
        this.cacheB = [];
        this.transitionProgress = [];
        this.fps = fps || 30;

        const tInfoFull = solveTimeline(0, {
            transitionDuration,
            clipAStart,
            clipBStart,
            videoDurA: videoA.duration || 10,
            videoDurB: videoB.duration || 10
        });

        const totalDuration = tInfoFull.totalDuration;
        this.frameCount = Math.ceil(totalDuration * this.fps);
        this.totalDuration = totalDuration;

        console.log(`[FrameCache] Building ${this.frameCount} frames @ ${fps}fps (Total: ${totalDuration.toFixed(2)}s)`);

        try {
            for (let i = 0; i < this.frameCount; i++) {
                if (this._aborted) {
                    console.log('[FrameCache] Build aborted');
                    this.isBuilding = false;
                    return false;
                }

                if (!videoA || !videoB || !isFinite(videoA.duration) || !isFinite(videoB.duration)) {
                    console.warn('[FrameCache] Videos invalidated during build, aborting');
                    this.isBuilding = false;
                    return false;
                }

                const globalProg = i / (this.frameCount - 1 || 1);

                const tInfo = solveTimeline(globalProg, {
                    transitionDuration,
                    clipAStart,
                    clipBStart,
                    videoDurA: videoA.duration || 10,
                    videoDurB: videoB.duration || 10
                });

                const frameA = await this._extractFrame(videoA, tInfo.timeA);
                const frameB = await this._extractFrame(videoB, tInfo.timeB);

                this.cacheA.push(frameA);
                this.cacheB.push(frameB);
                this.transitionProgress.push(tInfo.transitionProgress);

                const MAX_CACHE_SIZE_MB = 512;
                const currentUsage = this.getMemoryUsage();

                if (currentUsage > MAX_CACHE_SIZE_MB) {
                    console.warn(`[FrameCache] Memory limit reached (${currentUsage.toFixed(0)}MB > ${MAX_CACHE_SIZE_MB}MB). Stopping cache.`);
                    this.isBuilding = false;
                    return true;
                }

                this.buildProgress = (i + 1) / this.frameCount;
                if (onProgress) onProgress(this.buildProgress);
            }

            console.log(`[FrameCache] Build complete! ${this.frameCount} frames cached.`);
            this.isBuilding = false;
            return true;

        } catch (err) {
            console.error('[FrameCache] Build failed:', err);
            this.isBuilding = false;
            return false;
        }
    }

    async _extractFrame(video, time) {
        return new Promise((resolve, reject) => {
            if (!video || !isFinite(video.duration) || !isFinite(time)) {
                const blankFrame = this._workCtx.getImageData(0, 0, this._workCanvas.width, this._workCanvas.height);
                resolve(blankFrame);
                return;
            }

            time = Math.max(0, Math.min(time, video.duration - 0.001));

            let resolved = false;

            const grabFrame = () => {
                if (resolved) return;
                resolved = true;
                video.removeEventListener('seeked', onSeeked);

                this._workCtx.drawImage(video, 0, 0, this._workCanvas.width, this._workCanvas.height);

                const imageData = this._workCtx.getImageData(0, 0, this._workCanvas.width, this._workCanvas.height);
                resolve(imageData);
            };

            const onSeeked = () => {
                setTimeout(grabFrame, 16);
            };

            video.addEventListener('seeked', onSeeked);
            video.currentTime = time;

            setTimeout(() => {
                if (!resolved) {
                    grabFrame();
                }
            }, 1000);
        });
    }

    getFrameData(progress) {
        if (this.cacheA.length === 0) return null;

        const index = Math.min(Math.floor(progress * this.cacheA.length), this.cacheA.length - 1);
        return {
            frameA: this.cacheA[index],
            frameB: this.cacheB[index],
            transitionProgress: this.transitionProgress[index] || 0
        };
    }

    getFrame(side, progress) {
        const cache = side === 'A' ? this.cacheA : this.cacheB;
        if (cache.length === 0) return null;

        const index = Math.min(Math.floor(progress * cache.length), cache.length - 1);
        return cache[index];
    }

    isReady() {
        return !this.isBuilding && this.cacheA.length > 0 && this.cacheB.length > 0;
    }

    clear() {
        this._aborted = true; this.cacheA = [];
        this.cacheB = [];
        this.frameCount = 0;
        this.buildProgress = 0;
        this.isBuilding = false;
    }

    getMemoryUsage() {
        const bytesPerFrame = this._workCanvas.width * this._workCanvas.height * 4; const totalFrames = this.cacheA.length + this.cacheB.length;
        return (totalFrames * bytesPerFrame) / (1024 * 1024);
    }
}
