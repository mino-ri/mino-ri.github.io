export class Monzo {
    static #primes = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29,
        31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79, 83, 89, 97,
    ]
    static one = new Monzo(new Map())
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
        const pitch = this.pitch
        return pitch - Math.floor(pitch)
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

    get maxPrime() {
        let maxPrime = 1
        for (const [prime, factor] of this.factors) {
            if (factor !== 0 && prime > maxPrime) {
                maxPrime = prime
            }
        }

        return maxPrime
    }

    toPitchClassMonzo() {
        const power = Math.floor(Math.log2(this.value))
        return Monzo.divide(this, Monzo.from2Factor(power))
    }

    quantizedValue(edo: number) {
        return edo < 1 ? this.value : Math.pow(2, this.quantizedPitch(edo))
    }

    quantizedPitch(edo: number) {
        if (edo < 1) {
            return this.pitch
        }
        
        return this.quantizedStepCount(edo) / edo
    }

    quantizedStepCount(edo: number) {
        if (edo < 1) {
            return 0
        }
        
        let result = 0
        for (const [prime, factor] of this.factors) {
            result += Math.round(Math.log2(prime) * edo) * factor
        }
        return result
    }


    quantizedPitchClass(edo: number) {
        if (edo < 1) {
            return this.pitchClass
        }
        
        let result = 0
        for (const [prime, factor] of this.factors) {
            result += Math.round(Math.log2(prime) * edo) * factor
        }
        return ((result % edo + edo) % edo) / edo
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

    static getShasavicOctaveFactor(monzo: Monzo) {
        let power2 = 0
        for (const [prime, factor] of monzo.factors) {
            if (Math.round(prime) === 3) {
                power2 += factor
            } else if (prime !== 2) {
                power2 += factor * 2
            }
        }
        return power2
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
