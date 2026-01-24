export interface Vector {
    length: number
    [n: number]: number
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

    static normalizeSelf(v: Vector) {
        const factor = 1 / Math.sqrt(Vectors.dot(v, v))
        for (let i = 0; i < v.length; i++) {
            v[i]! *= factor
        }
    }

    static reflect<T extends Vector>(target: Vector, mirrorNormal: Vector, resultTo: T): T
    static reflect(target: Vector, mirrorNormal: Vector): Vector
    static reflect<T extends Vector>(target: Vector, mirrorNormal: Vector, resultTo?: T): T | Vector {
        const length = Math.min(target.length, mirrorNormal.length)
        const result = resultTo ?? new Array<number>(length)
        const r = -2 * Vectors.dot(target, mirrorNormal)
        for (let i = 0; i < length; i++) {
            result[i] = target[i]! + mirrorNormal[i]! * r
        }
        return result
    }
}
