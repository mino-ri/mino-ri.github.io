import { PitchInfo } from "./pitch.js"
import { ColorScheme } from "./svg_generator.js"
import { clearChildren, createCircle, createLine } from "./svg_generator.js"
import { Monzo } from "./monzo.js"

const baseSize = 800

export type Option = {
    quantizeEdo: number,
    showSteps: boolean,
    autoCompleteLimitInterval: number,
}

function getPitchPoint(monzo: Monzo, option: Option) {
    const pitch = monzo.quantizedPitch(option.quantizeEdo)
    const angle = pitch * Math.PI * 2
    const x = Math.sin(angle) * baseSize
    const y = -Math.cos(angle) * baseSize
    return { x, y }
}

export class PitchClassSvgGenerator {
    static #primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31]

    previewSvg: SVGSVGElement
    lineGroup: SVGGElement
    gridGroup: SVGGElement
    pitchClassGroup: SVGGElement
    colorScheme: ColorScheme

    constructor(previewSvg: SVGSVGElement, lineGroup: SVGGElement, gridGroup: SVGGElement, pitchClassGroup: SVGGElement, colorScheme: ColorScheme) {
        this.previewSvg = previewSvg
        this.lineGroup = lineGroup
        this.gridGroup = gridGroup
        this.pitchClassGroup = pitchClassGroup
        this.colorScheme = colorScheme
    }

    generate(pitches: PitchInfo[], option: Option) {
        clearChildren(this.lineGroup, this.gridGroup, this.pitchClassGroup)

        this.gridGroup.appendChild(createCircle(0, 0, 800, "none", this.colorScheme.gridStroke, "20"))

        if (option.showSteps && option.quantizeEdo > 0) {
            for (let i = 0; i < option.quantizeEdo; i++) {
                const angle = (i / option.quantizeEdo) * Math.PI * 2
                const x = Math.sin(angle) * baseSize
                const y = -Math.cos(angle) * baseSize
                this.gridGroup.appendChild(createCircle(x, y, 24, this.colorScheme.gridStroke, "none", "0"))
            }
        }

        for (const pitchInfo of pitches) {
            const monzo = pitchInfo.monzo
            const { x, y } = getPitchPoint(monzo, option)
            const colorAmount = Math.pow(2, Math.log2(monzo.maxPrime) % 1) - 1
            const color = colorAmount === 0
                ? this.colorScheme.noteStroke
                : this.colorScheme.getPitchClassColor(colorAmount)

            if (pitchInfo.mute) {
                this.pitchClassGroup.appendChild(createCircle(x, y, 28, this.colorScheme.gridStroke, "none", "0"))
            } else {
                this.pitchClassGroup.appendChild(createCircle(x, y, 48, this.colorScheme.noteFill, this.colorScheme.noteStroke, "6"))
                this.pitchClassGroup.appendChild(createCircle(x, y, 32, color, "none", "0"))
            }
        }

        let autoCompleteSteps: { step: number, color: string }[] = []
        if (option.quantizeEdo > 0 && option.autoCompleteLimitInterval > 0) {
            autoCompleteSteps = PitchClassSvgGenerator.#primes
                .filter(p => p <= option.autoCompleteLimitInterval)
                .map(p => ({
                    step: Math.round(Math.log2(p) * option.quantizeEdo) % option.quantizeEdo,
                    color: this.colorScheme.getPitchClassColor(Math.pow(2, Math.log2(p) % 1) - 1),
                }))
        }

        for (let i = 0; i < pitches.length; i++) {
            for (let j = i + 1; j < pitches.length; j++) {
                const interval = Monzo.divide(pitches[j]!.monzo, pitches[i]!.monzo)

                const intervalSteps = option.quantizeEdo > 0
                    ? Math.abs(interval.quantizedStepCount(option.quantizeEdo) % option.quantizeEdo)
                    : 0
                const completedInterval = autoCompleteSteps.find(s =>
                    s.step === intervalSteps || s.step === (option.quantizeEdo - intervalSteps))
                if (!completedInterval && interval.pitchDistance !== 1) {
                    continue
                }

                const color =
                    completedInterval?.color ??
                    (this.colorScheme.getPitchClassColor(Math.pow(2, Math.abs(interval.pitch) % 1) - 1))
                const { x: x1, y: y1 } = getPitchPoint(pitches[i]!.monzo, option)
                const { x: x2, y: y2 } = getPitchPoint(pitches[j]!.monzo, option)
                this.lineGroup.appendChild(createLine(x1, y1, x2, y2, color, "48"))
            }
        }
    }
}
