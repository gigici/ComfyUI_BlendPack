import { THEME, LAYOUT } from '../Theme.js';
import { solveTimeline } from '../../utils/TimelineUtils.js';

export class PreviewCanvas {
    constructor(nodeUI) {
        this.ui = nodeUI;
        this.rect = { x: 0, y: 0, w: 0, h: 200 };
        this.margin = 32;
    }

    draw(ctx, y, width, mousePos) {
        const px = (LAYOUT.PADDING_X || 16) + 8;
        this.rect.x = px;
        this.rect.y = y;
        this.rect.w = width - (px * 2);
        this.rect.h = 200;

        const isHovered = (mousePos && this._isInRect(mousePos));
        const isPlaying = this.ui.state.get('isPlaying');

        ctx.save();

        ctx.fillStyle = "#000";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 6);
        else ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

        const renderer = this.ui.getRenderer();
        if (renderer?.gl && renderer.canvas) {
            const timelineProgress = (this.ui.state.get('timelinePos') || 0) / 100;

            const tInfo = solveTimeline(timelineProgress, {
                transitionDuration: this.ui.state.get('duration') ?? 2.0,
                clipAStart: this.ui.state.get('clipAStart') ?? 0,
                clipBStart: this.ui.state.get('clipBStart') ?? 0,
                videoDurA: this.ui._videoClones?.['A']?.duration || 10,
                videoDurB: this.ui._videoClones?.['B']?.duration || 10
            });

            const progress = this.ui.getEaseProgress(tInfo.transitionProgress);
            const intensity = this.ui.state.get('intensity') || 1.0;

            renderer.resize(512, 288);
            renderer.render(progress, intensity, this.ui.getUniforms());

            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 6);
            else ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
            ctx.clip();

            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(renderer.canvas, this.rect.x, this.rect.y, this.rect.w, this.rect.h);

            if (this.ui.state.get('isRealPreview')) {
                const cloneA = this.ui._videoClones?.['A'];
                const cloneB = this.ui._videoClones?.['B'];

                ctx.font = "bold 9px 'Roboto Mono', monospace";
                ctx.textAlign = "right";

                if (cloneA && cloneA.readyState >= 1) {
                    const timeA = cloneA.currentTime.toFixed(2);
                    const durA = (cloneA.duration || 0).toFixed(1);
                    const labelA = `CLIP A: ${timeA}s / ${durA}s`;
                    const twA = ctx.measureText(labelA).width + 12;

                    ctx.fillStyle = "rgba(0,0,0,0.7)";
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(this.rect.x + this.rect.w - twA - 8, this.rect.y + 8, twA, 18, 4);
                    ctx.fill();

                    ctx.fillStyle = "#f97316";
                    ctx.fillText(labelA, this.rect.x + this.rect.w - 14, this.rect.y + 17);
                }

                if (cloneB && cloneB.readyState >= 1) {
                    const timeB = cloneB.currentTime.toFixed(2);
                    const durB = (cloneB.duration || 0).toFixed(1);
                    const labelB = `CLIP B: ${timeB}s / ${durB}s`;
                    const twB = ctx.measureText(labelB).width + 12;

                    ctx.fillStyle = "rgba(0,0,0,0.7)";
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(this.rect.x + this.rect.w - twB - 8, this.rect.y + this.rect.h - 26, twB, 18, 4);
                    ctx.fill();

                    ctx.fillStyle = "#8b5cf6";
                    ctx.fillText(labelB, this.rect.x + this.rect.w - 14, this.rect.y + this.rect.h - 17);
                }
            }
        }

        if (isHovered || !isPlaying) {
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);

            const cx = this.rect.x + this.rect.w / 2;
            const cy = this.rect.y + this.rect.h / 2;
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            if (isPlaying) {
                ctx.rect(cx - 8, cy - 14, 6, 28);
                ctx.rect(cx + 2, cy - 14, 6, 28);
            } else {
                ctx.moveTo(cx - 10, cy - 14);
                ctx.lineTo(cx + 14, cy);
                ctx.lineTo(cx - 10, cy + 14);
            }
            ctx.fill();
        }

        ctx.strokeStyle = isHovered ? THEME.primary : "#3f3f46";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);


        ctx.restore();


        const nextY = this.rect.y + this.rect.h + this.margin;
        return nextY;
    }

    onMouseDown(pos, e) {
        if (this._isInRect(pos)) {
            const current = this.ui.state.get('isPlaying');
            this.ui.state.set('isPlaying', !current);
            return true;
        }
        return false;
    }

    onMouseMove(pos) { return this._isInRect(pos); }
    _isInRect(pos) {
        return pos.x >= this.rect.x && pos.x <= this.rect.x + this.rect.w &&
            pos.y >= this.rect.y && pos.y <= this.rect.y + this.rect.h;
    }
}
