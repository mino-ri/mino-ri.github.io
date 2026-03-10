export interface Vector {
    length: number
    [n: number]: number
    [Symbol.iterator](): Iterator<number>
}

export class Vectors {
    static dot(a: Vector, b: Vector): number {
        let result = 0
        const length = Math.min(a.length, b.length)
        for (let i = 0; i < length; i++) {
            result += a[i]! * b[i]!
        }
        return result
    }

    static cross(a: Vector, b: Vector, resultTo: Vector): void {
        if (a.length < 3 || b.length < 3 || resultTo.length < 3) {
            throw new Error('Vectors must have at least 3 dimensions for cross product.')
        }
        const c0 = a[1]! * b[2]! - a[2]! * b[1]!
        const c1 = a[2]! * b[0]! - a[0]! * b[2]!
        const c2 = a[0]! * b[1]! - a[1]! * b[0]!
        resultTo[0] = c0
        resultTo[1] = c1
        resultTo[2] = c2
    }

    static cross4(a: Vector, b: Vector, c: Vector, resultTo?: Vector): Vector {
        const result = resultTo ?? [0, 0, 0, 0]
        const a0 = a[0]!, a1 = a[1]!, a2 = a[2]!, a3 = a[3]!
        const b0 = b[0]!, b1 = b[1]!, b2 = b[2]!, b3 = b[3]!
        const c0 = c[0]!, c1 = c[1]!, c2 = c[2]!, c3 = c[3]!

        result[0] = a1 * (b2 * c3 - b3 * c2) - a2 * (b1 * c3 - b3 * c1) + a3 * (b1 * c2 - b2 * c1)
        result[1] = -a0 * (b2 * c3 - b3 * c2) + a2 * (b0 * c3 - b3 * c0) - a3 * (b0 * c2 - b2 * c0)
        result[2] = a0 * (b1 * c3 - b3 * c1) - a1 * (b0 * c3 - b3 * c0) + a3 * (b0 * c1 - b1 * c0)
        result[3] = -a0 * (b1 * c2 - b2 * c1) + a1 * (b0 * c2 - b2 * c0) - a2 * (b0 * c1 - b1 * c0)
        return result
    }

    static copy(from: Vector, to: Vector) {
        const length = Math.min(from.length, to.length)
        for (let i = 0; i < length; i++) {
            to[i] = from[i]!
        }
        return to
    }

    static mul<T extends Vector>(a: Vector, s: number, resultTo: T): T
    static mul(a: Vector, s: number): Vector
    static mul<T extends Vector>(a: Vector, s: number, resultTo?: T): T | Vector {
        const result = resultTo ?? new Array<number>(a.length)
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i]! * s
        }
        return result
    }

    static div<T extends Vector>(a: Vector, s: number, resultTo: T): T
    static div(a: Vector, s: number): Vector
    static div<T extends Vector>(a: Vector, s: number, resultTo?: T): T | Vector {
        const result = resultTo ?? new Array<number>(a.length)
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i]! / s
        }
        return result
    }

    static add<T extends Vector>(a: Vector, b: Vector, resultTo: T): T
    static add(a: Vector, b: Vector): Vector
    static add<T extends Vector>(a: Vector, b: Vector, resultTo?: T): T | Vector {
        const length = Math.min(a.length, b.length)
        const result = resultTo ?? new Array<number>(length)
        for (let i = 0; i < length; i++) {
            result[i] = a[i]! + b[i]!
        }
        return result
    }

    static sub<T extends Vector>(a: Vector, b: Vector, resultTo: T): T
    static sub(a: Vector, b: Vector): Vector
    static sub<T extends Vector>(a: Vector, b: Vector, resultTo?: T): T | Vector {
        const length = Math.min(a.length, b.length)
        const result = resultTo ?? new Array<number>(length)
        for (let i = 0; i < length; i++) {
            result[i] = a[i]! - b[i]!
        }
        return result
    }

    static normalize<T extends Vector>(v: Vector, resultTo: T): T
    static normalize(v: Vector): Vector
    static normalize<T extends Vector>(v: Vector, resultTo?: T): T | Vector {
        if (resultTo === undefined) {
            return Vectors.mul(v, 1 / Math.sqrt(Vectors.dot(v, v)))
        } else {
            return Vectors.mul(v, 1 / Math.sqrt(Vectors.dot(v, v)), resultTo)
        }
    }

    static negateSelf(v: Vector) {
        for (let i = 0; i < v.length; i++) {
            v[i]! = -v[i]!
        }
    }

    static normalizeSelf(v: Vector) {
        const factor = 1 / Math.sqrt(Vectors.dot(v, v))
        for (let i = 0; i < v.length; i++) {
            v[i]! *= factor
        }
    }

    static distanceSquared(a: Vector, b: Vector): number {
        const length = Math.min(a.length, b.length)
        let sum = 0
        for (let i = 0; i < length; i++) {
            const d = a[i]! - b[i]!
            sum += d * d
        }
        return sum
    }

    static lengthSquared(a: Vector): number {
        let sum = 0
        for (let i = 0; i < a.length; i++) {
            const d = a[i]!
            sum += d * d
        }
        return sum
    }

    static middleDistanceSquared(a: Vector, b: Vector, p: Vector): number {
        const length = Math.min(a.length, b.length)
        let sum = 0
        for (let i = 0; i < length; i++) {
            const d = (a[i]! + b[i]!) * 0.5 - p[i]!
            sum += d * d
        }
        return sum
    }

    static #epsilon = 1e-6
    static #tempMap = new Map<number, [Vector, Vector, Vector]>()
    static #getTempVectors(dimension: number): [Vector, Vector, Vector] {
        let vectors = Vectors.#tempMap.get(dimension)
        if (vectors) return vectors
        vectors = [new Array<number>(dimension), new Array<number>(dimension), new Array<number>(dimension)]
        Vectors.#tempMap.set(dimension, vectors)
        return vectors
    }

    static hasIntersection(a: Vector, b: Vector, c: Vector, d: Vector): boolean {
        const [u, v, w] = Vectors.#getTempVectors(a.length)
        Vectors.sub(b, a, u)
        Vectors.sub(d, c, v)
        Vectors.sub(a, c, w)

        const nrm2U = Vectors.dot(u, u)
        const dotUv = Vectors.dot(u, v)
        const nrm2V = Vectors.dot(v, v)
        const dotUw = Vectors.dot(u, w)
        const dotVw = Vectors.dot(v, w)
        const delta = nrm2U * nrm2V - dotUv * dotUv

        // 2線分が平行か
        if (Math.abs(delta) < Vectors.#epsilon) {
            const nrm2W = Vectors.dot(w, w)
            // 2線分が同一直線上にあるか
            return nrm2U * nrm2W - dotUw * dotUw < Vectors.#epsilon
        }

        const s = (dotUv * dotVw - nrm2V * dotUw) / delta
        const t = (nrm2U * dotVw - dotUv * dotUw) / delta
        // 2線分が、各線分内の領域で最接近するか
        return 0 <= s && s <= 1 && 0 <= t && t <= 1
    }

    static getCrossPoint(a: Vector, b: Vector, c: Vector, d: Vector, resultTo: Vector): Vector | null {
        const [u, v, w] = Vectors.#getTempVectors(a.length)
        Vectors.sub(b, a, u)
        Vectors.sub(d, c, v)
        Vectors.sub(a, c, w)

        const nrm2U = Vectors.dot(u, u)
        const dotUv = Vectors.dot(u, v)
        const nrm2V = Vectors.dot(v, v)
        const dotUw = Vectors.dot(u, w)
        const dotVw = Vectors.dot(v, w)
        const delta = nrm2U * nrm2V - dotUv * dotUv

        if (Math.abs(delta) < Vectors.#epsilon) {
            return null
        }

        const s = (dotUv * dotVw - nrm2V * dotUw) / delta
        const t = (nrm2U * dotVw - dotUv * dotUw) / delta

        if (s < 0 || s > 1 || t < 0 || t > 1) {
            return null
        }

        Vectors.mul(u, s, u)
        Vectors.add(u, a, u)
        Vectors.mul(v, t, v)
        Vectors.add(v, c, v)
        Vectors.add(u, v, resultTo)
        Vectors.mul(resultTo, 0.5, resultTo)
        return Vectors.distanceSquared(u, v) < Vectors.#epsilon ? resultTo : null
    }

    static average(vectors: Vector[], resultTo: Vector): Vector {
        for (let i = 0; i < resultTo.length; i++) {
            resultTo[i] = 0
        }
        if (vectors.length === 0) {
            return resultTo
        }

        for (const vector of vectors) {
            Vectors.add(resultTo, vector, resultTo)
        }
        return Vectors.div(resultTo, vectors.length, resultTo)
    }

    static getRank(matrix: Vector[]): number {
        const rows = matrix.length
        const cols = matrix[0]!.length
        const mat = matrix.map(row => [...row])
        let rank = 0

        for (let col = 0, row = 0; col < cols && row < rows; col++) {
            let pivot = row
            for (let i = row + 1; i < rows; i++) {
                if (Math.abs(mat[i]![col]!) > Math.abs(mat[pivot]![col]!)) pivot = i
            }

            if (Math.abs(mat[pivot]![col]!) < Vectors.#epsilon) continue

            [mat[row], mat[pivot]] = [mat[pivot]!, mat[row]!]

            for (let i = 0; i < rows; i++) {
                if (i !== row) {
                    const factor = mat[i]![col]! / mat[row]![col]!
                    for (let j = col; j < cols; j++) {
                        mat[i]![j]! -= factor * mat[row]![j]!
                    }
                }
            }
            row++
            rank++
        }
        return rank
    }
}
