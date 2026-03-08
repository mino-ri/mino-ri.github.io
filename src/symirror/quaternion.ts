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

    static clear(a: Quaternion) {
        a.w = 1
        a.x = 0
        a.y = 0
        a.z = 0
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

    static rotate(ax: number, ay: number, az: number, angle: number, target: Quaternion) {
        const halfAngle = angle * 0.5
        const s = Math.sin(halfAngle)
        const c = Math.cos(halfAngle)

        // 新しい回転クォータニオン
        const qw = c
        const qx = ax * s
        const qy = ay * s
        const qz = az * s

        // 現在のクォータニオンに乗算: q * current
        const nw = qw * target.w - qx * target.x - qy * target.y - qz * target.z
        const nx = qw * target.x + qx * target.w + qy * target.z - qz * target.y
        const ny = qw * target.y - qx * target.z + qy * target.w + qz * target.x
        const nz = qw * target.z + qx * target.y - qy * target.x + qz * target.w

        // 正規化
        const len = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz)
        target.w = nw / len
        target.x = nx / len
        target.y = ny / len
        target.z = nz / len
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

    static toMatrix({ x, y, z, w }: Quaternion, matrix: Float32Array) {
        const xx = x * x, yy = y * y, zz = z * z
        const xy = x * y, xz = x * z, yz = y * z
        const wx = w * x, wy = w * y, wz = w * z

        matrix[0] = 1 - 2 * (yy + zz)
        matrix[1] = 2 * (xy + wz)
        matrix[2] = 2 * (xz - wy)
        matrix[3] = 0
        matrix[4] = 2 * (xy - wz)
        matrix[5] = 1 - 2 * (xx + zz)
        matrix[6] = 2 * (yz + wx)
        matrix[7] = 0
        matrix[8] = 2 * (xz + wy)
        matrix[9] = 2 * (yz - wx)
        matrix[10] = 1 - 2 * (xx + yy)
        matrix[11] = 0
        matrix[12] = 0
        matrix[13] = 0
        matrix[14] = 0
        matrix[15] = 1
    }
}
