import { THEME, LAYOUT } from '../Theme.js';

export class FlavorGroup {
    constructor(nodeUI) {
        this.ui = nodeUI;
        this.flavors = ['clean', 'dreamy', 'gritty', 'punchy'];
        this.rect = { x: 0, y: 0, w: 0, h: 20 };
        this.margin = 6;
        this.hitboxes = [];
    }

    draw(ctx, y, width, mousePos) {
        this.rect.x = LAYOUT.PADDING_X;
        this.rect.y = y;
        this.rect.w = width - (LAYOUT.PADDING_X * 2);
        this.rect.h = 16;

        const currentFlavor = this.ui.state.get('flavor') || 'clean';
        const btnW = this.rect.w / this.flavors.length;

        this.hitboxes = [];

        ctx.save();
        ctx.font = "bold 8px 'Roboto Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        this.flavors.forEach((f, i) => {
            const bx = this.rect.x + (i + 0.5) * btnW;
            const by = this.rect.y + this.rect.h / 2;

            const r = { x: this.rect.x + i * btnW, y: this.rect.y, w: btnW, h: this.rect.h };
            this.hitboxes.push({ f, r });

            const isHovered = mousePos && this._isInRect(mousePos, r);
            const isActive = currentFlavor === f;

            ctx.fillStyle = isActive ? THEME.primary : (isHovered ? THEME.textPrimary : THEME.textMuted);
            ctx.fillText(f.toUpperCase(), bx, by);

            if (i < this.flavors.length - 1) {
                ctx.fillStyle = THEME.border;
                ctx.fillText("|", this.rect.x + (i + 1) * btnW, by);
            }

            if (isActive) {
                const tw = ctx.measureText(f.toUpperCase()).width;
                ctx.strokeStyle = THEME.primary;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(bx - tw / 2, by + 6);
                ctx.lineTo(bx + tw / 2, by + 6);
                ctx.stroke();
            }
        });

        ctx.restore();

        return this.rect.y + this.rect.h + this.margin;
    }

    onMouseDown(pos) {
        for (const hit of this.hitboxes) {
            if (this._isInRect(pos, hit.r)) {
                const flavor = hit.f;
                this.ui.state.set('flavor', flavor);

                this._applyPreset(flavor);

                this.ui.state.set('showCurveEditor', true);

                if (this.ui.node.setDirtyCanvas) {
                    this.ui.node.setDirtyCanvas(true, true);
                }

                return true;
            }
        }
        return false;
    }

    _applyPreset(flavor) {
        switch (flavor) {
            case 'clean':
                this.ui.state.set('intensity', 1.0);
                this.ui.state.set('curveP0', { x: 0, y: 0 });
                this.ui.state.set('curveC0', { x: 0.4, y: 0 });
                this.ui.state.set('curveC1', { x: 0.6, y: 1 });
                this.ui.state.set('curveP1', { x: 1, y: 1 });
                break;
            case 'dreamy':
                this.ui.state.set('intensity', 1.6);
                this.ui.state.set('curveP0', { x: 0, y: 0 });
                this.ui.state.set('curveC0', { x: 0.5, y: 0 });
                this.ui.state.set('curveC1', { x: 0.5, y: 1 });
                this.ui.state.set('curveP1', { x: 1, y: 1 });
                break;
            case 'gritty':
                this.ui.state.set('intensity', 1.8);
                this.ui.state.set('curveP0', { x: 0, y: 0 });
                this.ui.state.set('curveC0', { x: 0.1, y: 0 });
                this.ui.state.set('curveC1', { x: 0.9, y: 1 });
                this.ui.state.set('curveP1', { x: 1, y: 1 });
                break;
            case 'punchy':
                this.ui.state.set('intensity', 2.0);
                this.ui.state.set('curveP0', { x: 0, y: 0 });
                this.ui.state.set('curveC0', { x: 0.8, y: 0 });
                this.ui.state.set('curveC1', { x: 0.2, y: 1 });
                this.ui.state.set('curveP1', { x: 1, y: 1 });
                break;
        }

        const curveEditor = this.ui.components.find(c => c.points && c.points.p0);
        if (curveEditor) {
            curveEditor.points.p0 = this.ui.state.get('curveP0');
            curveEditor.points.c0 = this.ui.state.get('curveC0');
            curveEditor.points.c1 = this.ui.state.get('curveC1');
            curveEditor.points.p1 = this.ui.state.get('curveP1');
        }
    }

    _isInRect(pos, rect) {
        const target = rect || this.rect;
        if (!target) return false;
        return pos.x >= target.x &&
            pos.x <= target.x + target.w &&
            pos.y >= target.y &&
            pos.y <= target.y + target.h;
    }
}
