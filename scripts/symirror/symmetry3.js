import { Vectors } from "./vector.js";
import { Quaternions } from "./quaternion.js";
export class SymmetryGroup3 {
    transforms;
    #coxeterGroup;
    constructor(coxeterGroup) {
        this.#coxeterGroup = coxeterGroup;
        const cosP = Math.cos(Math.PI / coxeterGroup.matrix.get(0, 1));
        const cosQ = Math.cos(Math.PI / coxeterGroup.matrix.get(1, 2));
        const cos2P = cosP * cosP;
        const cos2Q = cosQ * cosQ;
        const z = Math.sqrt(1 - cos2P - cos2Q);
        const mirrors = [
            Quaternions.mirror([1, 0, 0]),
            Quaternions.mirror([-cosP, -cosQ, z]),
            Quaternions.mirror([0, 1, 0]),
        ];
        this.transforms = new Array(coxeterGroup.order);
        this.transforms[0] = Quaternions.identity;
        for (const rank of coxeterGroup.ranks) {
            for (const element of rank) {
                const currentIndex = element.index;
                for (let i = 0; i < element.neighbors.length; i++) {
                    const neighbor = element.neighbors[i];
                    if (neighbor.index < currentIndex) {
                        this.transforms[currentIndex] = Quaternions.mul(this.transforms[neighbor.index], mirrors[i]);
                        break;
                    }
                }
            }
        }
    }
    get order() {
        return this.#coxeterGroup.order;
    }
    getElement(index) {
        return this.#coxeterGroup.elements[index];
    }
    getMaxElement() {
        return this.#coxeterGroup.ranks[this.#coxeterGroup.ranks.length - 1][0];
    }
    getDefaultGenerators() {
        return this.getGenerators(3, 2, 1);
    }
    getGenerators(a, b, c) {
        return {
            symmetryGroup: this,
            generators: [
                this.#coxeterGroup.elements[a],
                this.#coxeterGroup.elements[b],
                this.#coxeterGroup.elements[c],
            ]
        };
    }
    #getMirrorCross(index) {
        const a = this.transforms[index % 3 + 1];
        const b = this.transforms[(index + 1) % 3 + 1];
        const v = [
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x,
        ];
        Vectors.normalizeSelf(v);
        return v;
    }
    getMirrorRotator(fromIndex, toIndex) {
        const fromVector = this.#getMirrorCross(fromIndex);
        const toVector = this.#getMirrorCross(toIndex);
        return Quaternions.fromTo(fromVector, toVector);
    }
    getTransforms(indexes, preTransform) {
        if (preTransform) {
            return indexes.map(i => Quaternions.mul(this.transforms[i], preTransform));
        }
        return indexes.map(i => this.transforms[i]);
    }
}
