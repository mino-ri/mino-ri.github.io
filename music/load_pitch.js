class Monzo {
    static #primes = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29,
        31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79, 83, 89, 97,
    ]

    constructor(factors) {
        // 素数:累乗数のマップを保持
        this.factors = factors
    }

    // このオブジェクトが表す整数値を返す
    get value() {
        let value = 1
        for (const prime in this.factors) {
            value *= Math.pow(Number(prime), this.factors[prime])
        }
        return value
    }

    get pitchDistance() {
        let distance = 0
        for (const prime in this.factors) {
            distance += Math.abs(this.factors[prime])
        }
        return distance
    }

    get isOnly2() {
        return Object.keys(this.factors).length === 1 && this.factors[2] !== undefined
    }

    get pitch() {
        return Math.log2(this.value)
    }

    get pitchClass() {
        return this.pitch % 1
    }

    get minPrime() {
        let minPrime = 999999999
        for (const prime in this.factors) {
            const numPrime = Number(prime)
            if (this.factors[prime] !== 0 && numPrime < minPrime) {
                minPrime = numPrime
            }
        }
        
        return minPrime === Infinity ? 1 : minPrime
    }

    reciprocal() {
        const factors = {}
        for (const prime in this.factors) {
            factors[prime] = -this.factors[prime]
        }

        return new Monzo(factors)
    }

    toString() {
        let result = ''
        for (const prime in this.factors) {
            if (this.factors[prime] > 0) {
                result += `${prime}^${this.factors[prime]} `
            } else if (this.factors[prime] < 0) {
                result += `${prime}^(${-this.factors[prime]}) `
            }
        }
        return result.trim()
    }

    static fromInt(value) {
        const factors = {}
        let n = value
        for (const i of Monzo.#primes) {
            while (i <= n && n % i === 0) {
                if (!factors[i]) {
                    factors[i] = 0
                }
                factors[i]++
                n /= i

                if (n <= 1) {
                    return new Monzo(factors)
                }
            }
        }

        for (let i = 101; i <= n; i++) {
            while (i <= n && n % i === 0) {
                if (!factors[i]) {
                    factors[i] = 0
                }
                factors[i]++
                n /= i
                if (n <= 1) {
                    return new Monzo(factors)
                }
            }
        }
        return new Monzo(factors)
    }

    static fromFraction(numerator, denominator) {
        return Monzo.divide(
            Monzo.fromInt(numerator),
            Monzo.fromInt(denominator)
        )
    }

    static multiply(a, b) {
        if (!(a instanceof Monzo) || !(b instanceof Monzo)) {
            throw new Error("Both arguments must be instances of Monzo.")
        }

        const factors = {}
        for (const prime in a.factors) {
            factors[prime] = a.factors[prime]
        }
        for (const prime in b.factors) {
            factors[prime] = (factors[prime] || 0) + b.factors[prime]
            if (factors[prime] === 0) {
                delete factors[prime]
            }
        }
        return new Monzo(factors)
    }

    static divide(a, b) {
        return Monzo.multiply(a, b.reciprocal())
    }

    // テキストからMonzoの配列を取得する
    static parseMonzos(text) {
        // スペース区切りで分割
        const tokens = text.trim().split(/\s+/)
        const monzos = tokens.map(token => {
            if (token.includes('/')) {
                // 分数の場合
                const [num, denom] = token.split('/').map(Number)
                return Monzo.fromFraction(num, denom)
            } else {
                // 整数の場合
                return Monzo.fromInt(Number(token))
            }
        })
        return monzos
    }
}
