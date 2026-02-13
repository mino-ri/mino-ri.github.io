import { Vector, Vectors } from "./vector.js";

export type Quaternion = {
    w: number
    x: number
    y: number
    z: number
    negate: boolean
}

export class Quaternions {
    static readonly identity: Quaternion = { w: 1, x: 0, y: 0, z: 0, negate: false }

    static toVector(q: Quaternion): Vector {
        return [q.x, q.y, q.z]
    }

    static conjugateMul(a: Quaternion, bConj: Quaternion, resultTo?: Quaternion): Quaternion {
        const result = resultTo ?? { w: 0, x: 0, y: 0, z: 0, negate: false }
        result.w = -a.w * bConj.w - a.x * bConj.x - a.y * bConj.y - a.z * bConj.z
        result.x = a.w * bConj.x - a.x * bConj.w + a.y * bConj.z - a.z * bConj.y
        result.y = a.w * bConj.y - a.x * bConj.z - a.y * bConj.w + a.z * bConj.x
        result.z = a.w * bConj.z + a.x * bConj.y - a.y * bConj.x - a.z * bConj.w
        result.negate = a.negate !== bConj.negate
        return result
    }

    static mul(a: Quaternion, b: Quaternion, resultTo?: Quaternion): Quaternion {
        const result = resultTo ?? { w: 0, x: 0, y: 0, z: 0, negate: false }
        result.w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
        result.x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y
        result.y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x
        result.z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
        result.negate = a.negate !== b.negate
        return result
    }

    static transform(v: Vector, q: Quaternion, resultTo?: Vector): Vector {
        const result = resultTo ?? new Array<number>(3)
        const vx = v[0]!
        const vy = v[1]!
        const vz = v[2]!
        const qw = -q.x * vx - q.y * vy - q.z * vz
        const qx = q.w * vx + q.y * vz - q.z * vy
        const qy = q.w * vy - q.x * vz + q.z * vx
        const qz = q.w * vz + q.x * vy - q.y * vx
        const s = q.negate ? -1 : 1
        result[0] = s * (-qw * q.x + qx * q.w - qy * q.z + qz * q.y)
        result[1] = s * (-qw * q.y + qx * q.z + qy * q.w - qz * q.x)
        result[2] = s * (-qw * q.z - qx * q.y + qy * q.x + qz * q.w)
        return result
    }

    static rotation(axis: Vector, angleRad: number, resultTo?: Quaternion): Quaternion {
        const result = resultTo ?? { w: 0, x: 0, y: 0, z: 0, negate: false }
        const halfAngle = angleRad * 0.5
        const s = Math.sin(halfAngle)
        result.w = Math.cos(halfAngle)
        result.x = axis[0]! * s
        result.y = axis[1]! * s
        result.z = axis[2]! * s
        result.negate = false
        return result
    }

    static mirror(v: Vector, resultTo?: Quaternion): Quaternion {
        const result = resultTo ?? { w: 0, x: 0, y: 0, z: 0, negate: false }
        result.w = 0
        result.x = v[0]!
        result.y = v[1]!
        result.z = v[2]!
        result.negate = true
        return result
    }

    static fromTo(from: Vector, to: Vector, resultTo?: Quaternion): Quaternion {
        const result = resultTo ?? { w: 0, x: 0, y: 0, z: 0, negate: false }
        const w = 1 + Vectors.dot(from, to)
        const x = from[1]! * to[2]! - from[2]! * to[1]!
        const y = from[2]! * to[0]! - from[0]! * to[2]!
        const z = from[0]! * to[1]! - from[1]! * to[0]!
        const length = Math.sqrt(w * w + x * x + y * y + z * z)
        result.w = w / length
        result.x = x / length
        result.y = y / length
        result.z = z / length
        return result
    }

    static slerp(a: Quaternion, b: Quaternion, t: number, resultTo?: Quaternion): Quaternion {
        const result = resultTo ?? { w: 0, x: 0, y: 0, z: 0, negate: false }

        if (t <= 0) {
            result.w = a.w
            result.x = a.x
            result.y = a.y
            result.z = a.z
            result.negate = a.negate
            return result
        }

        if (t >= 1) {
            result.w = b.w
            result.x = b.x
            result.y = b.y
            result.z = b.z
            result.negate = a.negate
            return result
        }

        let bw = b.w, bx = b.x, by = b.y, bz = b.z
        let dot = a.w * bw + a.x * bx + a.y * by + a.z * bz

        // 最短経路を選択 (q と -q は同じ回転を表すため)
        if (dot < 0) {
            bw = -bw
            bx = -bx
            by = -by
            bz = -bz
            dot = -dot
        }

        // dot が 1 に近い場合、θ ≈ 0 で sinTheta ≈ 0 となるため線形補間にフォールバック
        let scale0: number
        let scale1: number
        if (dot > 0.9995) {
            scale0 = 1 - t
            scale1 = t
        } else {
            const theta = Math.acos(dot)
            const sinTheta = Math.sin(theta)
            scale0 = Math.sin((1 - t) * theta) / sinTheta
            scale1 = Math.sin(t * theta) / sinTheta
        }

        result.w = scale0 * a.w + scale1 * bw
        result.x = scale0 * a.x + scale1 * bx
        result.y = scale0 * a.y + scale1 * by
        result.z = scale0 * a.z + scale1 * bz
        result.negate = a.negate
        return result
    }
}
