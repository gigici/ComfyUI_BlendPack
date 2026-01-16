import { THEME, LAYOUT } from '../Theme.js';

export class RealPreviewButton {
    constructor(nodeUI) {
        this.ui = nodeUI;
        this.rect = { x: 0, y: 0, w: 0, h: 22 };
        this.margin = LAYOUT.ROW_GAP || 6;
    }

    draw(ctx, y, width, mousePos) {
        this.rect.x = LAYOUT.PADDING_X;
        this.rect.w = width - (LAYOUT.PADDING_X * 2);
        this.rect.y = y;
        this.rect.h = 24;

        ctx.save();

        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha = 1.0;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const isHovered = mousePos && this._isInRect(mousePos);
        const isReal = this.ui.state.get('isRealPreview');
        const cacheStatus = this.ui.getCacheStatus ? this.ui.getCacheStatus() : {};

        let bgColor = THEME.bgCard;
        let borderColor = THEME.border;
        let textColor = THEME.textMuted;
        let label = "REAL PREVIEW: OFF";

        if (isReal) {
            if (cacheStatus.isBuilding) {
                label = `CACHING SEQ... ${Math.round(cacheStatus.progress * 100)}%`;
                bgColor = "rgba(245, 158, 11, 0.15)";
                borderColor = "#d97706";
                textColor = "#fbbf24";
            } else if (cacheStatus.isReady) {
                label = "⚡ REAL PREVIEW ACTIVE";
                bgColor = "rgba(16, 185, 129, 0.15)";
                borderColor = "#059669";
                textColor = "#34d399";
            } else {
                label = "WAITING FOR INPUT...";
                bgColor = "rgba(99, 102, 241, 0.15)";
                borderColor = "#4f46e5";
                textColor = "#818cf8";
            }
        } else {
            if (isHovered) {
                bgColor = THEME.bgHover;
                borderColor = THEME.borderHover;
                textColor = THEME.textPrimary;
            }
        }

        ctx.fillStyle = THEME.bgPanel;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 4);
        else ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

        ctx.fillStyle = bgColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 4);
        else ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

        if (isReal && cacheStatus.isBuilding) {
            ctx.save();
            ctx.clip();
            ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
            const progW = this.rect.w * cacheStatus.progress;
            ctx.fillRect(this.rect.x, this.rect.y, progW, this.rect.h);
            ctx.restore();
        }

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = "bold 10px 'Roboto Mono', monospace";

        const textX = Math.floor(this.rect.x + this.rect.w / 2);
        const textY = Math.floor(this.rect.y + this.rect.h / 2 + 1);
        ctx.fillText(label, textX, textY);

        ctx.restore();

        return this.rect.y + this.rect.h + this.margin;
    }

    onMouseDown(pos) {
        if (this._isInRect(pos)) {
            const current = this.ui.state.get('isRealPreview');
            const newState = !current;
            this.ui.state.set('isRealPreview', newState);

            if (newState) {
                setTimeout(() => {
                    this.ui.buildFrameCache().catch(e => console.error(e));
                }, 100);
            }
            return true;
        }
        return false;
    }

    _isInRect(pos) {
        return pos.x >= this.rect.x &&
            pos.x <= this.rect.x + this.rect.w &&
            pos.y >= this.rect.y &&
            pos.y <= this.rect.y + this.rect.h;
    }

}
