

const cache = new Map();

export function createDemoImage(label, color, width = 320, height = 180) {
    const cacheKey = `${label}_${color}_${width}x${height}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, shiftColor(color, -30));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 32;
    for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();

    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(label, width / 2, height / 2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    cache.set(cacheKey, canvas);
    return canvas;
}

export function createDefaultDemoImages(width = 320, height = 180) {
    return {
        imageA: createDemoImage('A', '#3b82f6', width, height),
        imageB: createDemoImage('B', '#ef4444', width, height)
    };
}

export function createNoisePattern(width = 128, height = 128, scale = 1) {
    const cacheKey = `noise_${width}x${height}_${scale}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 255;
        data[i] = noise;
        data[i + 1] = noise;
        data[i + 2] = noise;
        data[i + 3] = 50;
    }

    ctx.putImageData(imageData, 0, 0);
    cache.set(cacheKey, canvas);
    return canvas;
}

function shiftColor(hex, amount) {
    hex = hex.replace('#', '');

    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);

    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));

    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function clearCache() {
    cache.clear();
}

export function getCacheSize() {
    return cache.size;
}
