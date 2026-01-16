import { THEME, LAYOUT } from '../Theme.js';

export class TimelineBar {
    constructor(nodeUI) {
        this.ui = nodeUI;
        this.rect = { x: 0, y: 0, w: 0, h: 0 };
        this.margin = LAYOUT.SECTION_GAP;
        this.height = 24;
        this.isDragging = false;
    }

    draw(ctx, y, width, mousePos) {
        this.rect.x = LAYOUT.PADDING_X;
        this.rect.y = y;
        this.rect.w = width - (LAYOUT.PADDING_X * 2);
        this.rect.h = this.height;

        const isHovered = mousePos && this._isInRect(mousePos);
        const t = this.ui.state.get('timelinePos') || 0;
        const norm = t / 100;
        const isCurveExpanded = this.ui.state.get('showCurveEditor') !== false;

        ctx.save();

        ctx.fillStyle = THEME.bgCard;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, [2, 2, 0, 0]);
        else ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

        ctx.strokeStyle = THEME.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = THEME.bgInput;
        ctx.fillRect(this.rect.x + 4, this.rect.y + 4, this.rect.w - 90, this.rect.h - 8);

        if (norm > 0) {
            ctx.fillStyle = THEME.primary;
            ctx.globalAlpha = 0.3;
            ctx.fillRect(this.rect.x + 4, this.rect.y + 4, (this.rect.w - 90) * norm, this.rect.h - 8);
            ctx.globalAlpha = 1.0;
        }

        const trackW = this.rect.w - 90;
        const tx = this.rect.x + 4 + trackW * norm;
        ctx.strokeStyle = THEME.primary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, this.rect.y + 2);
        ctx.lineTo(tx, this.rect.y + this.rect.h - 2);
        ctx.stroke();

        ctx.font = "bold 8px 'Roboto Mono', monospace";
        ctx.textBaseline = "middle";

        ctx.textAlign = "left";
        ctx.fillStyle = THEME.textMuted;
        ctx.fillText("TIME", this.rect.x + 10, this.rect.y + this.rect.h / 2);

        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${Math.round(t)}%`, this.rect.x + trackW / 2, this.rect.y + this.rect.h / 2);

        const btnW = 60;
        const btnX = this.rect.x + this.rect.w - btnW - 4;
        const btnR = { x: btnX, y: this.rect.y + 4, w: btnW, h: this.rect.h - 8 };
        this.curveBtnRect = btnR;

        const isBtnHovered = mousePos && this._isInRect(mousePos, btnR);
        ctx.fillStyle = isCurveExpanded ? THEME.primary : (isBtnHovered ? "#27272a" : "#09090b");
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(btnR.x, btnR.y, btnR.w, btnR.h, 2);
        else ctx.fillRect(btnR.x, btnR.y, btnR.w, btnR.h);
        ctx.fill();

        ctx.strokeStyle = isCurveExpanded ? THEME.primary : "#3f3f46";
        ctx.stroke();

        ctx.fillStyle = isCurveExpanded ? "#000" : (isBtnHovered ? "#fff" : "#a1a1aa");
        ctx.textAlign = "center";
        ctx.fillText(isCurveExpanded ? "CLOSE CURVE" : "EASING CURVE", btnR.x + btnR.w / 2, btnR.y + btnR.h / 2);

        ctx.restore();

        return this.rect.y + this.rect.h;
    }

    onMouseDown(pos) {
        const nodeW = (this.ui.node && this.ui.node.size) ? this.ui.node.size[0] : 300;
        const padding = LAYOUT.PADDING_X;

        const currentRect = {
            x: padding,
            y: this.rect.y,
            w: nodeW - (padding * 2),
            h: this.height
        };

        const btnW = 60;
        const btnX = currentRect.x + currentRect.w - btnW - 4;
        const btnRect = { x: btnX, y: currentRect.y + 4, w: btnW, h: currentRect.h - 8 };

        const trackX = currentRect.x + 4;
        const trackW = currentRect.w - 90;
        const trackRect = { x: trackX, y: currentRect.y, w: trackW, h: currentRect.h };

        if (this._isInRect(pos, btnRect)) {
            const current = this.ui.state.get('showCurveEditor') !== false;
            this.ui.state.set('showCurveEditor', !current);
            return true;
        }

        if (this._isInRect(pos, trackRect)) {
            this.isDragging = true;

            this._updateTimeUsingTrack(pos.x, trackRect);

            this.wasPlaying = this.ui.state.get('isPlaying');
            this.ui.state.set('isPlaying', false);
            return true;
        }

        return false;
    }

    _updateTimeUsingTrack(x, trackRect) {
        let norm = (x - trackRect.x) / trackRect.w;
        norm = Math.max(0, Math.min(1, norm));
        this.ui.state.set('timelinePos', norm * 100);
    }

    onMouseMove(pos) {
        if (this.isDragging) {
            this._updateTimeFromMouse(pos.x);
            return true;
        }
        return false;
    }

    onMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            if (this.wasPlaying) {
                this.ui.state.set('isPlaying', true);
            }
            return true;
        }
        return false;
    }

    _updateTimeFromMouse(x) {
        const trackX = this.rect.x + 4;
        const trackW = this.rect.w - 90;

        let norm = (x - trackX) / trackW;
        norm = Math.max(0, Math.min(1, norm));
        this.ui.state.set('timelinePos', norm * 100);
    }

    _isInRect(pos, rect) {
        const r = rect || this.rect;
        return pos.x >= r.x &&
            pos.x <= r.x + r.w &&
            pos.y >= r.y &&
            pos.y <= r.y + r.h;
    }
}
