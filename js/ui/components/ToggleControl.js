import { THEME, LAYOUT } from '../Theme.js';

export class ToggleControl {
    constructor(nodeUI, label, stateKey) {
        this.ui = nodeUI;
        this.label = label;
        this.stateKey = stateKey;
        this.rect = { x: 0, y: 0, w: 0, h: 24 };
        this.margin = LAYOUT.ROW_GAP;
    }

    draw(ctx, y, width, mousePos) {
        this.rect.x = LAYOUT.PADDING_X;
        this.rect.y = y;
        this.rect.w = width - (LAYOUT.PADDING_X * 2);

        const isHovered = mousePos && this._isInRect(mousePos);
        const value = this.ui.state.get(this.stateKey);

        ctx.save();

        ctx.fillStyle = THEME.textMuted;
        ctx.font = LAYOUT.LABEL_FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.label.toUpperCase(), this.rect.x, this.rect.y + this.rect.h / 2);

        const tw = 36, th = 18;
        const tx = this.rect.x + this.rect.w - tw - 4;
        const ty = this.rect.y + (this.rect.h - th) / 2;

        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(tx, ty, tw, th, th / 2);
        else ctx.rect(tx, ty, tw, th);

        ctx.fillStyle = value ? THEME.success : THEME.bgInput;
        ctx.fill();

        if (!value) {
            ctx.strokeStyle = THEME.border;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        const knX = value ? tx + tw - th / 2 - 2 : tx + th / 2 + 2;
        ctx.beginPath();
        ctx.arc(knX, ty + th / 2, th / 2 - 3, 0, Math.PI * 2);
        ctx.fillStyle = THEME.textPrimary;
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;
        ctx.fill();

        ctx.restore();

        return this.rect.y + this.rect.h + this.margin;
    }

    onMouseDown(pos) {
        if (this._isInRect(pos)) {
            const current = this.ui.state.get(this.stateKey);
            this.ui.state.set(this.stateKey, !current);
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
