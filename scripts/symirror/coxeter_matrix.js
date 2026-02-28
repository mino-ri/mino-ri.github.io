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
            return 1;
        }
        const index = a > b
            ? a * (a - 1) / 2 + b
            : b * (b - 1) / 2 + a;
        return this.values[index] ?? 1;
    }
    getExchanges() {
        const result = new Array(3);
        for (let i = 0; i < this.dimension; i++) {
            result[i] = [];
        }
        for (let a = 0; a < this.dimension; a++) {
            for (let b = a + 1; b < this.dimension; b++) {
                const [word0, word1] = CoxeterMatrix.#getAlternatingNumbers(a, b, this.get(a, b));
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
                const discriminant = 1 / this.get(0, 1) + 1 / this.get(1, 2) + 1 / this.get(2, 0);
                if (discriminant == 1) {
                    return "euclidean";
                }
                else if (discriminant > 1) {
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
    static create3D(p, q) {
        return new CoxeterMatrix([p, 2, q]);
    }
    static create4D(a, b, c) {
        return new CoxeterMatrix([a, 2, b, 2, 2, c]);
    }
    static create4DDemicube(a, b, c) {
        return new CoxeterMatrix([a, 2, b, 2, c, 2]);
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
