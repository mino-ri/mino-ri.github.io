import { QuaternionPairs } from "./quaternion_pair.js";
export class SymmetryGroup4 {
    transforms;
    #coxeterGroup;
    constructor(coxeterGroup) {
        this.#coxeterGroup = coxeterGroup;
        const thetaP = Math.PI / coxeterGroup.matrix.get(0, 1);
        const thetaQ = Math.PI / coxeterGroup.matrix.get(1, 2);
        const cosP = Math.cos(thetaP);
        const cosQ = Math.cos(thetaQ);
        const s = coxeterGroup.matrix.get(1, 3);
        const mirrors = [
            QuaternionPairs.mirror([1, 0, 0, 0]),
            null,
            null,
            QuaternionPairs.mirror([0, 1, 0, 0]),
        ];
        if (s >= 3) {
            const cosS = Math.cos(Math.PI / s);
            const ws = 1 - cosP * cosP - cosQ * cosQ - cosS * cosS;
            const w = Math.sqrt(ws);
            mirrors[1] = QuaternionPairs.mirror([-cosP, -cosS, -cosQ, w]);
            mirrors[2] = QuaternionPairs.mirror([0, 0, 1, 0]);
        }
        else {
            const thetaR = Math.PI / coxeterGroup.matrix.get(2, 3);
            const sinP = Math.sin(thetaP);
            const sinR = Math.sin(thetaR);
            const cosR = Math.cos(thetaR);
            const z = (1 - cosQ / sinP / sinR) / 2;
            const cosZ = Math.sqrt(z);
            const sinZ = Math.sqrt(1 - z);
            mirrors[1] = QuaternionPairs.mirror([-cosP, 0, sinP * sinZ, sinP * cosZ]);
            mirrors[2] = QuaternionPairs.mirror([0, -cosR, -sinR * sinZ, sinR * cosZ]);
        }
        this.transforms = new Array(coxeterGroup.order);
        this.transforms[0] = QuaternionPairs.identity;
        for (const rank of coxeterGroup.ranks) {
            for (const element of rank) {
                const currentIndex = element.index;
                for (let i = 0; i < element.neighbors.length; i++) {
                    const neighbor = element.neighbors[i];
                    if (neighbor.index < currentIndex) {
                        this.transforms[currentIndex] = QuaternionPairs.mul(this.transforms[neighbor.index], mirrors[i]);
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
        return this.getGenerators(4, 3, 2, 1);
    }
    getGenerators(a, b, c, d) {
        return {
            symmetryGroup: this,
            generators: [
                this.#coxeterGroup.elements[a],
                this.#coxeterGroup.elements[b],
                this.#coxeterGroup.elements[c],
                this.#coxeterGroup.elements[d],
            ]
        };
    }
}
