import { Monzo } from "./monzo.js"

export class XLengthType {
    static Integer = new XLengthType(126.185950714291, null)
    static OctaveReduced = new XLengthType(341.902258270291, Monzo.getOctaveFactor)
    static Shasavic = new XLengthType(341.902258270291, Monzo.getShasavicOctaveFactor)

    scale: number
    getOctaveFactor: (monzo: Monzo) => number
    constructor(scale: number | null, getOctaveFactor: ((monzo: Monzo) => number) | null) {
        this.scale = scale || 128
        this.getOctaveFactor = getOctaveFactor || (() => 0)
    }

    toStructual(monzo: Monzo) {
        let power2 = this.getOctaveFactor(monzo)
        return power2 === 0 ? monzo : Monzo.multiply(monzo, Monzo.from2Factor(power2))
    }

    fromStructual(monzo: Monzo) {
        let power2 = this.getOctaveFactor(monzo)
        return power2 === 0 ? monzo : Monzo.divide(monzo, Monzo.from2Factor(power2))
    }
}

export type PitchInfo = {
    mute: boolean
    monzo: Monzo
    originalMonzo: Monzo
}

// テキストからピッチの配列を取得する
export function parsePitches(text: string, ignoreOctave: boolean, xLengthType: XLengthType): PitchInfo[] {
    // スペース区切りで分割
    const tokens = text.trim().split(/\s+/)
    const monzos: PitchInfo[] = []
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
            monzo = Monzo.fromFraction(num ?? 1, denom ?? 1)
        } else {
            // 整数の場合
            monzo = Monzo.fromInt(Number(token))
        }
        let originalMonzo = monzo
        monzo = xLengthType.toStructual(monzo)
        if (ignoreOctave) {
            monzo.factors.delete(2)
            originalMonzo = xLengthType.fromStructual(originalMonzo)
        }

        const sameEntry = monzos.find(m => Monzo.divide(monzo, m.monzo).pitchDistance === 0)
        if (sameEntry) {
            sameEntry.mute = mute && sameEntry.mute
        } else {
            monzos.push({ mute, monzo, originalMonzo })
        }
    }

    return monzos
}
