import { THEME, LAYOUT } from '../Theme.js';

export class SliderControl {
    constructor(nodeUI, label, stateKey, min, max, step = 0.01) {
        this.ui = nodeUI;
        this.label = label;
        this.stateKey = stateKey;
        this.min = min;
        this.max = max;
        this.step = step;

        this.rect = { x: 0, y: 0, w: 0, h: 0 };
        this.margin = LAYOUT.ROW_GAP || 12;
        this.height = LAYOUT.ROW_HEIGHT || 40;
        this.isDragging = false;
        this.isHovered = false;

        if (stateKey === 'intensity') this.accentColor = THEME.warning;
        else if (stateKey === 'fps') this.accentColor = THEME.success;
        else if (stateKey === 'clipAStart') this.accentColor = '#f97316';
        else if (stateKey === 'clipBStart') this.accentColor = '#8b5cf6';
        else this.accentColor = THEME.primary;
    }

    draw(ctx, y, width, mousePos) {
        this.rect.x = LAYOUT.PADDING_X;
        this.rect.y = y;
        this.rect.w = width - (LAYOUT.PADDING_X * 2);
        this.rect.h = LAYOUT.ROW_HEIGHT;

        this.isHovered = mousePos && this._isInRect(mousePos);

        let value = this.ui.state.get(this.stateKey);
        if (typeof value !== 'number') value = parseFloat(value);
        if (isNaN(value)) value = this.min;

        const norm = (value - this.min) / (this.max - this.min);

        const r = this.rect;

        ctx.save();

        ctx.fillStyle = THEME.bgInput;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, LAYOUT.RADIUS_SM);
        else ctx.rect(r.x, r.y, r.w, r.h);
        ctx.fill();

        if (this.isHovered || this.isDragging) {
            ctx.strokeStyle = THEME.borderHover;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.fillStyle = THEME.textSecondary;
        ctx.font = LAYOUT.LABEL_FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.label.toUpperCase(), r.x + 12, r.y + r.h / 2);

        ctx.fillStyle = this.isDragging ? THEME.textPrimary : THEME.textSecondary;
        ctx.font = LAYOUT.VALUE_FONT;
        ctx.textAlign = "right";

        let valStr = value.toFixed(2);
        if (this.step >= 1) valStr = Math.round(value).toString();
        ctx.fillText(valStr, r.x + r.w - 12, r.y + r.h / 2);

        const trackH = 2;
        const trackY = r.y + r.h - trackH;

        if (norm > 0) {
            const clampedNorm = Math.max(0, Math.min(1, norm));
            const fillW = Math.max(8, r.w * clampedNorm);
            ctx.fillStyle = this.accentColor;

            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(r.x, trackY, fillW, trackH, [0, 0, 0, LAYOUT.RADIUS_SM]);
            else ctx.rect(r.x, trackY, fillW, trackH);
            ctx.fill();

            if (this.isDragging) {
                ctx.shadowColor = this.accentColor;
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        ctx.restore();

        return this.rect.y + this.rect.h + this.margin;
    }

    onMouseDown(pos, e) {
        if (this._isInRect(pos)) {
            this.isDragging = true;
            this.lastMouseX = pos.x;
            this._updateValueFromMouse(pos.x, e);
            return true;
        }
        return false;
    }

    onMouseMove(pos, e) {
        if (this.isDragging) {
            if (e && e.buttons === 0) {
                this.isDragging = false;
                return false;
            }

            this._updateValueFromMouse(pos.x, e);
            this.lastMouseX = pos.x;
            return true;
        }
        return false;
    }

    onMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            return true;
        }
        return false;
    }

    _updateValueFromMouse(x, e) {
        const rect = this.rect;
        const trackW = rect.w - 4;

        // Check for Shift key (Precision Mode)
        const isPrecision = e && e.shiftKey;
        const range = this.max - this.min;

        if (isPrecision) {
            const deltaX = x - (this.lastMouseX ?? x);
            const sensitivity = 0.0001 * range;

            let val = this.ui.state.get(this.stateKey);
            val += deltaX * sensitivity;

            val = Math.max(this.min, Math.min(this.max, val));

            if (this.step) {
                val = Math.round(val / this.step) * this.step;
            }

            this.ui.state.set(this.stateKey, parseFloat(val.toFixed(2)));

        } else {
            const trackX = rect.x + 2;
            let norm = (x - trackX) / trackW;
            norm = Math.max(0, Math.min(1, norm));

            let val = this.min + norm * (this.max - this.min);

            if (this.step) {
                val = Math.round(val / this.step) * this.step;
            }
            val = parseFloat(val.toFixed(2));
            this.ui.state.set(this.stateKey, val);
        }
    }

    _isInRect(pos) {
        return pos.x >= this.rect.x &&
            pos.x <= this.rect.x + this.rect.w &&
            pos.y >= this.rect.y &&
            pos.y <= this.rect.y + this.rect.h;
    }
}
