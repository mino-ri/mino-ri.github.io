var textArea;
var previewSvg;
var grid;
var lineGroup;
var pitchClassGroup;
var aDownloadSvg;
var aDownloadPng;

const centerX = 960
const centerY = 960
const globalScale = 128


// テキストからMonzoの配列を取得する
function parsePitches(text) {
    // スペース区切りで分割
    const tokens = text.trim().split(/\s+/)
    const monzos = tokens.map(token => {
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
        return { mute, monzo }
    })
    return monzos
}

function getIntervalDelta(prime, power) {
    const denominator = Math.pow(2, Math.floor(Math.log2(prime)))
    const pitchClass = prime / denominator
    const dx = Math.log2(prime) * power
    const dy = dx * Math.tan(Math.PI * (pitchClass - 0.5))
    return { dx, dy }
}

function getPitchPoint(monzo, scale) {
    let x = 0
    let y = 0
    for (const prime in monzo.factors) {
        if (prime === "2") {
            continue
        }

        const power = monzo.factors[prime]
        const { dx, dy } = getIntervalDelta(Number(prime), power)
        x += dx
        y += dy
    }

    return { x: x * scale, y: y * scale }
}

function clearChildren(...elements) {
    for (const element of elements) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
}

function createPath(d, fill, stroke, strokeWidth) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", d)
    path.setAttribute("fill", fill)
    path.setAttribute("stroke", stroke)
    path.setAttribute("stroke-width", strokeWidth)
    return path
}

function createCircle(cx, cy, r, fill, stroke, strokeWidth) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    circle.setAttribute("cx", cx)
    circle.setAttribute("cy", cy)
    circle.setAttribute("r", r)
    circle.setAttribute("fill", fill)
    circle.setAttribute("stroke", stroke)
    circle.setAttribute("stroke-width", strokeWidth)
    return circle
}

function loadMonzo() {
    if (!(textArea instanceof HTMLTextAreaElement) ||
        !(previewSvg instanceof SVGElement) ||
        !(grid instanceof SVGGElement) ||
        !(lineGroup instanceof SVGGElement) ||
        !(pitchClassGroup instanceof SVGGElement)) {
        return
    }

    const text = textArea.value
    const pitches = parsePitches(text)

    clearChildren(grid, lineGroup, pitchClassGroup)
    let rootNode = true
    for (const { mute, monzo } of pitches) {
        const { x, y } = getPitchPoint(monzo, globalScale)
        if (mute) {
            pitchClassGroup.appendChild(createCircle(
                x + centerX, y + centerY, 15, "#FFFFFF", "#FDC6FE", "6"))
        } else if (rootNode) {
            pitchClassGroup.appendChild(createPath(
                `M ${x + centerX},${y + centerY - 40} l 40,40 l -40,40 l -40,-40 Z`,
                "#FFFFFF", "#2B2F75", "6"))
            pitchClassGroup.appendChild(createPath(
                `M ${x + centerX},${y + centerY - 30} l 30,30 l -30,30 l -30,-30 Z`,
                "#2B2F75", "#FFFFFF", "2"))
            rootNode = false
        } else {
            const pitchClass = createPath(
                `M ${x + centerX},${y + centerY - 30} l 30,30 l -30,30 l -30,-30 Z`,
                "#FFFFFF", "#2B2F75", "6")
            pitchClassGroup.appendChild(pitchClass)
        }
    }

    for (let i = 0; i < pitches.length; i++) {
        for (let j = i + 1; j < pitches.length; j++) {
            const monzo1 = pitches[i].monzo
            const monzo2 = pitches[j].monzo
            const interval = Monzo.divide(monzo1, monzo2)
            if (interval.toneDistance !== 1) {
                continue
            }

            const { x: x1, y: y1 } = getPitchPoint(monzo1, globalScale)
            const { x: x2, y: y2 } = getPitchPoint(monzo2, globalScale)
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
            line.setAttribute("x1", x1 + centerX)
            line.setAttribute("y1", y1 + centerY)
            line.setAttribute("x2", x2 + centerX)
            line.setAttribute("y2", y2 + centerY)
            line.setAttribute("stroke", "#808080")
            line.setAttribute("stroke-width", "24")
            lineGroup.appendChild(line)
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
        a.setAttribute("download", "chord_graph.png")
        a.dispatchEvent(new MouseEvent("click"))
    }
}

window.addEventListener("load", () => {
    textArea = document.getElementById("textarea_editor")
    previewSvg = document.getElementById("preview_figure")
    grid = document.getElementById("grid")
    lineGroup = document.getElementById("line_group")
    pitchClassGroup = document.getElementById("pitch_class_group")
    aDownloadSvg = document.getElementById("a_download_svg")
    aDownloadPng = document.getElementById("a_download_png")
    svgImage = document.getElementById("dummy_image")

    loadMonzo()
})
