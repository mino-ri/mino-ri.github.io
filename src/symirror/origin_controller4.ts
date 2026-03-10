import { Polychoron } from "./polychoron.js"
import { QuaternionPairs } from "./quaternion_pair.js"
import { Vectors, type Vector } from "./vector.js"

// origin 操作コントローラ
export class OriginController {
    #specialPoints: Vector[] = [
        [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1],
        [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1],
        [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1],
        [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1],
    ]
    #currentPoint: Vector = [0, 0, 0, 1]
    #targetPoint: Vector | null = null
    #onOriginChange: (origin: Vector) => void

    constructor(
        onOriginChange: (origin: Vector) => void,
    ) {
        this.#onOriginChange = onOriginChange
    }

    applyAutoOriginMovement(deltaTime: number) {
        if (!this.#targetPoint) return

        const anglePerSec = Math.PI * 0.25
        const deltaAngle = anglePerSec * deltaTime
        const deltaCos = Math.cos(deltaAngle)
        const cos = Vectors.dot(this.#targetPoint, this.#currentPoint)
        if (deltaCos <= cos) {
            Vectors.copy(this.#targetPoint, this.#currentPoint)
            this.#onOriginChange(this.#currentPoint)
            this.#targetPoint = null
            return
        }

        const deltaSin = Math.sin(deltaAngle)
        const subSin = Math.sin(Math.acos(cos) - deltaAngle)
        for (let i = 0; i < 4; i++) {
            this.#currentPoint[i] = this.#currentPoint[i]! * subSin + this.#targetPoint[i]! * deltaSin
        }

        Vectors.normalizeSelf(this.#currentPoint)
        this.#onOriginChange(this.#currentPoint)
    }

    setPolychoron(polychoron: Polychoron): void {
        const mirror1 = QuaternionPairs.mirrorNormal(polychoron.symmetryGroup.transforms[1]!)
        const mirror2 = QuaternionPairs.mirrorNormal(polychoron.symmetryGroup.transforms[2]!)
        const mirror3 = QuaternionPairs.mirrorNormal(polychoron.symmetryGroup.transforms[3]!)
        const mirror4 = QuaternionPairs.mirrorNormal(polychoron.symmetryGroup.transforms[4]!)
        const inter12 = Vectors.sub(mirror1, mirror2)
        const inter13 = Vectors.sub(mirror1, mirror3)
        const inter14 = Vectors.sub(mirror1, mirror4)
        const inter23 = Vectors.sub(mirror2, mirror3)
        const inter24 = Vectors.sub(mirror2, mirror4)
        const inter34 = Vectors.sub(mirror3, mirror4)
        Vectors.normalizeSelf(inter12)
        Vectors.normalizeSelf(inter13)
        Vectors.normalizeSelf(inter14)
        Vectors.normalizeSelf(inter23)
        Vectors.normalizeSelf(inter24)
        Vectors.normalizeSelf(inter34)

        // Vertex
        Vectors.cross4(mirror2, mirror3, mirror4, this.#specialPoints[0b0001])
        Vectors.cross4(mirror1, mirror3, mirror4, this.#specialPoints[0b0010])
        Vectors.cross4(mirror1, mirror2, mirror4, this.#specialPoints[0b0100])
        Vectors.cross4(mirror1, mirror2, mirror3, this.#specialPoints[0b1000])

        // Edge
        Vectors.cross4(mirror1, mirror2, inter34, this.#specialPoints[0b1100])
        Vectors.cross4(mirror1, mirror3, inter24, this.#specialPoints[0b1010])
        Vectors.cross4(mirror1, mirror4, inter23, this.#specialPoints[0b0110])
        Vectors.cross4(mirror2, mirror3, inter14, this.#specialPoints[0b1001])
        Vectors.cross4(mirror2, mirror4, inter13, this.#specialPoints[0b0101])
        Vectors.cross4(mirror3, mirror4, inter12, this.#specialPoints[0b0011])

        // Face
        Vectors.cross4(mirror1, inter23, inter34, this.#specialPoints[0b1110])
        Vectors.cross4(mirror2, inter13, inter34, this.#specialPoints[0b1101])
        Vectors.cross4(mirror3, inter12, inter24, this.#specialPoints[0b1011])
        Vectors.cross4(mirror4, inter12, inter23, this.#specialPoints[0b0111])

        // Cell
        Vectors.cross4(inter12, inter23, inter34, this.#specialPoints[0b1111])

        for (const p of this.#specialPoints) {
            Vectors.normalizeSelf(p)
            if (p[3]! < 0) {
                Vectors.negateSelf(p)
            }
        }
    }

    setOriginPoint(index: number): void {
        this.#targetPoint = this.#specialPoints[index]!
    }

    reset(): void {
        this.#currentPoint[0] = 0
        this.#currentPoint[1] = 0
        this.#currentPoint[2] = 0
        this.#currentPoint[3] = 1
        this.#targetPoint = null
        this.#onOriginChange(this.#currentPoint)
    }
}
