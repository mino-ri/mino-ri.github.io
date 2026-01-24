export class Fraction {
    static zero = new Fraction(0, 1);
    static one = new Fraction(1, 1);
    static two = new Fraction(2, 1);
    static infinity = new Fraction(1, 0);
    num;
    denom;
    constructor(num, denom) {
        if (denom === 0) {
            this.num = num === 0 ? 0 : 1;
            this.denom = 0;
            return;
        }
        else if (num === 0) {
            this.num = 0;
            this.denom = 1;
            return;
        }
        const sign = Math.sign(num) * Math.sign(denom);
        const gcd = Fraction.#gcd(Math.abs(num), Math.abs(denom));
        this.num = Math.abs(num) / gcd * sign;
        this.denom = Math.abs(denom) / gcd;
    }
    toNumber() {
        return this.num / this.denom;
    }
    toString() {
        switch (this.denom) {
            case 0:
                return this.num === 0 ? "⊥" : "∞";
            case 1:
                return `${this.num}`;
            default:
                return `${this.num}/${this.denom}`;
        }
    }
    static sum(...args) {
        let result = Fraction.zero;
        for (const f of args) {
            result = result.add(f);
        }
        return result;
    }
    add(b) {
        return new Fraction(this.num * b.denom + b.num * this.denom, this.denom * b.denom);
    }
    sub(b) {
        return new Fraction(this.num * b.denom - b.num * this.denom, this.denom * b.denom);
    }
    mul(b) {
        return new Fraction(this.num * b.num, this.denom * b.denom);
    }
    div(b) {
        return new Fraction(this.num * b.denom, this.denom * b.num);
    }
    recp() {
        return new Fraction(this.denom, this.num);
    }
    sign() {
        return Math.sign(this.num);
    }
    static #gcd(x, y) {
        if (x == 0)
            return y;
        if (y == 0)
            return x;
        while (true) {
            if (x >= y) {
                x %= y;
                if (x == 0)
                    return y;
            }
            else {
                y %= x;
                if (y == 0)
                    return x;
            }
        }
    }
}
