import { THEME, LAYOUT } from '../Theme.js';

export class VariantSelector {
    constructor(nodeUI) {
        this.ui = nodeUI;
        this.rect = { x: 0, y: 0, w: 0, h: 0 };
        this.margin = 0;
        this.height = LAYOUT.ROW_HEIGHT || 40;
    }

    draw(ctx, y, width, mousePos, providedX) {
        this.rect.x = providedX !== undefined ? providedX : this.rect.x;
        this.rect.y = y;
        this.rect.w = width;
        this.rect.h = 24;

        const engine = this.ui.state.get('engine');
        const value = this.ui.state.get('variant');
        const variants = this.ui.app.getVariants(engine);
        const index = variants.indexOf(value);
        const color = THEME.engineColors[engine] || THEME.accent;
        const isHovered = mousePos && this._isInRect(mousePos);

        ctx.save();

        ctx.fillStyle = isHovered ? THEME.bgHover : THEME.bgCard;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 2);
        else ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

        ctx.strokeStyle = isHovered ? color : THEME.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        const trackH = 2;
        ctx.fillStyle = THEME.bgInput;
        ctx.fillRect(this.rect.x + 4, this.rect.y + this.rect.h - 4, this.rect.w - 8, trackH);

        ctx.fillStyle = color;
        const segmentW = (this.rect.w - 8) / variants.length;
        ctx.fillRect(this.rect.x + 4 + (index * segmentW), this.rect.y + this.rect.h - 4, segmentW, trackH);

        ctx.fillStyle = THEME.textMuted;
        ctx.font = "bold 7px 'Roboto Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("VAR", this.rect.x + 6, this.rect.y + this.rect.h / 2);

        ctx.fillStyle = THEME.textPrimary;
        ctx.font = "bold 9px 'Roboto Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(value ? value.toUpperCase() : "NONE", this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2);

        ctx.fillStyle = isHovered ? color : THEME.textMuted;
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.fillText("<", this.rect.x + this.rect.w - 20, this.rect.y + this.rect.h / 2);
        ctx.textAlign = "right";
        ctx.fillText(">", this.rect.x + this.rect.w - 6, this.rect.y + this.rect.h / 2);

        ctx.restore();

        return this.rect.y + this.rect.h + LAYOUT.ROW_GAP;
    }

    onMouseDown(pos, e) {
        if (this._isInRect(pos)) {
            const engine = this.ui.state.get('engine');
            const variants = this.ui.app.getVariants(engine);

            this._isDragging = true;
            this._startX = pos.x;
            this._startIdx = variants.indexOf(this.ui.state.get('variant'));

            const relX = pos.x - this.rect.x;
            if (relX > this.rect.w - 25) {
                this._step(1);
                this._isDragging = false;
            } else if (relX < 25) {
                this._step(-1);
                this._isDragging = false;
            }

            return true;
        }
        return false;
    }

    onMouseMove(pos) {
        if (this._isDragging) {
            const dx = pos.x - this._startX;
            const delta = Math.floor(dx / 12);

            const engine = this.ui.state.get('engine');
            const variants = this.ui.app.getVariants(engine);
            let nextIdx = (this._startIdx + delta) % variants.length;
            if (nextIdx < 0) nextIdx += variants.length;

            if (variants[nextIdx] !== this.ui.state.get('variant')) {
                this.ui.state.set('variant', variants[nextIdx]);
            }
            return true;
        }
        return this._isInRect(pos);
    }

    onMouseUp() {
        this._isDragging = false;
    }

    onMouseWheel(e) {
        if (this._isHovered) {
            this._step(e.deltaY > 0 ? 1 : -1);
            return true;
        }
        return false;
    }

    _step(dir) {
        const engine = this.ui.state.get('engine');
        const variants = this.ui.app.getVariants(engine);
        let idx = variants.indexOf(this.ui.state.get('variant')) + dir;
        if (idx < 0) idx = variants.length - 1;
        if (idx >= variants.length) idx = 0;
        this.ui.state.set('variant', variants[idx]);
    }

    _isInRect(pos) {
        this._isHovered = pos.x >= this.rect.x && pos.x <= this.rect.x + this.rect.w &&
            pos.y >= this.rect.y && pos.y <= this.rect.y + this.rect.h;
        return this._isHovered;
    }
}
