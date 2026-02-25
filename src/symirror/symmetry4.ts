import { FiniteCoxeterGroup, CoxeterGroupElement } from "./coxeter_group.js";
import { QuaternionPair, QuaternionPairs } from "./quaternion_pair.js";

export type UnitTetrahedron = {
    symmetryGroup: SymmetryGroup4
    generators: CoxeterGroupElement[]
}

export class SymmetryGroup4 {
    transforms: QuaternionPair[]
    #coxeterGroup: FiniteCoxeterGroup
    constructor(
        // コクセター群 (4次元対称群に対応)
        coxeterGroup: FiniteCoxeterGroup,
    ) {
        this.#coxeterGroup = coxeterGroup
        const thetaP = Math.PI / coxeterGroup.matrix.get(0, 1)
        const thetaQ = Math.PI / coxeterGroup.matrix.get(1, 2)
        const cosP = Math.cos(thetaP)
        const cosQ = Math.cos(thetaQ)
        const s = coxeterGroup.matrix.get(1, 3)
        const mirrors = [
            QuaternionPairs.mirror([1, 0, 0, 0]),
            null!,
            null!,
            QuaternionPairs.mirror([0, 1, 0, 0]),
        ]
        if (s >= 3) {
            // この状況では入力制限により R = 2 が確定
            const cosS = Math.cos(Math.PI / s)
            const ws = 1 - cosP * cosP - cosQ * cosQ - cosS * cosS
            // if (ws <= 0.0001) ありえない入力
            const w = Math.sqrt(ws)
            mirrors[1] = QuaternionPairs.mirror([-cosP, -cosS, -cosQ, w])
            mirrors[2] = QuaternionPairs.mirror([0, 0, 1, 0])
        } else {
            const thetaR = Math.PI / coxeterGroup.matrix.get(2, 3)
            const sinP = Math.sin(thetaP)
            const sinR = Math.sin(thetaR)
            const cosR = Math.cos(thetaR)
            const z = (1 - cosQ / sinP / sinR) / 2
            // if (z <= 0.0001) ありえない入力
            const cosZ = Math.sqrt(z)
            const sinZ = Math.sqrt(1 - z)
            mirrors[1] = QuaternionPairs.mirror([-cosP, 0, sinP * sinZ, sinP * cosZ])
            mirrors[2] = QuaternionPairs.mirror([0, -cosR, -sinR * sinZ, sinR * cosZ])
        }

        this.transforms = new Array<QuaternionPair>(coxeterGroup.order)
        this.transforms[0] = QuaternionPairs.identity

        for (const rank of coxeterGroup.ranks) {
            for (const element of rank) {
                const currentIndex = element.index
                for (let i = 0; i < element.neighbors.length; i++) {
                    const neighbor = element.neighbors[i]!
                    if (neighbor.index < currentIndex) {
                        this.transforms[currentIndex] = QuaternionPairs.mul(this.transforms[neighbor.index]!, mirrors[i]!)
                        break
                    }
                }
            }
        }
    }

    get order(): number {
        return this.#coxeterGroup.order
    }

    getElement(index: number): CoxeterGroupElement {
        return this.#coxeterGroup.elements[index]!
    }

    getMaxElement(): CoxeterGroupElement {
        return this.#coxeterGroup.ranks[this.#coxeterGroup.ranks.length - 1]![0]!
    }

    getDefaultGenerators(): UnitTetrahedron {
        return this.getGenerators(4, 3, 2, 1)
    }

    getGenerators(a: number, b: number, c: number, d: number): UnitTetrahedron {
        return {
            symmetryGroup: this,
            generators: [
                this.#coxeterGroup.elements[a]!,
                this.#coxeterGroup.elements[b]!,
                this.#coxeterGroup.elements[c]!,
                this.#coxeterGroup.elements[d]!,
            ]
        }
    }
}
