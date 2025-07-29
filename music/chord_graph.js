class XLengthType {
    static Integer = new XLengthType(126.185950714291, null)
    static OctaveReduced = new XLengthType(341.902258270291, Monzo.getOctaveFactor)
    static Shasavic = new XLengthType(341.902258270291, Monzo.getShasavicOctaveFactor)

    constructor(scale, getOctaveFactor) {
        this.scale = scale || 128
        this.getOctaveFactor = getOctaveFactor || (() => 0)
    }

    toStructual(monzo) {
        let power2 = this.getOctaveFactor(monzo)
        return power2 === 0 ? monzo : Monzo.multiply(monzo, new Monzo({ "2": power2 }))
    }

    fromStructual(monzo) {
        let power2 = this.getOctaveFactor(monzo)
        return power2 === 0 ? monzo : Monzo.divide(monzo, new Monzo({ "2": power2 }))
    }
}

var textArea;
var previewSvg;
var grid;
var lineGroup;
var pitchClassGroup;
var aDownloadSvg;
var aDownloadPng;
var checkboxAutoSize;
var checkboxIgnoreOctave;
var radioXInteger;
var radioXOctaveReduced;
var radioXShasavic;

const centerX = 960
const centerY = 960

const colorScheme = [
    { amount: 0.000, h: 360 + 180, s: 220, l: 124 },
    { amount: 0.250, h: 360 + 177, s: 152, l: 92 },
    { amount: 0.375, h: 360 + 40, s: 219, l: 122 },
    { amount: 0.500, h: 345, s: 220, l: 160 },
    { amount: 0.625, h: 261, s: 210, l: 170 },
    { amount: 0.750, h: 204, s: 203, l: 145 },
    { amount: 1.000, h: 180, s: 220, l: 124 },
]

// テキストからピッチの配列を取得する
function parsePitches(text, ignoreOctave, xLengthType) {
    // スペース区切りで分割
    const tokens = text.trim().split(/\s+/)
    const monzos = []
    for (let token of tokens) {
        let mute = false
        if (token.startsWith('x')) {
            mute = true
            token = token.substring(1)
        }

        let monzo = null
        if (token.includes('/')) {
            // 分数の場合
            const [num, denom] = token.split('/').map(Number)
            monzo = Monzo.fromFraction(num, denom)
        } else {
            // 整数の場合
            monzo = Monzo.fromInt(Number(token))
        }
        let originalMonzo = monzo
        monzo = xLengthType.toStructual(monzo)
        if (ignoreOctave) {
            delete monzo.factors["2"]
            originalMonzo = xLengthType.fromStructual(originalMonzo)
        }

        const sameEntry = monzos.find(m => Monzo.divide(monzo, m.monzo).pitchDistance === 0)
        if (sameEntry) {
            sameEntry.mute = mute && sameEntry.mute
        } else {
            console.log(monzo.factors)
            monzos.push({ mute, monzo, originalMonzo })
        }
    }

    return monzos
}

function getPrimePitchClass(prime) {
    const denominator = Math.pow(2, Math.floor(Math.log2(prime)))
    return prime / denominator
}

function getIntervalDelta(prime, power, xLengthType) {
    const pitchClass = getPrimePitchClass(prime)
    const dx = Math.log2(prime) * power - xLengthType.getOctaveFactor(new Monzo({ [prime]: power }))
    const dy = prime === 2 ? 0 : dx * Math.tan(Math.PI * (pitchClass - 0.5))
    return {
        dx: Math.round(dx * xLengthType.scale),
        dy: Math.round(dy * xLengthType.scale),
    }
}

function getPitchPoint(monzo, xLengthType) {
    let x = 0
    let y = 0
    for (const prime in monzo.factors) {
        const power = monzo.factors[prime]
        const { dx, dy } = getIntervalDelta(Number(prime), power, xLengthType)
        x += dx
        y += dy
    }

    return { x, y }
}

function clearChildren(...elements) {
    for (const element of elements) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
}

function toRgbColor(h, s, l) {
    h = h % 360
    s = Math.max(0, Math.min(255, s))
    l = Math.max(0, Math.min(255, l))
    const c = (1 - Math.abs(2 * l / 255 - 1)) * s / 255
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l / 255 - c / 2
    let r, g, b
    if (h < 60) {
        r = c; g = x; b = 0
    } else if (h < 120) {
        r = x; g = c; b = 0
    } else if (h < 180) {
        r = 0; g = c; b = x
    } else if (h < 240) {
        r = 0; g = x; b = c
    } else if (h < 300) {
        r = x; g = 0; b = c
    } else {
        r = c; g = 0; b = x
    }
    r = Math.max(0, Math.min(255, Math.round((r + m) * 255)))
    g = Math.max(0, Math.min(255, Math.round((g + m) * 255)))
    b = Math.max(0, Math.min(255, Math.round((b + m) * 255)))

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function getPitchClassColor(amount) {
    // amountがcolorSchemeの範囲外の場合は端の値を返す
    if (amount <= colorScheme[0].amount) {
        const { h, s, l } = colorScheme[0]
        return toRgbColor(h, s, l)
    }
    if (amount >= colorScheme[colorScheme.length - 1].amount) {
        const { h, s, l } = colorScheme[colorScheme.length - 1]
        return toRgbColor(h, s, l)
    }
    // 範囲内の場合、2点間で線形補間
    for (let i = 0; i < colorScheme.length - 1; i++) {
        const a0 = colorScheme[i].amount
        const a1 = colorScheme[i + 1].amount
        if (amount >= a0 && amount <= a1) {
            const t = (amount - a0) / (a1 - a0)
            const h = colorScheme[i].h + t * (colorScheme[i + 1].h - colorScheme[i].h)
            const s = colorScheme[i].s + t * (colorScheme[i + 1].s - colorScheme[i].s)
            const l = colorScheme[i].l + t * (colorScheme[i + 1].l - colorScheme[i].l)
            return toRgbColor(h, s, l)
        }
    }

    const { h, s, l } = colorScheme[0]
    return toRgbColor(h, s, l)
}

function createPath(d, fill, stroke, strokeWidth) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", d)
    path.setAttribute("fill", fill)
    path.setAttribute("stroke", stroke)
    path.setAttribute("stroke-width", strokeWidth)
    return path
}

function createDiamond(x, y, size, fill, stroke, strokeWidth) {
    return createPath(
        `M ${x + centerX},${y + centerY - size} l ${size},${size} l -${size},${size} l -${size},-${size} Z`,
        fill, stroke, strokeWidth)
}

function createCircle(cx, cy, r, fill, stroke, strokeWidth) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    circle.setAttribute("cx", cx + centerX)
    circle.setAttribute("cy", cy + centerY)
    circle.setAttribute("r", r)
    circle.setAttribute("fill", fill)
    circle.setAttribute("stroke", stroke)
    circle.setAttribute("stroke-width", strokeWidth)
    return circle
}

function createLine(x1, y1, x2, y2, stroke, strokeWidth) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
    line.setAttribute("x1", x1 + centerX)
    line.setAttribute("y1", y1 + centerY)
    line.setAttribute("x2", x2 + centerX)
    line.setAttribute("y2", y2 + centerY)
    line.setAttribute("stroke", stroke)
    line.setAttribute("stroke-width", strokeWidth)
    return line
}

function createOctaveArc(x1, y1, x2, y2, scale, stroke, strokeWidth) {
    if (x1 > x2) {
        let d = x1
        x1 = x2
        x2 = d
        d = y1
        y1 = y2
        y2 = d
    }

    return createPath(
        `M ${x1 + centerX},${y1 + centerY} A ${scale * 0.625} ${scale * 0.625} 0 0 0 ${x2 + centerX},${y2 + centerY}`,
        "none", stroke, strokeWidth)
}

function loadMonzo() {
    if (!(textArea instanceof HTMLTextAreaElement) ||
        !(checkboxAutoSize instanceof HTMLInputElement) ||
        !(checkboxIgnoreOctave instanceof HTMLInputElement) ||
        !(radioXInteger instanceof HTMLInputElement) ||
        !(radioXOctaveReduced instanceof HTMLInputElement) ||
        !(radioXShasavic instanceof HTMLInputElement) ||
        !(previewSvg instanceof SVGElement) ||
        !(grid instanceof SVGGElement) ||
        !(lineGroup instanceof SVGGElement) ||
        !(pitchClassGroup instanceof SVGGElement)) {
        return
    }
    
    const text = textArea.value
    const xLengthType =
        radioXOctaveReduced.checked ? XLengthType.OctaveReduced :
            radioXShasavic.checked ? XLengthType.Shasavic : XLengthType.Integer
    const pitches = parsePitches(text, checkboxIgnoreOctave.checked, xLengthType)

    clearChildren(grid, lineGroup, pitchClassGroup)
    let rootNode = true
    let minX = -50
    let minY = -50
    let maxX = 50
    let maxY = 150
    for (const { mute, monzo } of pitches) {
        const { x, y } = getPitchPoint(monzo, xLengthType)
        minX = Math.min(minX, Math.round(x - 50))
        minY = Math.min(minY, Math.round(y - 50))
        maxX = Math.max(maxX, Math.round(x + 50))
        maxY = Math.max(maxY, Math.round(y + 150))
        if (mute) {
            pitchClassGroup.appendChild(createCircle(x, y, 15, "#FFFFFF", "#FDC6FE", "6"))
        } else if (rootNode) {
            pitchClassGroup.appendChild(createDiamond(x, y, 40, "#FFFFFF", "#2B2F75", "6"))
            pitchClassGroup.appendChild(createDiamond(x, y, 30, "#2B2F75", "#FFFFFF", "2"))
            rootNode = false
        } else {
            pitchClassGroup.appendChild(createDiamond(x, y, 30, "#FFFFFF", "#2B2F75", "6"))
        }
    }

    if (checkboxAutoSize.checked) {
        previewSvg.setAttribute("viewBox", `${minX + centerX} ${minY + centerY} ${maxX - minX} ${maxY - minY}`)
    } else {
        previewSvg.setAttribute("viewBox", "0 0 1920 1920")
    }

    for (let i = 0; i < pitches.length; i++) {
        for (let j = i + 1; j < pitches.length; j++) {
            const monzo1 = pitches[i].monzo
            const monzo2 = pitches[j].monzo
            const interval = Monzo.divide(monzo1, monzo2)
            if (interval.pitchDistance !== 1) {
                continue
            }

            const { x: x1, y: y1 } = getPitchPoint(monzo1, xLengthType)
            const { x: x2, y: y2 } = getPitchPoint(monzo2, xLengthType)

            const intervalClass = Math.pow(2, Math.abs(interval.pitch) % 1) - 1
            if (interval.isOnly2) {
                lineGroup.appendChild(createOctaveArc(x1, y1, x2, y2, xLengthType.scale, "#FDC6FE", "12"))
            } else {
                const color = getPitchClassColor(intervalClass)
                lineGroup.appendChild(createLine(x1, y1, x2, y2, color, "24"))
            }
        }
    }
}

function createSvgUrl() {
    const svgText = new XMLSerializer().serializeToString(previewSvg)
    const blob = new Blob([svgText], { type: "image/svg+xml" })
    return URL.createObjectURL(blob)
}

function downloadSvg() {
    aDownloadSvg.href = createSvgUrl()
}

function downloadPng() {
    const svgImage = document.createElement("img")
    svgImage.src = createSvgUrl()
    const svgCanvas = document.createElement("canvas")
    svgCanvas.width = previewSvg.viewBox.baseVal.width
    svgCanvas.height = previewSvg.viewBox.baseVal.height
    const ctx = svgCanvas.getContext("2d")
    svgImage.onload = () => {
        ctx.drawImage(svgImage, 0, 0)
        const a = document.createElement("a")
        a.href = svgCanvas.toDataURL("image/png")
        a.setAttribute("download", "chordGraph.png")
        a.dispatchEvent(new MouseEvent("click"))
    }
}

window.addEventListener("load", () => {
    textArea = document.getElementById("textarea_editor")
    checkboxAutoSize = document.getElementById("checkbox_auto_size")
    checkboxIgnoreOctave = document.getElementById("checkbox_ignore_octave")
    radioXInteger = document.getElementById("radio_x_integer")
    radioXOctaveReduced = document.getElementById("radio_x_octave_reduced")
    radioXShasavic = document.getElementById("radio_x_shasavic")
    previewSvg = document.getElementById("preview_figure")
    grid = document.getElementById("grid")
    lineGroup = document.getElementById("line_group")
    pitchClassGroup = document.getElementById("pitch_class_group")
    aDownloadSvg = document.getElementById("a_download_svg")
    aDownloadPng = document.getElementById("a_download_png")

    loadMonzo()
})
