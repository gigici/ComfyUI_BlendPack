// BlendPack design tokens

export const COLORS = {
    bgPanel: "rgba(0, 0, 0, 0.2)",
    bgCard: "rgba(0, 0, 0, 0.25)",
    bgGlass: "rgba(0, 0, 0, 0.4)",
    bgInput: "rgba(0, 0, 0, 0.4)",
    bgHover: "rgba(255, 255, 255, 0.05)",

    border: "rgba(255, 255, 255, 0.12)",
    borderHover: "rgba(255, 255, 255, 0.25)",
    borderActive: "rgba(255, 255, 255, 0.4)",

    textPrimary: "#fafafa",
    textSecondary: "#a1a1aa",
    textMuted: "#71717a",

    primary: "#6366f1",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    accent: "#8b5cf6",
    info: "#0ea5e9",

    overlay: "rgba(0, 0, 0, 0.6)",
    divider: "rgba(255, 255, 255, 0.08)",
    shadow: "rgba(0, 0, 0, 0.4)",
    glow: "rgba(99, 102, 241, 0.15)"
};

export const THEME = {
    ...COLORS,

    engineColors: {
        'Dissolve': '#f87171',
        'Wipe': '#60a5fa',
        'Zoom': '#34d399',
        'Blur': '#fbbf24',
        'Rotate': '#a78bfa',
        'Morph': '#22d3ee',
        'Pixelate': '#f472b6',
        'Light': '#facc15',
        'Prism': '#818cf8',
        'Refraction': '#2dd4bf',
        'GlitchClean': '#c084fc',
        'ShutterMotion': '#fb923c'
    }
};

export const LAYOUT = {
    NODE_WIDTH: 320,
    PADDING_X: 10,
    HEADER_HEIGHT: 28,
    ROW_HEIGHT: 28,
    ROW_GAP: 6,
    SECTION_GAP: 16,
    PREVIEW_HEIGHT: 180,

    LABEL_FONT: "500 9px 'Inter', 'Roboto Mono', monospace",
    VALUE_FONT: "500 10px 'Inter', 'Roboto Mono', monospace",
    HEADER_FONT: "600 11px 'Inter', 'Roboto Mono', monospace",
    SECTION_FONT: "600 9px 'Inter', 'Roboto Mono', monospace",

    RADIUS_XS: 2,
    RADIUS_SM: 4,
    RADIUS_MD: 6,
    RADIUS_LG: 8
};
