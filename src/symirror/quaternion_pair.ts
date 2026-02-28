import { Vector } from "./vector.js";

// 四元数のペア（左と右）で、鏡面変換と回転を表します。
export type QuaternionPair = {
    rw: number
    rx: number
    ry: number
    rz: number
    lw: number
    lx: number
    ly: number
    lz: number
    conjugate: boolean
}

export class QuaternionPairs {
    static readonly identity: QuaternionPair = { rw: 1, rx: 0, ry: 0, rz: 0, lw: 1, lx: 0, ly: 0, lz: 0, conjugate: false }

    static #conjugateBy(resultTo: QuaternionPair, a: QuaternionPair) {
        resultTo.lx = -a.rx
        resultTo.ly = -a.ry
        resultTo.lz = -a.rz
        resultTo.lw = a.rw
        resultTo.rx = -a.lx
        resultTo.ry = -a.ly
        resultTo.rz = -a.lz
        resultTo.rw = a.lw
    }

    static #mulBy(resultTo: QuaternionPair, a: QuaternionPair, b: QuaternionPair) {
        const lx = a.lw * b.lx + a.lx * b.lw + a.ly * b.lz - a.lz * b.ly
        const ly = a.lw * b.ly - a.lx * b.lz + a.ly * b.lw + a.lz * b.lx
        const lz = a.lw * b.lz + a.lx * b.ly - a.ly * b.lx + a.lz * b.lw
        const lw = a.lw * b.lw - a.lx * b.lx - a.ly * b.ly - a.lz * b.lz
        const rx = b.rw * a.rx + b.rx * a.rw + b.ry * a.rz - b.rz * a.ry
        const ry = b.rw * a.ry - b.rx * a.rz + b.ry * a.rw + b.rz * a.rx
        const rz = b.rw * a.rz + b.rx * a.ry - b.ry * a.rx + b.rz * a.rw
        const rw = b.rw * a.rw - b.rx * a.rx - b.ry * a.ry - b.rz * a.rz
        resultTo.lx = lx
        resultTo.ly = ly
        resultTo.lz = lz
        resultTo.lw = lw
        resultTo.rx = rx
        resultTo.ry = ry
        resultTo.rz = rz
        resultTo.rw = rw
    }

    static getDefault(): QuaternionPair {
        return { rw: 1, rx: 0, ry: 0, rz: 0, lw: 1, lx: 0, ly: 0, lz: 0, conjugate: false }
    }

    static mul(a: QuaternionPair, b: QuaternionPair, resultTo?: QuaternionPair): QuaternionPair {
        const result = resultTo ?? QuaternionPairs.getDefault()
        if (a.conjugate) {
            QuaternionPairs.#conjugateBy(result, b)
            QuaternionPairs.#mulBy(result, a, result)
        } else {
            QuaternionPairs.#mulBy(result, a, b)
        }

        result.conjugate = a.conjugate !== b.conjugate
        return result
    }

    static transform(v: Vector, q: QuaternionPair, resultTo?: Vector): Vector {
        const result = resultTo ?? new Array<number>(4)
        const ux = q.conjugate ? v[0]! : -v[0]!
        const uy = q.conjugate ? v[1]! : -v[1]!
        const uz = q.conjugate ? v[2]! : -v[2]!
        const uw = v[3]!

        const vx = q.lw * ux + q.lx * uw + q.ly * uz - q.lz * uy
        const vy = q.lw * uy - q.lx * uz + q.ly * uw + q.lz * ux
        const vz = q.lw * uz + q.lx * uy - q.ly * ux + q.lz * uw
        const vw = q.lw * uw - q.lx * ux - q.ly * uy - q.lz * uz

        result[0] = vw * q.rx + vx * q.rw + vy * q.rz - vz * q.ry
        result[1] = vw * q.ry - vx * q.rz + vy * q.rw + vz * q.rx
        result[2] = vw * q.rz + vx * q.ry - vy * q.rx + vz * q.rw
        result[3] = vw * q.rw - vx * q.rx - vy * q.ry - vz * q.rz
        return result
    }

    static mirror(v: Vector, resultTo?: QuaternionPair): QuaternionPair {
        const result = resultTo ?? QuaternionPairs.getDefault()
        result.lx = -v[0]!
        result.ly = -v[1]!
        result.lz = -v[2]!
        result.lw = -v[3]!
        result.rx = v[0]!
        result.ry = v[1]!
        result.rz = v[2]!
        result.rw = v[3]!
        result.conjugate = true
        return result
    }
}
