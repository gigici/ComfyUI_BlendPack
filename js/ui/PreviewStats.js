import { THEME, LAYOUT } from './Theme.js';

export function drawStats(ctx, size, stats) {
    if (!stats) return;

    const w = size[0];
    const h = size[1];
    const pad = 12;

    const panelH = 140;
    const y = h - panelH - pad;

    ctx.save();

    ctx.fillStyle = THEME.bgGlass;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pad, y, w - pad * 2, panelH, 6);
    else ctx.fillRect(pad, y, w - pad * 2, panelH);
    ctx.fill();

    ctx.strokeStyle = THEME.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = (stats.status === "error" || stats.gpu_error) ? THEME.danger : THEME.primary;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pad, y, w - pad * 2, 3, [6, 6, 0, 0]);
    else ctx.fillRect(pad, y, w - pad * 2, 3);
    ctx.fill();

    ctx.fillStyle = THEME.textPrimary;
    ctx.font = LAYOUT.HEADER_FONT;
    ctx.textAlign = "left";
    ctx.fillText("RENDER MANIFEST", pad + 15, y + 20);

    const data = [
        ["Engine", stats.engine],
        ["Variant", stats.variant],
        ["Timing", `${stats.duration}s @ ${stats.fps}fps`],
        ["Backend", (stats.render_backend?.includes("ModernGL") ? "MODERNGL" : "WEBGL")],
        ["Resolution", stats.output_res],
        ["Frames", stats.frame_count],
        ["A Side", stats.source_a || "None"],
        ["B Side", stats.source_b || "None"]
    ];

    ctx.font = LAYOUT.LABEL_FONT;
    let ly = y + 42;

    data.forEach(([label, value]) => {
        ctx.fillStyle = THEME.textMuted;
        ctx.textAlign = "right";
        ctx.fillText(label.toUpperCase() + ":", pad + 85, ly);

        ctx.fillStyle = THEME.textPrimary;
        ctx.textAlign = "left";
        let displayValue = String(value || "?");
        if (displayValue.length > 25) displayValue = "..." + displayValue.slice(-22);

        ctx.fillText(displayValue, pad + 95, ly);

        ly += 12;
    });

    ctx.beginPath();
    ctx.arc(w - pad - 12, y + 18, 3, 0, Math.PI * 2);
    ctx.fillStyle = (stats.status === "error" || stats.gpu_error) ? THEME.danger : THEME.success;
    ctx.fill();

    ctx.restore();
}

