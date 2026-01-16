import { THEME, LAYOUT } from '../Theme.js';

const CURVE_PRESETS = {
    linear: { c0: { x: 0.25, y: 0.25 }, c1: { x: 0.75, y: 0.75 } },
    smooth: { c0: { x: 0.4, y: 0 }, c1: { x: 0.6, y: 1 } },
    easeIn: { c0: { x: 0.42, y: 0 }, c1: { x: 1, y: 1 } },
    easeOut: { c0: { x: 0, y: 0 }, c1: { x: 0.58, y: 1 } },
    elastic: { c0: { x: 0.5, y: -0.5 }, c1: { x: 0.5, y: 1.5 } }
};

export class CurveEditor {
    constructor(nodeUI) {
        this.ui = nodeUI;
        this.rect = { x: 0, y: 0, w: 0, h: 0 };
        this.expandedHeight = 140;
        this.headerHeight = 24;
        this.margin = LAYOUT.ROW_GAP || 12;

        this.points = {
            p0: { x: 0, y: 0 },
            c0: { x: 0.25, y: 0.1 },
            c1: { x: 0.75, y: 0.9 },
            p1: { x: 1, y: 1 }
        };

        this.currentPreset = null;

        this.draggingNode = null;

        const p0 = this.ui.state.get('curveP0');
        if (p0) {
            this.points.p0 = this.ui.state.get('curveP0');
            this.points.c0 = this.ui.state.get('curveC0');
            this.points.c1 = this.ui.state.get('curveC1');
            this.points.p1 = this.ui.state.get('curveP1');
        } else {
            this._updateState();
        }
    }

    draw(ctx, y, width, mousePos) {
        const expanded = this.ui.state.get('showCurveEditor') !== false;

        if (!expanded) {
            this.rect.x = LAYOUT.PADDING_X;
            this.rect.y = y;
            this.rect.w = width - (LAYOUT.PADDING_X * 2);
            this.rect.h = 0;
            return y + (LAYOUT.ROW_GAP || 10);
        }

        this.rect.x = LAYOUT.PADDING_X;
        this.rect.y = y;
        this.rect.w = width - (LAYOUT.PADDING_X * 2);
        this.rect.h = this.expandedHeight + 40;

        ctx.save();
        ctx.fillStyle = THEME.bgCard;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, [0, 0, 2, 2]);
        else ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();

        ctx.strokeStyle = THEME.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.rect.x, this.rect.y);
        ctx.lineTo(this.rect.x, this.rect.y + this.rect.h);
        ctx.lineTo(this.rect.x + this.rect.w, this.rect.y + this.rect.h);
        ctx.lineTo(this.rect.x + this.rect.w, this.rect.y);
        ctx.stroke();

        const editorY = this.rect.y + 10;
        const editorH = this.expandedHeight - 20;
        const editorW = this.rect.w - 20;
        const editorX = this.rect.x + 10;
        this.editorRect = { x: editorX, y: editorY, w: editorW, h: editorH };

        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
            const lx = editorX + (editorW * (i / 10));
            ctx.moveTo(lx, editorY); ctx.lineTo(lx, editorY + editorH);
            const ly = editorY + (editorH * (i / 10));
            ctx.moveTo(editorX, ly); ctx.lineTo(editorX + editorW, ly);
        }
        ctx.stroke();

        const transform = (pt) => ({
            x: editorX + pt.x * editorW,
            y: editorY + editorH - (pt.y * editorH)
        });

        const p0 = transform(this.points.p0);
        const c0 = transform(this.points.c0);
        const c1 = transform(this.points.c1);
        const p1 = transform(this.points.p1);

        ctx.strokeStyle = THEME.primary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(c0.x, c0.y, c1.x, c1.y, p1.x, p1.y);
        ctx.stroke();

        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = "#3f3f46";
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y); ctx.lineTo(c0.x, c0.y);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(c1.x, c1.y);
        ctx.stroke();
        ctx.setLineDash([]);

        this._drawHandle(ctx, c0, this.draggingNode === 'c0');
        this._drawHandle(ctx, c1, this.draggingNode === 'c1');

        const tPos = this.ui.state.get('timelinePos') || 0;
        const tNorm = tPos / 100;
        const px = editorX + tNorm * editorW;

        ctx.strokeStyle = THEME.primary;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(px, editorY); ctx.lineTo(px, editorY + editorH);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        const presetNames = Object.keys(CURVE_PRESETS);
        const btnY = editorY + editorH + 10;
        const btnH = 16;
        const btnW = (this.rect.w - 30) / presetNames.length;

        this.presetHitboxes = [];
        presetNames.forEach((name, i) => {
            const bx = this.rect.x + 15 + i * (btnW + 2);
            const r = { x: bx, y: btnY, w: btnW, h: btnH };
            this.presetHitboxes.push({ name, r });

            const isActive = this.currentPreset === name;
            ctx.fillStyle = isActive ? THEME.primary : "#18181b";
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, 2);
            else ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.fill();

            ctx.fillStyle = isActive ? "#000" : "#71717a";
            ctx.font = "bold 7px 'Roboto Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText(name.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 + 1);
        });

        ctx.restore();

        return this.rect.y + this.rect.h + this.margin;
    }

    setPreset(name) {
        if (CURVE_PRESETS[name]) {
            const preset = CURVE_PRESETS[name];
            this.points.c0 = { ...preset.c0 };
            this.points.c1 = { ...preset.c1 };
            this.currentPreset = name;
            this._updateState();
        }
    }

    _drawHandle(ctx, pos, active) {
        ctx.fillStyle = active ? "#fff" : THEME.accent;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (active) {
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineDash = [];
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }


    onMouseDown(pos, e) {
        const expanded = this.ui.state.get('showCurveEditor') !== false;
        if (!expanded) return false;

        if (this.presetHitboxes) {
            for (const hit of this.presetHitboxes) {
                if (this._isInRect(pos, hit.r)) {
                    this.setPreset(hit.name);
                    return true;
                }
            }
        }

        const localPos = this._inverseTransform(pos);
        const tolerance = 0.05;

        if (this._dist(localPos, this.points.c0) < tolerance) {
            this.draggingNode = 'c0';
            this.currentPreset = null;
            return true;
        }
        if (this._dist(localPos, this.points.c1) < tolerance) {
            this.draggingNode = 'c1';
            this.currentPreset = null;
            return true;
        }

        return false;
    }

    _isInRect(pos, rect) {
        const target = rect || this.rect;
        if (!target) return false;
        return pos.x >= target.x && pos.x <= target.x + target.w &&
            pos.y >= target.y && pos.y <= target.y + target.h;
    }

    onMouseMove(pos) {
        if (this.draggingNode) {
            const localPos = this._inverseTransform(pos);
            localPos.x = Math.max(0, Math.min(1, localPos.x));
            localPos.y = Math.max(-0.5, Math.min(1.5, localPos.y));

            this.points[this.draggingNode] = localPos;
            this._updateState();
            return true;
        }
        return false;
    }

    onMouseUp() {
        if (this.draggingNode) {
            this.draggingNode = null;
            return true;
        }
        return false;
    }

    _updateState() {
        this.ui.state.set('curveP0', this.points.p0);
        this.ui.state.set('curveC0', this.points.c0);
        this.ui.state.set('curveC1', this.points.c1);
        this.ui.state.set('curveP1', this.points.p1);
    }

    _inverseTransform(pt) {
        if (!this.editorRect) return { x: 0, y: 0 };
        const x = (pt.x - this.editorRect.x) / this.editorRect.w;
        const y = 1 - (pt.y - this.editorRect.y) / this.editorRect.h; // Invert Y back
        return { x, y };
    }

    _dist(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }
}
