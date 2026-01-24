import { Fraction } from "./fraction.js";

export type ElementExchange = {
    from: number[]
    to: number[]
}

export type SpaceType = "euclidean" | "spherical" | "hyperbolic" | "unknown"

// コクセター行列 (コクセター図形の代替として入力値に使う)
// 次のようなインデックスで配列に保存する
//   a b c d
// a - 0 1 3
// b 0 - 2 4
// c 1 2 - 5
// d 3 4 5 -
export class CoxeterMatrix {
    values: Fraction[]
    dimension: number

    constructor(values: Fraction[]) {
        this.values = values
        const length = this.values.length
        this.dimension = Math.sqrt(2 * length + 0.25) + 0.5
    }

    get(a: number, b: number): Fraction {
        if (a == b) {
            return Fraction.one
        }

        const index = a > b
            ? a * (a - 1) / 2 + b
            : b * (b - 1) / 2 + a
        return this.values[index] ?? Fraction.one
    }

    // ElementExchange[先頭のジェネレータ番号][index]
    getExchanges(): ElementExchange[][] {
        const result = new Array<ElementExchange[]>(3)
        for (let i = 0; i < this.dimension; i++) {
            result[i] = []
        }

        for (let a = 0; a < this.dimension; a++) {
            for (let b = a + 1; b < this.dimension; b++) {
                const m = this.get(a, b)
                const [word0, word1] = CoxeterMatrix.#getAlternatingNumbers(a, b, m.num)
                result[a]?.push({ from: word0, to: word1 })
                result[b]?.push({ from: word1, to: word0 })
            }
        }

        return result
    }

    getSpaceType(): SpaceType {
        switch (this.dimension) {
            case 1: case 2:
                // 高次元と共通して扱う都合上、1次元も球面空間扱いにする
                return "spherical"
            case 3: {
                const discriminant = Fraction.sum(this.get(0, 1).recp(), this.get(1, 2).recp(), this.get(2, 0).recp()).sub(Fraction.one)
                const sign = discriminant.sign()
                if (sign == 0) {
                    return "euclidean"
                } else if (sign > 0) {
                    return "spherical"
                } else {
                    return "hyperbolic"
                }
            }
            default:
                return "unknown"
        }
    }

    static create2D(a: Fraction): CoxeterMatrix {
        return new CoxeterMatrix([a])
    }

    static create3D(p: Fraction, q: Fraction, r?: Fraction): CoxeterMatrix {
        return new CoxeterMatrix([p, r ?? Fraction.two, q])
    }

    static create4D(ab: Fraction, bc: Fraction, cd: Fraction, bd?: Fraction, ac?: Fraction, ad?: Fraction): CoxeterMatrix {
        return new CoxeterMatrix([ab, ac ?? Fraction.two, bc, ad ?? Fraction.two, bd ?? Fraction.two, cd])
    }

    static #getAlternatingNumbers(a: number, b: number, count: number): [number[], number[]] {
        const aRepr = new Array<number>(count)
        const bRepr = new Array<number>(count)
        for (let i = 0; i < count; i++) {
            if (i % 2 == 0) {
                aRepr[i] = a
                bRepr[i] = b
            } else {
                aRepr[i] = b
                bRepr[i] = a
            }
        }

        return [aRepr, bRepr]
    }
}
