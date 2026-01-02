/**
 * FM Synthesis Sideband Level Visualizer
 * Bessel関数を用いてFMシンセシスのサイドバンドレベルを計算し、棒グラフで可視化する
 */

import { AudioSource, WaveData } from "./sound.js"

const MAX_FREQUENCY = 64
const BESSEL_ITERATIONS = 50
const BASE_HZ = 220

/**
 * 第一種Bessel関数 Jₙ(x) を計算する
 * 級数展開: Jₙ(x) = Σ ((-1)^k / (k! * (n+k)!)) * (x/2)^(n+2k)
 */
function besselJ(n: number, x: number): number {
    if (x === 0) {
        return n === 0 ? 1 : 0
    }

    const absN = Math.abs(n)
    let sum = 0
    let factorial_k = 1
    let factorial_nk = 1

    // (n+k)! の初期値を計算
    for (let i = 1; i <= absN; i++) {
        factorial_nk *= i
    }

    const halfX = x / 2
    let powHalfX = Math.pow(halfX, absN) // (x/2)^n

    for (let k = 0; k < BESSEL_ITERATIONS; k++) {
        if (k > 0) {
            factorial_k *= k
            factorial_nk *= (absN + k)
            powHalfX *= halfX * halfX // (x/2)^(n+2k)
        }

        const term = (k % 2 === 0 ? 1 : -1) * powHalfX / (factorial_k * factorial_nk)
        sum += term

        // 収束判定
        if (Math.abs(term) < 1e-15) {
            break
        }
    }

    // J₋ₙ(x) = (-1)^n * Jₙ(x)
    if (n < 0 && n % 2 !== 0) {
        sum = -sum
    }

    return sum
}

/**
 * サイドバンドレベルを計算する
 * @param carrierFreq キャリアの相対周波数 (1-16)
 * @param modulatorFreq モジュレータの相対周波数 (1-16)
 * @param modulatorLevel モジュレータレベル (0-1、内部でπ倍される)
 * @returns 各周波数(1-64)のレベル配列（絶対値、0-1範囲）
 */
function calculateSidebands(carrierFreq: number, modulatorFreq: number, modulatorLevel: number): number[] {
    const beta = modulatorLevel * Math.PI
    const levels = new Array<number>(MAX_FREQUENCY).fill(0)

    // サイドバンドを計算: 周波数 = carrierFreq + k * modulatorFreq
    // 必要な k の範囲を計算（負の周波数も含む）
    const maxK = Math.ceil((MAX_FREQUENCY + carrierFreq) / modulatorFreq)

    for (let k = -maxK; k <= maxK; k++) {
        const freq = carrierFreq + k * modulatorFreq
        const amplitude = besselJ(k, beta)

        if (freq >= 1 && freq <= MAX_FREQUENCY) {
            // 正の周波数: 加算
            levels[freq - 1]! += amplitude
        } else if (freq <= -1 && -freq <= MAX_FREQUENCY) {
            // 負の周波数 -f: 周波数 f から減算
            levels[-freq - 1]! -= amplitude
        }
    }

    // 絶対値を取る
    return levels.map(Math.abs)
}

// DOM要素
let inputCarrier: HTMLInputElement
let inputModulator: HTMLInputElement
let inputLevel: HTMLInputElement
let labelCarrier: HTMLElement
let labelModulator: HTMLElement
let labelLevel: HTMLElement
let chartContainer: HTMLElement
let waveformContainer: HTMLElement
let playingAudio: HTMLAudioElement | null = null
let currentLevels: number[] = []

/**
 * 棒グラフを描画する（dBスケール: 0dB～-40dB、下から上に伸びる）
 */
function renderChart(levels: number[]): void {
    const DB_MIN = -40 // 下端（バーなし）
    const DB_MAX = 0   // 上端（フルバー）

    // SVGを生成
    const svgWidth = 1200
    const svgHeight = 300
    const margin = { top: 20, right: 20, bottom: 40, left: 50 }
    const chartWidth = svgWidth - margin.left - margin.right
    const chartHeight = svgHeight - margin.top - margin.bottom
    const barWidth = chartWidth / MAX_FREQUENCY

    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto;">`

    // 背景
    svg += `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#FFFFFF"/>`

    // グラフエリア
    svg += `<g transform="translate(${margin.left}, ${margin.top})">`

    // Y軸グリッド線（dBスケール: 上が0dB、下が-40dB）
    const yGridLines = [0, -10, -20, -30, -40]
    for (const db of yGridLines) {
        // 0dB → y=0（上端）、-40dB → y=chartHeight（下端）
        const y = ((DB_MAX - db) / (DB_MAX - DB_MIN)) * chartHeight
        svg += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#ccc" stroke-width="1"/>`
        svg += `<text x="-8" y="${y + 4}" text-anchor="end" font-size="12" fill="#666">${db}</text>`
    }

    // X軸ラベル
    for (let i = 0; i <= MAX_FREQUENCY; i += 8) {
        const x = (i / MAX_FREQUENCY) * chartWidth
        svg += `<text x="${x}" y="${chartHeight + 20}" text-anchor="middle" font-size="12" fill="#666">${i || 1}</text>`
    }

    // バーを描画（下から上に伸びる）
    for (let i = 0; i < MAX_FREQUENCY; i++) {
        const level = levels[i]!
        if (level <= 0) continue // 0以下はスキップ

        // dB変換: 20 * log10(level)
        // 0dB以上はクリップ、-40dB以下は表示なし
        const db = 20 * Math.log10(level)
        if (db < DB_MIN) continue // -40dB以下は表示しない

        const clampedDb = Math.min(db, DB_MAX) // 0dB以上はクリップ

        // バーの高さ: -40dB=0、0dB=chartHeight
        const barHeight = ((clampedDb - DB_MIN) / (DB_MAX - DB_MIN)) * chartHeight
        const barX = i * barWidth
        const barY = chartHeight - barHeight // 下から上に伸びる

        svg += `<rect x="${barX}" y="${barY}" width="${barWidth - 1}" height="${barHeight}" fill="#287950"/>`
    }

    // ベースライン（下端）
    svg += `<line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="#333" stroke-width="2"/>`

    svg += `</g></svg>`

    chartContainer.innerHTML = svg
}

/**
 * FM合成波形を描画する
 * y(t) = sin(carrierFreq * t + beta * sin(modulatorFreq * t))
 * t = 0 ～ 4π（基本周波数2周期分）
 */
function renderWaveform(carrierFreq: number, modulatorFreq: number, modulatorLevel: number): void {
    const beta = modulatorLevel * Math.PI

    // SVGサイズ（サイドバンドグラフと同じ）
    const svgWidth = 1200
    const svgHeight = 300
    const margin = { top: 20, right: 20, bottom: 40, left: 50 }
    const chartWidth = svgWidth - margin.left - margin.right
    const chartHeight = svgHeight - margin.top - margin.bottom

    // 描画範囲: t = 0 ～ 4π
    const tMax = 4 * Math.PI
    const numSamples = 1000

    // 波形データを生成
    const waveform: number[] = []
    for (let i = 0; i <= numSamples; i++) {
        const t = (i / numSamples) * tMax
        // FM合成: y(t) = sin(carrierFreq * t + beta * sin(modulatorFreq * t))
        const y = Math.sin(carrierFreq * t + beta * Math.sin(modulatorFreq * t))
        waveform.push(y)
    }

    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto;">`

    // 背景
    svg += `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#FFFFFF"/>`

    // グラフエリア
    svg += `<g transform="translate(${margin.left}, ${margin.top})">`

    // Y軸グリッド線（-1, 0, 1）
    const yGridLines = [1, 0, -1]
    for (const v of yGridLines) {
        const y = (1 - v) * chartHeight / 2
        svg += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#ccc" stroke-width="1"/>`
        svg += `<text x="-8" y="${y + 4}" text-anchor="end" font-size="12" fill="#666">${v}</text>`
    }

    // X軸ラベル（0, π, 2π, 3π, 4π）
    const xLabels = ["0", "π", "2π", "3π", "4π"]
    for (let i = 0; i <= 4; i++) {
        const x = (i / 4) * chartWidth
        svg += `<text x="${x}" y="${chartHeight + 20}" text-anchor="middle" font-size="12" fill="#666">${xLabels[i]}</text>`
    }

    // 波形を描画
    let pathD = ""
    for (let i = 0; i <= numSamples; i++) {
        const x = (i / numSamples) * chartWidth
        const y = (1 - waveform[i]!) * chartHeight / 2
        pathD += (i === 0 ? "M" : "L") + `${x},${y}`
    }
    svg += `<path d="${pathD}" fill="none" stroke="#287950" stroke-width="2"/>`

    // ゼロライン
    svg += `<line x1="0" y1="${chartHeight / 2}" x2="${chartWidth}" y2="${chartHeight / 2}" stroke="#333" stroke-width="1"/>`

    svg += `</g></svg>`

    waveformContainer.innerHTML = svg
}

/**
 * FM合成音声を再生する（真のFM合成）
 */
function playSound(): void {
    if (!playingAudio) {
        playingAudio = document.createElement("audio")
    } else {
        playingAudio.pause()
        playingAudio.currentTime = 0
    }

    const carrierFreq = parseInt(inputCarrier.value, 10)
    const modulatorFreq = parseInt(inputModulator.value, 10)
    const modulatorLevel = parseFloat(inputLevel.value)
    const beta = modulatorLevel * Math.PI

    // 音声パラメータ（chord_graph.tsと同じ長さ）
    const seconds = 2
    const sampleRate = 44100
    const totalSamples = Math.floor(seconds * sampleRate)
    const data = new WaveData(totalSamples)

    // キャリア周波数のHz
    const carrierHz = BASE_HZ * carrierFreq
    const modulatorHz = BASE_HZ * modulatorFreq

    // 真のFM合成: y(t) = sin(2π * carrierHz * t + beta * sin(2π * modulatorHz * t))
    const volume = 0.75
    const fadeSamples = Math.floor(sampleRate * 0.05) // 50msのフェード

    for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate

        // FM合成
        const y = Math.sin(2 * Math.PI * carrierHz * t + beta * Math.sin(2 * Math.PI * modulatorHz * t))

        // フェードイン/アウト
        let envelope = 1.0
        if (i < fadeSamples) {
            envelope = i / fadeSamples
        } else if (i > totalSamples - fadeSamples) {
            envelope = (totalSamples - i) / fadeSamples
        }

        data.addFloat(i, y * volume * envelope)
    }

    playingAudio.src = AudioSource.create(data)
    playingAudio.play()
}

/**
 * 入力値を更新し、グラフを再描画する
 */
function updateChart(): void {
    const carrierFreq = parseInt(inputCarrier.value, 10)
    const modulatorFreq = parseInt(inputModulator.value, 10)
    const modulatorLevel = parseFloat(inputLevel.value)

    labelCarrier.textContent = carrierFreq.toString()
    labelModulator.textContent = modulatorFreq.toString()
    labelLevel.textContent = modulatorLevel.toFixed(2)

    currentLevels = calculateSidebands(carrierFreq, modulatorFreq, modulatorLevel)
    renderChart(currentLevels)
    renderWaveform(carrierFreq, modulatorFreq, modulatorLevel)
}

window.addEventListener("load", () => {
    inputCarrier = document.getElementById("input_carrier") as HTMLInputElement
    inputModulator = document.getElementById("input_modulator") as HTMLInputElement
    inputLevel = document.getElementById("input_level") as HTMLInputElement
    labelCarrier = document.getElementById("label_carrier") as HTMLElement
    labelModulator = document.getElementById("label_modulator") as HTMLElement
    labelLevel = document.getElementById("label_level") as HTMLElement
    chartContainer = document.getElementById("chart_container") as HTMLElement
    waveformContainer = document.getElementById("waveform_container") as HTMLElement

    inputCarrier.addEventListener("input", updateChart)
    inputModulator.addEventListener("input", updateChart)
    inputLevel.addEventListener("input", updateChart)

    // 再生ボタン
    const buttonPlay = document.getElementById("button_play")
    if (buttonPlay) {
        buttonPlay.addEventListener("click", playSound)
    }

    updateChart()
})
