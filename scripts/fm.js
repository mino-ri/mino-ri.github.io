import { AudioSource, WaveData } from "./sound.js";
const MAX_FREQUENCY = 64;
const BESSEL_ITERATIONS = 50;
const BASE_HZ = 220;
function besselJ(n, x) {
    if (x === 0) {
        return n === 0 ? 1 : 0;
    }
    const absN = Math.abs(n);
    let sum = 0;
    let factorial_k = 1;
    let factorial_nk = 1;
    for (let i = 1; i <= absN; i++) {
        factorial_nk *= i;
    }
    const halfX = x / 2;
    let powHalfX = Math.pow(halfX, absN);
    for (let k = 0; k < BESSEL_ITERATIONS; k++) {
        if (k > 0) {
            factorial_k *= k;
            factorial_nk *= (absN + k);
            powHalfX *= halfX * halfX;
        }
        const term = (k % 2 === 0 ? 1 : -1) * powHalfX / (factorial_k * factorial_nk);
        sum += term;
        if (Math.abs(term) < 1e-15) {
            break;
        }
    }
    if (n < 0 && n % 2 !== 0) {
        sum = -sum;
    }
    return sum;
}
function calculateSidebands(carrierFreq, modulatorFreq, modulatorLevel) {
    const beta = modulatorLevel * Math.PI;
    const levels = new Array(MAX_FREQUENCY).fill(0);
    const maxK = Math.ceil((MAX_FREQUENCY + carrierFreq) / modulatorFreq);
    for (let k = -maxK; k <= maxK; k++) {
        const freq = carrierFreq + k * modulatorFreq;
        const amplitude = besselJ(k, beta);
        if (freq >= 1 && freq <= MAX_FREQUENCY) {
            levels[freq - 1] += amplitude;
        }
        else if (freq <= -1 && -freq <= MAX_FREQUENCY) {
            levels[-freq - 1] -= amplitude;
        }
    }
    return levels.map(Math.abs);
}
let inputCarrier;
let inputModulator;
let inputLevel;
let labelCarrier;
let labelModulator;
let labelLevel;
let chartContainer;
let waveformContainer;
let playingAudio = null;
let currentLevels = [];
function renderChart(levels) {
    const DB_MIN = -40;
    const DB_MAX = 0;
    const svgWidth = 1200;
    const svgHeight = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;
    const barWidth = chartWidth / MAX_FREQUENCY;
    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto;">`;
    svg += `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#FFFFFF"/>`;
    svg += `<g transform="translate(${margin.left}, ${margin.top})">`;
    const yGridLines = [0, -10, -20, -30, -40];
    for (const db of yGridLines) {
        const y = ((DB_MAX - db) / (DB_MAX - DB_MIN)) * chartHeight;
        svg += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#ccc" stroke-width="1"/>`;
        svg += `<text x="-8" y="${y + 4}" text-anchor="end" font-size="12" fill="#666">${db}</text>`;
    }
    for (let i = 0; i <= MAX_FREQUENCY; i += 8) {
        const x = (i / MAX_FREQUENCY) * chartWidth;
        svg += `<text x="${x}" y="${chartHeight + 20}" text-anchor="middle" font-size="12" fill="#666">${i || 1}</text>`;
    }
    for (let i = 0; i < MAX_FREQUENCY; i++) {
        const level = levels[i];
        if (level <= 0)
            continue;
        const db = 20 * Math.log10(level);
        if (db < DB_MIN)
            continue;
        const clampedDb = Math.min(db, DB_MAX);
        const barHeight = ((clampedDb - DB_MIN) / (DB_MAX - DB_MIN)) * chartHeight;
        const barX = i * barWidth;
        const barY = chartHeight - barHeight;
        svg += `<rect x="${barX}" y="${barY}" width="${barWidth - 1}" height="${barHeight}" fill="#287950"/>`;
    }
    svg += `<line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="#333" stroke-width="2"/>`;
    svg += `</g></svg>`;
    chartContainer.innerHTML = svg;
}
function renderWaveform(carrierFreq, modulatorFreq, modulatorLevel) {
    const beta = modulatorLevel * Math.PI;
    const svgWidth = 1200;
    const svgHeight = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;
    const tMax = 4 * Math.PI;
    const numSamples = 1000;
    const waveform = [];
    for (let i = 0; i <= numSamples; i++) {
        const t = (i / numSamples) * tMax;
        const y = Math.sin(carrierFreq * t + beta * Math.sin(modulatorFreq * t));
        waveform.push(y);
    }
    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto;">`;
    svg += `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#FFFFFF"/>`;
    svg += `<g transform="translate(${margin.left}, ${margin.top})">`;
    const yGridLines = [1, 0, -1];
    for (const v of yGridLines) {
        const y = (1 - v) * chartHeight / 2;
        svg += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#ccc" stroke-width="1"/>`;
        svg += `<text x="-8" y="${y + 4}" text-anchor="end" font-size="12" fill="#666">${v}</text>`;
    }
    const xLabels = ["0", "π", "2π", "3π", "4π"];
    for (let i = 0; i <= 4; i++) {
        const x = (i / 4) * chartWidth;
        svg += `<text x="${x}" y="${chartHeight + 20}" text-anchor="middle" font-size="12" fill="#666">${xLabels[i]}</text>`;
    }
    let pathD = "";
    for (let i = 0; i <= numSamples; i++) {
        const x = (i / numSamples) * chartWidth;
        const y = (1 - waveform[i]) * chartHeight / 2;
        pathD += (i === 0 ? "M" : "L") + `${x},${y}`;
    }
    svg += `<path d="${pathD}" fill="none" stroke="#287950" stroke-width="2"/>`;
    svg += `<line x1="0" y1="${chartHeight / 2}" x2="${chartWidth}" y2="${chartHeight / 2}" stroke="#333" stroke-width="1"/>`;
    svg += `</g></svg>`;
    waveformContainer.innerHTML = svg;
}
function playSound() {
    if (!playingAudio) {
        playingAudio = document.createElement("audio");
    }
    else {
        playingAudio.pause();
        playingAudio.currentTime = 0;
    }
    const carrierFreq = parseInt(inputCarrier.value, 10);
    const modulatorFreq = parseInt(inputModulator.value, 10);
    const modulatorLevel = parseFloat(inputLevel.value);
    const beta = modulatorLevel * Math.PI;
    const seconds = 2;
    const sampleRate = 44100;
    const totalSamples = Math.floor(seconds * sampleRate);
    const data = new WaveData(totalSamples);
    const carrierHz = BASE_HZ * carrierFreq;
    const modulatorHz = BASE_HZ * modulatorFreq;
    const volume = 0.75;
    const fadeSamples = Math.floor(sampleRate * 0.05);
    for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        const y = Math.sin(2 * Math.PI * carrierHz * t + beta * Math.sin(2 * Math.PI * modulatorHz * t));
        let envelope = 1.0;
        if (i < fadeSamples) {
            envelope = i / fadeSamples;
        }
        else if (i > totalSamples - fadeSamples) {
            envelope = (totalSamples - i) / fadeSamples;
        }
        data.addFloat(i, y * volume * envelope);
    }
    playingAudio.src = AudioSource.create(data);
    playingAudio.play();
}
function updateChart() {
    const carrierFreq = parseInt(inputCarrier.value, 10);
    const modulatorFreq = parseInt(inputModulator.value, 10);
    const modulatorLevel = parseFloat(inputLevel.value);
    labelCarrier.textContent = carrierFreq.toString();
    labelModulator.textContent = modulatorFreq.toString();
    labelLevel.textContent = modulatorLevel.toFixed(2);
    currentLevels = calculateSidebands(carrierFreq, modulatorFreq, modulatorLevel);
    renderChart(currentLevels);
    renderWaveform(carrierFreq, modulatorFreq, modulatorLevel);
}
window.addEventListener("load", () => {
    inputCarrier = document.getElementById("input_carrier");
    inputModulator = document.getElementById("input_modulator");
    inputLevel = document.getElementById("input_level");
    labelCarrier = document.getElementById("label_carrier");
    labelModulator = document.getElementById("label_modulator");
    labelLevel = document.getElementById("label_level");
    chartContainer = document.getElementById("chart_container");
    waveformContainer = document.getElementById("waveform_container");
    inputCarrier.addEventListener("input", updateChart);
    inputModulator.addEventListener("input", updateChart);
    inputLevel.addEventListener("input", updateChart);
    const buttonPlay = document.getElementById("button_play");
    if (buttonPlay) {
        buttonPlay.addEventListener("click", playSound);
    }
    updateChart();
});
