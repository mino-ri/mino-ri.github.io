export class Monzo {
    static #primes = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29,
        31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79, 83, 89, 97,
    ]
    factors: Map<number, number>

    constructor(factors: Map<number, number>) {
        // 素数:累乗数のマップを保持
        this.factors = factors
    }

    // このオブジェクトが表す整数値を返す
    get value() {
        let value = 1
        for (const [prime, factor] of this.factors) {
            value *= Math.pow(prime, factor)
        }
        return value
    }

    get pitchDistance() {
        let distance = 0
        for (const [_, factor] of this.factors) {
            distance += Math.abs(factor)
        }
        return distance
    }

    get isOnly2() {
        return this.factors.size === 1 && this.factors.has(2)
    }

    get pitch() {
        return Math.log2(this.value)
    }

    get pitchClass() {
        return this.pitch % 1
    }

    get minPrime() {
        let minPrime = Infinity
        for (const [prime, factor] of this.factors) {
            if (factor !== 0 && prime < minPrime) {
                minPrime = prime
            }
        }

        return minPrime === Infinity ? 1 : minPrime
    }

    reciprocal() {
        const factors = new Map<number, number>()
        for (const [prime, factor] of this.factors) {
            factors.set(prime, -factor)
        }

        return new Monzo(factors)
    }

    toString() {
        let result = ''
        for (const [prime, factor] of this.factors) {
            if (factor > 0) {
                result += `${prime}^${factor} `
            } else if (factor < 0) {
                result += `${prime}^(${-factor}) `
            }
        }
        return result.trim()
    }

    static fromInt(value: number) {
        const factors = new Map<number, number>()
        let n = value
        for (const i of Monzo.#primes) {
            while (i <= n && n % i === 0) {
                factors.set(i, (factors.get(i) ?? 0) + 1)
                n /= i

                if (n <= 1) {
                    return new Monzo(factors)
                }
            }
        }

        for (let i = 101; i <= n; i++) {
            while (i <= n && n % i === 0) {
                factors.set(i, (factors.get(i) ?? 0) + 1)
                n /= i

                if (n <= 1) {
                    return new Monzo(factors)
                }
            }
        }
        return new Monzo(factors)
    }

    static fromFraction(numerator: number, denominator: number) {
        return Monzo.divide(
            Monzo.fromInt(numerator),
            Monzo.fromInt(denominator)
        )
    }

    static multiply(a: Monzo, b: Monzo) {
        const factors = new Map<number, number>()
        for (const [prime, factor] of a.factors) {
            factors.set(prime, factor)
        }
        for (const [prime, factor] of b.factors) {
            const newFactor = (factors.get(prime) ?? 0) + factor
            if (newFactor === 0) {
                factors.delete(prime)
            } else {
                factors.set(prime, newFactor)
            }
        }
        return new Monzo(factors)
    }

    static divide(a: Monzo, b: Monzo) {
        return Monzo.multiply(a, b.reciprocal())
    }

    static getOctaveFactor(monzo: Monzo) {
        let power2 = 0
        for (const [prime, factor] of monzo.factors) {
            if (prime !== 2) {
                power2 += Math.floor(Math.log2(prime)) * factor
            }
        }
        return power2
    }

    static from2Factor(factor: number): Monzo {
        return new Monzo(new Map([[2, factor]]))
    }

    static toOctaveReduced(monzo: Monzo) {
        let power2 = Monzo.getOctaveFactor(monzo)
        return power2 === 0 ? monzo : Monzo.multiply(monzo, Monzo.from2Factor(power2))
    }

    static fromOctaveReduced(monzo: Monzo) {
        let power2 = Monzo.getOctaveFactor(monzo)
        return power2 === 0 ? monzo : Monzo.divide(monzo, Monzo.from2Factor(power2))
    }

    static getShasavicOctaveFactor(monzo: Monzo) {
        let power2 = 0
        for (const [prime, factor] of monzo.factors) {
            if (prime === 3) {
                power2 += factor
            } else if (prime !== 2) {
                power2 += factor * 2
            }
        }
        return power2
    }

    static toShasavic(monzo: Monzo) {
        let power2 = Monzo.getShasavicOctaveFactor(monzo)
        return power2 === 0 ? monzo : Monzo.multiply(monzo, Monzo.from2Factor(power2))
    }

    static fromShasavic(monzo: Monzo) {
        let power2 = Monzo.getShasavicOctaveFactor(monzo)
        return power2 === 0 ? monzo : Monzo.divide(monzo, Monzo.from2Factor(power2))
    }

    // テキストからMonzoの配列を取得する
    static parseMonzos(text: string) {
        // スペース区切りで分割
        const tokens = text.trim().split(/\s+/)
        const monzos = tokens.map(token => {
            if (token.includes('/')) {
                // 分数の場合
                const [num, denom] = token.split('/').map(Number)
                return Monzo.fromFraction(num ?? 1, denom ?? 1)
            } else {
                // 整数の場合
                return Monzo.fromInt(Number(token))
            }
        })
        return monzos
    }
}
