var textArea;
var previewSvg;
var grid;
var lineGroup;
var pitchClassGroup;
const centerX = 960
const centerY = 960
const globalScale = 128

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

function loadMonzo() {
    if (!(textArea instanceof HTMLTextAreaElement) ||
        !(previewSvg instanceof SVGElement) ||
        !(grid instanceof SVGGElement) ||
        !(lineGroup instanceof SVGGElement) ||
        !(pitchClassGroup instanceof SVGGElement)) {
        return
    }

    const text = textArea.value
    const monzos = parseMonzos(text)

    clearChildren(grid, lineGroup, pitchClassGroup)
    let rootNode = true
    for (const monzo of monzos) {
        const { x, y } = getPitchPoint(monzo, globalScale)
        if (rootNode) {
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

    for (let i = 0; i < monzos.length; i++) {
        for (let j = i + 1; j < monzos.length; j++) {
            const monzo1 = monzos[i]
            const monzo2 = monzos[j]
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

window.addEventListener("load", () => {
    textArea = document.getElementById("textarea_editor")
    previewSvg = document.getElementById("preview_figure")
    grid = document.getElementById("grid")
    lineGroup = document.getElementById("line_group")
    pitchClassGroup = document.getElementById("pitch_class_group")

    loadMonzo()
})
