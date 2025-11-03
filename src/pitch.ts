import { Monzo } from "./monzo.js"

const primes = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29,
    31, 37, 41, 43, 47, 53, 59, 61, 67,
    71, 73, 79, 83, 89, 97,
]

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
        if (token.startsWith('[') && token.includes(',') && token.endsWith('>')) {
            // モンゾ表記の場合
            const factors = token.substring(1, token.length - 1).split(',').map(Number)
            const factorMap = new Map<number, number>()
            for (let i = 0; i < factors.length; i++) {
                const prime = primes[i]
                const factor = factors[i]
                if (factor !== undefined && factor !== 0 && prime !== undefined) {
                    factorMap.set(prime, factor)
                }
            }
            monzo = new Monzo(factorMap)
        } else if (token.includes('/')) {
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
            originalMonzo = xLengthType.fromStructual(monzo)
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

type InterpolatingPitch = {
    pitch: PitchInfo,
    distances: number[],
    norm: number,
    added: boolean
}

// 現在の状態から、結果グループに含めてよいピッチの added フラグを立てる
function addNearPitch(interpolatings: InterpolatingPitch[]): boolean {
    for (const intp of interpolatings) {
        if (intp.added) {
            continue
        }

        for (let i = 0; i <= intp.distances.length; i++) {
            if (intp.distances[i] === 1 && interpolatings[i]?.added) {
                intp.added = true
                return true
            }
        }
    }

    return false
}

function addNearPitches(interpolatings: InterpolatingPitch[]) {
    while (addNearPitch(interpolatings)) { }
}

function isAllAdded(interpolatings: InterpolatingPitch[]) {
    return interpolatings.every((intp) => intp.added)
}

// 現在の状態で結果グループに含まれないピッチのうち、結果グループに含まれるピッチに最も近いものを取得
function getNearestAddablePitch(interpolatings: InterpolatingPitch[]) {
    let minDistance = Number.MAX_VALUE
    let minPitch: { pitch: Monzo, other: Monzo } | null = null
    for (const intp of interpolatings) {
        if (intp.added) {
            continue
        }

        // added な中で最も近いピッチと、それとの距離を取得
        let newMinDistance = intp.norm
        let other = Monzo.one
        for (let i = 0; i <= intp.distances.length; i++) {
            const target = interpolatings[i]
            const distance = intp.distances[i]
            if (target && distance && target.added && distance < newMinDistance) {
                newMinDistance = distance
                other = target.pitch.monzo
            }
        }

        if (newMinDistance < minDistance) {
            minDistance = newMinDistance
            minPitch = { pitch: intp.pitch.monzo, other: other }
        }
    }

    return minPitch
}

function getInterpolatedPitch(interpolatings: InterpolatingPitch[]): PitchInfo[] {
    const minPitch = getNearestAddablePitch(interpolatings)
    if (!minPitch) {
        return []
    }

    const { pitch, other } = minPitch
    const interval = Monzo.divide(pitch, other)
    const result: PitchInfo[] = []
    let acmMap = other.factors
    for (const [prime, count] of [...interval.factors].sort(([p1], [p2]) => p1 === 2 ? 1 : p2 === 2 ? -1 : p1 - p2)) {
        const countAbs = Math.abs(count)
        const countSign = Math.sign(count)

        for (let i = 0; i < countAbs; i++) {
            acmMap = new Map(acmMap)
            acmMap.set(prime, (acmMap.get(prime) ?? 0) + countSign)
            const newPitch = new Monzo(acmMap)
            result.push({
                mute: true,
                monzo: newPitch,
                originalMonzo: newPitch,
            })
        }
    }
    result.pop()

    return result
}

function addInterpolatings(interpolatings: InterpolatingPitch[], newPitches: PitchInfo[]) {
    for (const intp of interpolatings) {
        if (intp.added) {
            continue
        }

        intp.distances.push(...newPitches.map((p) => Monzo.divide(intp.pitch.monzo, p.monzo).pitchDistance))
    }

    // 追加されるピッチは存在確認にしか使われず、 added: true であればよい。他のパラメータは適当にする
    interpolatings.push(...newPitches.map((p) => ({
        pitch: p,
        distances: [],
        norm: 0,
        added: true,
    })))
}

export function interpolateMutedNote(pitches: PitchInfo[]) {
    const interpolatings: InterpolatingPitch[] = pitches
        .map((pitch) => {
            const norm = pitch.monzo.pitchDistance
            return {
                pitch,
                distances: pitches.map((other) => Monzo.divide(pitch.monzo, other.monzo).pitchDistance),
                norm,
                added: norm <= 1
            }
        })

    // 原点は必ず追加する
    if (interpolatings.every((intp) => intp.norm !== 0)) {
        const mutedOne = {
            mute: true,
            monzo: Monzo.one,
            originalMonzo: Monzo.one,
        }
        pitches.push(mutedOne)
        addInterpolatings(interpolatings, [mutedOne])
    }

    // 理論上は無限ループだが、補間できる距離には上限を設ける
    for (let i = 0; i < 100; i++) {
        addNearPitches(interpolatings)
        if (isAllAdded(interpolatings)) {
            return
        }

        const addingPitches = getInterpolatedPitch(interpolatings)
        if (addingPitches.length === 0) {
            return
        }

        pitches.push(...addingPitches)
        addInterpolatings(interpolatings, addingPitches)
    }
}
