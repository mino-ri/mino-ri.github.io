import { Monzo } from "./monzo.js";
const primes = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29,
    31, 37, 41, 43, 47, 53, 59, 61, 67,
    71, 73, 79, 83, 89, 97,
];
export class XLengthType {
    static Integer = new XLengthType(126.185950714291, null);
    static OctaveReduced = new XLengthType(341.902258270291, Monzo.getOctaveFactor);
    static Shasavic = new XLengthType(341.902258270291, Monzo.getShasavicOctaveFactor);
    scale;
    getOctaveFactor;
    constructor(scale, getOctaveFactor) {
        this.scale = scale || 128;
        this.getOctaveFactor = getOctaveFactor || (() => 0);
    }
    toStructual(monzo) {
        let power2 = this.getOctaveFactor(monzo);
        return power2 === 0 ? monzo : Monzo.multiply(monzo, Monzo.from2Factor(power2));
    }
    fromStructual(monzo) {
        let power2 = this.getOctaveFactor(monzo);
        return power2 === 0 ? monzo : Monzo.divide(monzo, Monzo.from2Factor(power2));
    }
}
export function parsePitches(text, ignoreOctave, xLengthType) {
    const tokens = text.trim().split(/\s+/);
    const monzos = [];
    for (let token of tokens) {
        let mute = false;
        if (token.startsWith('x')) {
            mute = true;
            token = token.substring(1);
        }
        let monzo = null;
        if (token.startsWith('[') && token.includes(',') && token.endsWith('>')) {
            const factors = token.substring(1, token.length - 1).split(',').map(Number);
            const factorMap = new Map();
            for (let i = 0; i < factors.length; i++) {
                const prime = primes[i];
                const factor = factors[i];
                if (factor !== undefined && factor !== 0 && prime !== undefined) {
                    factorMap.set(prime, factor);
                }
            }
            monzo = new Monzo(factorMap);
        }
        else if (token.includes('/')) {
            const [num, denom] = token.split('/').map(Number);
            monzo = Monzo.fromFraction(num ?? 1, denom ?? 1);
        }
        else {
            monzo = Monzo.fromInt(Number(token));
        }
        let originalMonzo = monzo;
        monzo = xLengthType.toStructual(monzo);
        if (ignoreOctave) {
            monzo.factors.delete(2);
            originalMonzo = xLengthType.fromStructual(monzo);
        }
        const sameEntry = monzos.find(m => Monzo.divide(monzo, m.monzo).pitchDistance === 0);
        if (sameEntry) {
            sameEntry.mute = mute && sameEntry.mute;
        }
        else {
            monzos.push({ mute, monzo, originalMonzo });
        }
    }
    return monzos;
}
function addNearPitch(interpolatings) {
    for (const intp of interpolatings) {
        if (intp.added) {
            continue;
        }
        for (let i = 0; i <= intp.distances.length; i++) {
            if (intp.distances[i] === 1 && interpolatings[i]?.added) {
                intp.added = true;
                return true;
            }
        }
    }
    return false;
}
function addNearPitches(interpolatings) {
    while (addNearPitch(interpolatings)) { }
}
function isAllAdded(interpolatings) {
    return interpolatings.every((intp) => intp.added);
}
function getNearestAddablePitch(interpolatings) {
    let minDistance = Number.MAX_VALUE;
    let minPitch = null;
    for (const intp of interpolatings) {
        if (intp.added) {
            continue;
        }
        let newMinDistance = intp.norm;
        let other = Monzo.one;
        for (let i = 0; i <= intp.distances.length; i++) {
            const target = interpolatings[i];
            const distance = intp.distances[i];
            if (target && distance && target.added && distance < newMinDistance) {
                newMinDistance = distance;
                other = target.pitch.monzo;
            }
        }
        if (newMinDistance < minDistance) {
            minDistance = newMinDistance;
            minPitch = { pitch: intp.pitch.monzo, other: other };
        }
    }
    return minPitch;
}
function getInterpolatedPitch(interpolatings) {
    const minPitch = getNearestAddablePitch(interpolatings);
    if (!minPitch) {
        return [];
    }
    const { pitch, other } = minPitch;
    const interval = Monzo.divide(pitch, other);
    const result = [];
    let acmMap = other.factors;
    for (const [prime, count] of [...interval.factors].sort(([p1], [p2]) => p1 === 2 ? 1 : p2 === 2 ? -1 : p1 - p2)) {
        const countAbs = Math.abs(count);
        const countSign = Math.sign(count);
        for (let i = 0; i < countAbs; i++) {
            acmMap = new Map(acmMap);
            acmMap.set(prime, (acmMap.get(prime) ?? 0) + countSign);
            const newPitch = new Monzo(acmMap);
            result.push({
                mute: true,
                monzo: newPitch,
                originalMonzo: newPitch,
            });
        }
    }
    result.pop();
    return result;
}
function addInterpolatings(interpolatings, newPitches) {
    for (const intp of interpolatings) {
        if (intp.added) {
            continue;
        }
        intp.distances.push(...newPitches.map((p) => Monzo.divide(intp.pitch.monzo, p.monzo).pitchDistance));
    }
    interpolatings.push(...newPitches.map((p) => ({
        pitch: p,
        distances: [],
        norm: 0,
        added: true,
    })));
}
export function interpolateMutedNote(pitches) {
    const interpolatings = pitches
        .map((pitch) => {
        const norm = pitch.monzo.pitchDistance;
        return {
            pitch,
            distances: pitches.map((other) => Monzo.divide(pitch.monzo, other.monzo).pitchDistance),
            norm,
            added: norm <= 1
        };
    });
    if (interpolatings.every((intp) => intp.norm !== 0)) {
        const mutedOne = {
            mute: true,
            monzo: Monzo.one,
            originalMonzo: Monzo.one,
        };
        pitches.push(mutedOne);
        addInterpolatings(interpolatings, [mutedOne]);
    }
    for (let i = 0; i < 100; i++) {
        addNearPitches(interpolatings);
        if (isAllAdded(interpolatings)) {
            return;
        }
        const addingPitches = getInterpolatedPitch(interpolatings);
        if (addingPitches.length === 0) {
            return;
        }
        pitches.push(...addingPitches);
        addInterpolatings(interpolatings, addingPitches);
    }
}
