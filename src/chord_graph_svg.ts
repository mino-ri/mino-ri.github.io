import { Monzo } from "./monzo.js"
import { PitchInfo, XLengthType } from "./pitch.js"

type HslValue = { h: number, s: number, l: number }

type ColorScalePart = { amount: number, h: number, s: number, l: number }

export class ColorScheme {
    gridStroke: string
    noteStroke: string
    noteFill: string
    pitchScheme: ColorScalePart[]

    constructor() {
        this.gridStroke = "#FDC6FE"
        this.noteStroke = "#2B2F75"
        this.noteFill = "#FFFFFF"
        this.pitchScheme = [
            { amount: 0.000, h: 180, s: 220, l: 124 },
            { amount: 0.250, h: 177, s: 152, l: 92 },
            { amount: 0.375, h: 40, s: 219, l: 122 },
            { amount: 0.500, h: 345, s: 220, l: 160 },
            { amount: 0.625, h: 261, s: 210, l: 170 },
            { amount: 0.750, h: 204, s: 203, l: 145 },
            { amount: 1.000, h: 180, s: 220, l: 124 },
        ]
    }

    static #toRgbColor(h: number, s: number, l: number) {
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

    static #toHslValue(rgb: string) {
        // Remove '#' if present
        rgb = rgb.replace(/^#/, '')
        // Parse r, g, b values
        let r = parseInt(rgb.substring(0, 2), 16) / 255
        let g = parseInt(rgb.substring(2, 4), 16) / 255
        let b = parseInt(rgb.substring(4, 6), 16) / 255

        let max = Math.max(r, g, b)
        let min = Math.min(r, g, b)
        let h = 0, s = 0, l = 0
        l = (max + min) / 2

        if (max === min) {
            h = 0
            s = 0
        } else {
            let d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0)
                    break;
                case g:
                    h = (b - r) / d + 2
                    break;
                case b:
                    h = (r - g) / d + 4
                    break;
            }
            h /= 6
        }
        // Convert to 0-360, 0-255 scale
        h = Math.round(h * 360)
        s = Math.round(s * 255)
        l = Math.round(l * 255)
        return { h, s, l }
    }

    #getPitchClassHsl(amount: number): HslValue {
        const fistrScheme = this.pitchScheme[0]
        const lastScheme = this.pitchScheme[this.pitchScheme.length - 1]
        if (!fistrScheme || !lastScheme) {
            return { h: 0, s: 0, l: 0 }
        }
        // amountがpitchSchemeの範囲外の場合は端の値を返す
        if (amount <= fistrScheme.amount) {
            return fistrScheme
        }

        if (amount >= lastScheme.amount) {
            return lastScheme
        }
        // 範囲内の場合、2点間で線形補間（hは色相なので0-360をラップし、最短経路で補間）
        for (let i = 0; i < this.pitchScheme.length - 1; i++) {
            const beforeScheme = this.pitchScheme[i]!
            const afterScheme = this.pitchScheme[i + 1]!
            const a0 = beforeScheme.amount
            const a1 = afterScheme.amount
            if (amount >= a0 && amount <= a1) {
                const t = (amount - a0) / (a1 - a0)
                let h0 = beforeScheme.h % 360
                let h1 = afterScheme.h % 360
                let dh = h1 - h0
                // 色相の最短経路で補間
                if (dh > 180) {
                    dh -= 360
                } else if (dh < -180) {
                    dh += 360
                }
                let h = (h0 + 360 + t * dh) % 360
                const s = beforeScheme.s + t * (afterScheme.s - beforeScheme.s)
                const l = beforeScheme.l + t * (afterScheme.l - beforeScheme.l)
                return { h, s, l }
            }
        }

        return fistrScheme
    }

    setPitchClassColor(index: number, rgb: string): void {
        const { h, s, l } = ColorScheme.#toHslValue(rgb)
        const target = this.pitchScheme[index]
        if (target) {
            target.h = h
            target.s = s
            target.l = l
        }
        if (index == 0) {
            const last = this.pitchScheme[this.pitchScheme.length - 1]
            if (last) {
                last.h = h
                last.s = s
                last.l = l
            }
        }
    }

    getPitchClassColor(amount: number): string {
        const { h, s, l } = this.#getPitchClassHsl(amount)
        return ColorScheme.#toRgbColor(h, s, l)
    }
}

const centerX = 960
const centerY = 960

// const colorScheme = new ColorScheme()

function getPrimePitchClass(prime: number) {
    const denominator = Math.pow(2, Math.floor(Math.log2(prime)))
    return prime / denominator
}

function getIntervalDelta(prime: number, power: number, xLengthType: XLengthType) {
    const pitchClass = getPrimePitchClass(prime)
    const dx = Math.log2(prime) * power - xLengthType.getOctaveFactor(new Monzo(new Map([[prime, power]])))
    const dy = prime === 2 ? 0 : dx * Math.tan(Math.PI * (pitchClass - 0.5))
    return {
        dx: Math.round(dx * xLengthType.scale),
        dy: Math.round(dy * xLengthType.scale),
    }
}

function getPitchPoint(monzo: Monzo, xLengthType: XLengthType) {
    let x = 0
    let y = 0
    for (const [prime, power] of monzo.factors) {
        const { dx, dy } = getIntervalDelta(Number(prime), power, xLengthType)
        x += dx
        y += dy
    }

    return { x, y }
}

function clearChildren(...elements: Element[]) {
    for (const element of elements) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
}

function createPath(d: string, fill: string, stroke: string, strokeWidth: string) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", d)
    path.setAttribute("fill", fill)
    path.setAttribute("stroke", stroke)
    path.setAttribute("stroke-width", strokeWidth)
    return path
}

function createDiamond(x: number, y: number, size: number, fill: string, stroke: string, strokeWidth: string) {
    return createPath(
        `M ${x + centerX},${y + centerY - size} l ${size},${size} l -${size},${size} l -${size},-${size} Z`,
        fill, stroke, strokeWidth)
}

function createCircle(cx: number, cy: number, r: number, fill: string, stroke: string, strokeWidth: string) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    circle.setAttribute("cx", (cx + centerX).toString())
    circle.setAttribute("cy", (cy + centerY).toString())
    circle.setAttribute("r", r.toString())
    circle.setAttribute("fill", fill)
    circle.setAttribute("stroke", stroke)
    circle.setAttribute("stroke-width", strokeWidth)
    return circle
}

function createLine(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth: string) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
    line.setAttribute("x1", (x1 + centerX).toString())
    line.setAttribute("y1", (y1 + centerY).toString())
    line.setAttribute("x2", (x2 + centerX).toString())
    line.setAttribute("y2", (y2 + centerY).toString())
    line.setAttribute("stroke", stroke)
    line.setAttribute("stroke-width", strokeWidth)
    return line
}

function createOctaveArc(x1: number, y1: number, x2: number, y2: number, scale: number, stroke: string, strokeWidth: string) {
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

export class PitchSvgGenerator {
    previewSvg: SVGSVGElement
    grid: SVGGElement
    lineGroup: SVGGElement
    pitchClassGroup: SVGGElement
    colorScheme: ColorScheme

    constructor(previewSvg: SVGSVGElement, grid: SVGGElement, lineGroup: SVGGElement, pitchClassGroup: SVGGElement, colorScheme: ColorScheme) {
        this.previewSvg = previewSvg
        this.grid = grid
        this.lineGroup = lineGroup
        this.pitchClassGroup = pitchClassGroup
        this.colorScheme = colorScheme
    }
    
    addIntervalLine(monzo1: Monzo, monzo2: Monzo, xLengthType: XLengthType) {
        const interval = Monzo.divide(monzo1, monzo2)
        if (interval.pitchDistance !== 1) {
            return
        }
    
        const { x: x1, y: y1 } = getPitchPoint(monzo1, xLengthType)
        const { x: x2, y: y2 } = getPitchPoint(monzo2, xLengthType)
    
        const intervalClass = Math.pow(2, Math.abs(interval.pitch) % 1) - 1
        if (interval.isOnly2) {
            const line = createOctaveArc(x1, y1, x2, y2, xLengthType.scale, this.colorScheme.gridStroke, "12")
            line.setAttribute("data-prime", interval.minPrime.toString())
            // オクターブ線は必ず最後に入れる
            this.lineGroup.appendChild(line)
        } else {
            const color = this.colorScheme.getPitchClassColor(intervalClass)
            const line = createLine(x1, y1, x2, y2, color, "24")
            const prime = interval.minPrime
            line.setAttribute("data-prime", prime.toString())
            if (this.lineGroup.firstChild) {
                for (let child: ChildNode | null = this.lineGroup.firstChild; child !== null; child = child.nextSibling) {
                    if (child instanceof SVGElement && child.dataset["prime"] && 
                        (child.dataset["prime"] === "2" || prime < Number(child.dataset["prime"]))) {
                        this.lineGroup.insertBefore(line, child)
                        break
                    } else if (!child.nextSibling) {
                        this.lineGroup.appendChild(line)
                    }
                }
            } else {
                this.lineGroup.appendChild(line)
            }
        }
    }
    
    createSvg(xLengthType: XLengthType, pitches: PitchInfo[], autoSize: boolean) {
        clearChildren(this.grid, this.lineGroup, this.pitchClassGroup)
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
                this.pitchClassGroup.appendChild(createCircle(x, y, 15, this.colorScheme.noteFill, this.colorScheme.gridStroke, "6"))
            } else if (rootNode) {
                this.pitchClassGroup.appendChild(createDiamond(x, y, 40, this.colorScheme.noteFill, this.colorScheme.noteStroke, "6"))
                this.pitchClassGroup.appendChild(createDiamond(x, y, 30, this.colorScheme.noteStroke, this.colorScheme.noteFill, "2"))
                rootNode = false
            } else {
                this.pitchClassGroup.appendChild(createDiamond(x, y, 30, this.colorScheme.noteFill, this.colorScheme.noteStroke, "6"))
            }
        }
    
        if (autoSize) {
            this.previewSvg.setAttribute("viewBox", `${minX + centerX} ${minY + centerY} ${maxX - minX} ${maxY - minY}`)
        } else {
            this.previewSvg.setAttribute("viewBox", "0 0 1920 1920")
        }
    
        for (let i = 0; i < pitches.length; i++) {
            for (let j = i + 1; j < pitches.length; j++) {
                this.addIntervalLine(pitches[i]!.monzo, pitches[j]!.monzo, xLengthType)
            }
        }
    }
}
