import { THEME, LAYOUT } from '../Theme.js';

export class SectionHeader {
    constructor(nodeUI, title) {
        this.ui = nodeUI;
        this.title = title || "SECTION";
        this.rect = { x: 0, y: 0, w: 0, h: 14 };
        this.margin = LAYOUT.ROW_GAP || 6;
    }

    draw(ctx, y, width) {
        this.rect.x = LAYOUT.PADDING_X;
        this.rect.y = y;
        this.rect.w = width - (LAYOUT.PADDING_X * 2);

        ctx.save();

        ctx.fillStyle = THEME.textMuted;
        ctx.font = LAYOUT.SECTION_FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.title.toUpperCase(), this.rect.x, this.rect.y + 7);

        const tw = ctx.measureText(this.title.toUpperCase()).width;

        ctx.beginPath();
        ctx.strokeStyle = THEME.divider;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.moveTo(this.rect.x + tw + 8, this.rect.y + 7);
        ctx.lineTo(this.rect.x + this.rect.w, this.rect.y + 7);
        ctx.stroke();

        ctx.restore();

        return this.rect.y + this.rect.h + this.margin;
    }
}
