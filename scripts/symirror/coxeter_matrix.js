import { Fraction } from "./fraction.js";
export class CoxeterMatrix {
    values;
    dimension;
    constructor(values) {
        this.values = values;
        const length = this.values.length;
        this.dimension = Math.sqrt(2 * length + 0.25) + 0.5;
    }
    get(a, b) {
        if (a == b) {
            return Fraction.one;
        }
        const index = a > b
            ? a * (a - 1) / 2 + b
            : b * (b - 1) / 2 + a;
        return this.values[index] ?? Fraction.one;
    }
    getExchanges() {
        const result = new Array(3);
        for (let i = 0; i < this.dimension; i++) {
            result[i] = [];
        }
        for (let a = 0; a < this.dimension; a++) {
            for (let b = a + 1; b < this.dimension; b++) {
                const m = this.get(a, b);
                const [word0, word1] = CoxeterMatrix.#getAlternatingNumbers(a, b, m.num);
                result[a]?.push({ from: word0, to: word1 });
                result[b]?.push({ from: word1, to: word0 });
            }
        }
        return result;
    }
    getSpaceType() {
        switch (this.dimension) {
            case 1:
            case 2:
                return "spherical";
            case 3: {
                const discriminant = Fraction.sum(this.get(0, 1).recp(), this.get(1, 2).recp(), this.get(2, 0).recp()).sub(Fraction.one);
                const sign = discriminant.sign();
                if (sign == 0) {
                    return "euclidean";
                }
                else if (sign > 0) {
                    return "spherical";
                }
                else {
                    return "hyperbolic";
                }
            }
            default:
                return "unknown";
        }
    }
    static create2D(a) {
        return new CoxeterMatrix([a]);
    }
    static create3D(p, q, r) {
        return new CoxeterMatrix([p, r ?? Fraction.two, q]);
    }
    static create4D(ab, bc, cd, bd, ac, ad) {
        return new CoxeterMatrix([ab, ac ?? Fraction.two, bc, ad ?? Fraction.two, bd ?? Fraction.two, cd]);
    }
    static #getAlternatingNumbers(a, b, count) {
        const aRepr = new Array(count);
        const bRepr = new Array(count);
        for (let i = 0; i < count; i++) {
            if (i % 2 == 0) {
                aRepr[i] = a;
                bRepr[i] = b;
            }
            else {
                aRepr[i] = b;
                bRepr[i] = a;
            }
        }
        return [aRepr, bRepr];
    }
}
