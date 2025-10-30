import { ColorScheme, clearChildren, createPath, createDiamond, createCircle, createLine, centerX, centerY } from "./svg_generator.js"
import { Monzo } from "./monzo.js"
import { PitchInfo, XLengthType } from "./pitch.js"

export type Option = {
    xLengthType: XLengthType,
    autoSize: boolean,
    isAngleLog: boolean,
    yLengthLimit: boolean,
    quantizeEdo: number,
}

function getPrimePitchClass(prime: number, isAngleLog: boolean): number {
    if (isAngleLog) {
        return (Math.log2(prime) % 1 + 1) % 1 + 1
    } else {
        const denominator = Math.pow(2, Math.floor(Math.log2(prime)))
        return prime / denominator
    }
}

function getIntervalDelta(prime: number, power: number, option: Option) {
    if (prime !== 2 && option.quantizeEdo > 1) {
        const quantized = Math.round(Math.log2(prime) * option.quantizeEdo) / option.quantizeEdo
        prime = quantized % 1 === 0 ? 2 : Math.pow(2, quantized)
    }

    const pitchClass = getPrimePitchClass(prime, option.isAngleLog)
    const dx = (Math.log2(prime) * power - option.xLengthType.getOctaveFactor(new Monzo(new Map([[prime, power]]))))
        * option.xLengthType.scale
    let tangent = Math.tan(Math.PI * (pitchClass - 0.5))
    let dy = Math.round(prime === 2 ? 0 : dx * tangent)
    let middlePoint: { dx: number, dy: number } | null = null
    if (option.yLengthLimit && Math.abs(dy) > 512) {
        dy = Math.sign(dy) * 512
        middlePoint = { dx: Math.round(dy / tangent), dy }
    }

    return {
        dx: Math.round(dx),
        dy,
        middlePoint,
    }
}

function getPitchInterval(monzo: Monzo, option: Option) {
    for (const [prime, power] of monzo.factors) {
        return getIntervalDelta(Number(prime), power, option)
    }
    return { dx: 0, dy: 0, middlePoint: null }
}

function getPitchPoint(monzo: Monzo, option: Option) {
    let x = 0
    let y = 0
    for (const [prime, power] of monzo.factors) {
        const { dx, dy } = getIntervalDelta(Number(prime), power, option)
        x += dx
        y += dy
    }

    return { x, y }
}

function createYLimitedLine(x1: number, y1: number, x2: number, y2: number, middlePoint: { dx: number, dy: number }, stroke: string, strokeWidth: string) {
    const { dx, dy } = middlePoint

    return createPath(
        `M ${x1 + centerX},${y1 + centerY} C ${x1 + dx + centerX},${y1 + dy + centerY} ${x2 - dx + centerX},${y2 - dy + centerY} ${x2 + centerX},${y2 + centerY}`,
        "none", stroke, strokeWidth)
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
    minX = -50
    minY = -50
    maxX = 50
    maxY = 50

    constructor(previewSvg: SVGSVGElement, grid: SVGGElement, lineGroup: SVGGElement, pitchClassGroup: SVGGElement, colorScheme: ColorScheme) {
        this.previewSvg = previewSvg
        this.grid = grid
        this.lineGroup = lineGroup
        this.pitchClassGroup = pitchClassGroup
        this.colorScheme = colorScheme
    }

    resetSize() {
        this.minX = -50
        this.minY = -50
        this.maxX = 50
        this.maxY = 50
    }

    addPitchPoint(pitches: PitchInfo[], option: Option) {
        let rootNode = true
        for (const { mute, monzo } of pitches) {
            const { x, y } = getPitchPoint(monzo, option)
            this.minX = Math.min(this.minX, Math.round(x - 50))
            this.minY = Math.min(this.minY, Math.round(y - 50))
            this.maxX = Math.max(this.maxX, Math.round(x + 50))
            this.maxY = Math.max(this.maxY, Math.round(y + 50))
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
    }

    addIntervalLine(monzo1: Monzo, monzo2: Monzo, option: Option) {
        const interval = Monzo.divide(monzo2, monzo1)
        if (interval.pitchDistance !== 1) {
            return
        }

        const { x: x1, y: y1 } = getPitchPoint(monzo1, option)
        const { dx, dy, middlePoint } = getPitchInterval(interval, option)
        const x2 = x1 + dx
        const y2 = y1 + dy

        const intervalClass = Math.pow(2, Math.abs(interval.pitch) % 1) - 1
        if (interval.isOnly2) {
            const line = createOctaveArc(x1, y1, x2, y2, option.xLengthType.scale, this.colorScheme.gridStroke, "12")
            line.setAttribute("data-prime", interval.minPrime.toString())
            if (option.xLengthType !== XLengthType.Integer) {
                this.maxY = Math.max(this.maxY, Math.round(y1 + 100))
            }
            // オクターブ線は必ず最後に入れる
            this.lineGroup.appendChild(line)
        } else {
            const color = this.colorScheme.getPitchClassColor(intervalClass)
            const line = middlePoint
                ? createYLimitedLine(x1, y1, x2, y2, middlePoint, color, "24")
                : createLine(x1, y1, x2, y2, color, "24")
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

    createSvg(pitches: PitchInfo[], option: Option) {
        clearChildren(this.grid, this.lineGroup, this.pitchClassGroup)

        this.resetSize()
        this.addPitchPoint(pitches, option)

        for (let i = 0; i < pitches.length; i++) {
            for (let j = i + 1; j < pitches.length; j++) {
                this.addIntervalLine(pitches[i]!.monzo, pitches[j]!.monzo, option)
            }
        }

        if (option.autoSize) {
            this.previewSvg.setAttribute("viewBox", `${this.minX + centerX} ${this.minY + centerY} ${this.maxX - this.minX} ${this.maxY - this.minY}`)
        } else {
            this.previewSvg.setAttribute("viewBox", "0 0 1920 1920")
        }
    }
}
