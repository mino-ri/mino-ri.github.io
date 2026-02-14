export class Vectors {
    static dot(a, b) {
        let result = 0;
        const length = Math.min(a.length, b.length);
        for (let i = 0; i < length; i++) {
            result += a[i] * b[i];
        }
        return result;
    }
    static cross(a, b, resultTo) {
        if (a.length < 3 || b.length < 3 || resultTo.length < 3) {
            throw new Error('Vectors must have at least 3 dimensions for cross product.');
        }
        const c0 = a[1] * b[2] - a[2] * b[1];
        const c1 = a[2] * b[0] - a[0] * b[2];
        const c2 = a[0] * b[1] - a[1] * b[0];
        resultTo[0] = c0;
        resultTo[1] = c1;
        resultTo[2] = c2;
    }
    static copy(from, to) {
        const length = Math.min(from.length, to.length);
        for (let i = 0; i < length; i++) {
            to[i] = from[i];
        }
        return to;
    }
    static mul(a, s, resultTo) {
        const result = resultTo ?? new Array(a.length);
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i] * s;
        }
        return result;
    }
    static div(a, s, resultTo) {
        const result = resultTo ?? new Array(a.length);
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i] / s;
        }
        return result;
    }
    static add(a, b, resultTo) {
        const length = Math.min(a.length, b.length);
        const result = resultTo ?? new Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = a[i] + b[i];
        }
        return result;
    }
    static sub(a, b, resultTo) {
        const length = Math.min(a.length, b.length);
        const result = resultTo ?? new Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = a[i] - b[i];
        }
        return result;
    }
    static normalize(v, resultTo) {
        if (resultTo === undefined) {
            return Vectors.mul(v, 1 / Math.sqrt(Vectors.dot(v, v)));
        }
        else {
            return Vectors.mul(v, 1 / Math.sqrt(Vectors.dot(v, v)), resultTo);
        }
    }
    static negateSelf(v) {
        for (let i = 0; i < v.length; i++) {
            v[i] = -v[i];
        }
    }
    static normalizeSelf(v) {
        const factor = 1 / Math.sqrt(Vectors.dot(v, v));
        for (let i = 0; i < v.length; i++) {
            v[i] *= factor;
        }
    }
    static distanceSquared(a, b) {
        const length = Math.min(a.length, b.length);
        let sum = 0;
        for (let i = 0; i < length; i++) {
            const d = a[i] - b[i];
            sum += d * d;
        }
        return sum;
    }
    static lengthSquared(a) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            const d = a[i];
            sum += d * d;
        }
        return sum;
    }
    static middleDistanceSquared(a, b, p) {
        const length = Math.min(a.length, b.length);
        let sum = 0;
        for (let i = 0; i < length; i++) {
            const d = (a[i] + b[i]) * 0.5 - p[i];
            sum += d * d;
        }
        return sum;
    }
    static #u = [0, 0, 0];
    static #v = [0, 0, 0];
    static #w = [0, 0, 0];
    static #epsilon = 1e-6;
    static hasIntersection(a, b, c, d) {
        Vectors.sub(b, a, Vectors.#u);
        Vectors.sub(d, c, Vectors.#v);
        Vectors.sub(a, c, Vectors.#w);
        const nrm2U = Vectors.dot(Vectors.#u, Vectors.#u);
        const dotUv = Vectors.dot(Vectors.#u, Vectors.#v);
        const nrm2V = Vectors.dot(Vectors.#v, Vectors.#v);
        const dotUw = Vectors.dot(Vectors.#u, Vectors.#w);
        const dotVw = Vectors.dot(Vectors.#v, Vectors.#w);
        const delta = nrm2U * nrm2V - dotUv * dotUv;
        if (Math.abs(delta) < Vectors.#epsilon) {
            const nrm2W = Vectors.dot(Vectors.#w, Vectors.#w);
            return nrm2U * nrm2W - dotUw * dotUw < Vectors.#epsilon;
        }
        const s = (dotUv * dotVw - nrm2V * dotUw) / delta;
        const t = (nrm2U * dotVw - dotUv * dotUw) / delta;
        return 0 <= s && s <= 1 && 0 <= t && t <= 1;
    }
    static getCrossPoint(a, b, c, d, resultTo) {
        Vectors.sub(b, a, Vectors.#u);
        Vectors.sub(d, c, Vectors.#v);
        Vectors.sub(a, c, Vectors.#w);
        const nrm2U = Vectors.dot(Vectors.#u, Vectors.#u);
        const dotUv = Vectors.dot(Vectors.#u, Vectors.#v);
        const nrm2V = Vectors.dot(Vectors.#v, Vectors.#v);
        const dotUw = Vectors.dot(Vectors.#u, Vectors.#w);
        const dotVw = Vectors.dot(Vectors.#v, Vectors.#w);
        const delta = nrm2U * nrm2V - dotUv * dotUv;
        if (Math.abs(delta) < Vectors.#epsilon) {
            return null;
        }
        const s = (dotUv * dotVw - nrm2V * dotUw) / delta;
        const t = (nrm2U * dotVw - dotUv * dotUw) / delta;
        if (s < 0 || s > 1 || t < 0 || t > 1) {
            return null;
        }
        Vectors.mul(Vectors.#u, s, Vectors.#u);
        Vectors.add(Vectors.#u, a, Vectors.#u);
        Vectors.mul(Vectors.#v, t, Vectors.#v);
        Vectors.add(Vectors.#v, c, Vectors.#v);
        Vectors.add(Vectors.#u, Vectors.#v, resultTo);
        Vectors.mul(resultTo, 0.5, resultTo);
        return Vectors.distanceSquared(Vectors.#u, Vectors.#v) < 1e-6 ? resultTo : null;
    }
    static average(vectors, resultTo) {
        for (let i = 0; i < resultTo.length; i++) {
            resultTo[i] = 0;
        }
        if (vectors.length === 0) {
            return resultTo;
        }
        for (const vector of vectors) {
            Vectors.add(resultTo, vector, resultTo);
        }
        return Vectors.div(resultTo, vectors.length, resultTo);
    }
}
