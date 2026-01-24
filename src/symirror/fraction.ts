export class Fraction {
    static readonly zero = new Fraction(0, 1)
    static readonly one = new Fraction(1, 1)
    static readonly two = new Fraction(2, 1)
    static readonly infinity = new Fraction(1, 0)
    readonly num: number
    readonly denom: number

    constructor(num: number, denom: number) {
        if (denom === 0) {
            // 無限を表現する値
            this.num = num === 0 ? 0 : 1
            this.denom = 0
            return
        } else if (num === 0) {
            // 無限を表現する値
            this.num = 0
            this.denom = 1
            return
        }

        const sign = Math.sign(num) * Math.sign(denom)
        const gcd = Fraction.#gcd(Math.abs(num), Math.abs(denom))
        this.num = Math.abs(num) / gcd * sign
        this.denom = Math.abs(denom) / gcd
    }

    toNumber(): number {
        return this.num / this.denom
    }

    toString(): string {
        switch (this.denom) {
            case 0:
                return this.num === 0 ? "⊥" : "∞"
            case 1:
                return `${this.num}`
            default:
                return `${this.num}/${this.denom}`
        }
    }

    static sum(...args: Fraction[]): Fraction {
        let result = Fraction.zero
        for (const f of args) {
            result = result.add(f)
        }
        return result
    }

    add(b: Fraction): Fraction {
        return new Fraction(this.num * b.denom + b.num * this.denom, this.denom * b.denom)
    }

    sub(b: Fraction): Fraction {
        return new Fraction(this.num * b.denom - b.num * this.denom, this.denom * b.denom)
    }

    mul(b: Fraction): Fraction {
        return new Fraction(this.num * b.num, this.denom * b.denom)
    }

    div(b: Fraction): Fraction {
        return new Fraction(this.num * b.denom, this.denom * b.num)
    }

    recp(): Fraction {
        return new Fraction(this.denom, this.num)
    }

    sign(): number {
        return Math.sign(this.num)
    }

    static #gcd(x: number, y: number): number {
        if (x == 0) return y
        if (y == 0) return x

        while (true) {
            if (x >= y) {
                x %= y
                if (x == 0) return y
            } else {
                y %= x
                if (y == 0) return x
            }
        }
    }
}
