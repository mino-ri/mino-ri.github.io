import { Fraction } from "./fraction.js";
import { CoxeterMatrix } from "./coxeter_matrix.js";
import { FiniteCoxeterGroup } from "./coxeter_group.js";
import { Vector, Vectors } from "./vector.js";
import { Quaternion, Quaternions } from "./quaternion.js";

export class SymmetryGroup3 {
    origin: Vector
    transforms: Quaternion[]
    constructor(
        // コクセター群 (3次元対称群に対応)
        public coxeterGroup: FiniteCoxeterGroup,
    ) {
        const cosP = Math.cos(Math.PI / coxeterGroup.matrix.get(0, 1).toNumber())
        const cosQ = Math.cos(Math.PI / coxeterGroup.matrix.get(1, 2).toNumber())
        const cos2P = cosP * cosP
        const cos2Q = cosQ * cosQ
        const z = Math.sqrt(1 - cos2P - cos2Q)
        const mirrors = [
            Quaternions.mirror([1, 0, 0]),
            Quaternions.mirror([-cosP, -cosQ, z]),
            Quaternions.mirror([0, 1, 0]),
        ]
        this.origin = Vectors.normalize([z, z, 1 + cosP + cosQ])
        this.transforms = new Array<Quaternion>(coxeterGroup.order)
        this.transforms[0] = Quaternions.identity

        for (const rank of coxeterGroup.ranks) {
            for (const element of rank) {
                const currentIndex = element.index
                for (let i = 0; i < element.neighbors.length; i++) {
                    const neighbor = element.neighbors[i]!
                    if (neighbor.index < currentIndex) {
                        this.transforms[currentIndex] = Quaternions.mul(this.transforms[neighbor.index]!, mirrors[i]!)
                        break
                    }
                }
            }
        }
    }
}

export type PolyhedronFace = {
    ColorIndex: number
    VertexIndexes: number[]
}

export class NormalPolyhedron {
    origin: Vector
    vertexes: Vector[]
    lineIndexes: [number, number][]
    faces: PolyhedronFace[]

    constructor(public symmetryGroup: SymmetryGroup3) {
        this.vertexes = new Array<Vector>(symmetryGroup.coxeterGroup.order)
        this.origin = symmetryGroup.origin
        for (let i = 0; i < symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(symmetryGroup.origin, symmetryGroup.transforms[i]!)
        }
        
        const lines: [number, number][] = []
        for (const element of symmetryGroup.coxeterGroup.elements) {
            const currentIndex = element.index
            for (const neighbor of element.neighbors) {
                if (neighbor.index > currentIndex) {
                    lines.push([currentIndex, neighbor.index])
                }
            }
        }

        const usedVertexSet = new Set<number>()
        const faces: PolyhedronFace[] = []
        for (let mirrorA = 0; mirrorA < 3; mirrorA++) {
            const mirrorB = (mirrorA + 1) % 3
            usedVertexSet.clear()
            for (const element of symmetryGroup.coxeterGroup.elements) {
                let currentIndex = element.index
                if (usedVertexSet.has(currentIndex)) {
                    continue
                }

                let targetElement = element
                const faceVertexIndexes = [currentIndex]
                usedVertexSet.add(currentIndex)
                while (true) {
                    targetElement = targetElement.neighbors[mirrorA]!
                    faceVertexIndexes.push(targetElement.index)
                    targetElement = targetElement.neighbors[mirrorB]!
                    if (targetElement.index === currentIndex) {
                        break
                    }
                    
                    faceVertexIndexes.push(targetElement.index)
                }

                faces.push({
                    ColorIndex: mirrorA,
                    VertexIndexes: faceVertexIndexes,
                })
            }
        }
        
        this.lineIndexes = lines
        this.faces = faces
    }

    setOrigin(newOrigin: Vector): void {
        this.origin = newOrigin
        for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(newOrigin, this.symmetryGroup.transforms[i]!)
        }
    }
}

window.addEventListener("load", () => {
    const matrix = CoxeterMatrix.create3D(new Fraction(3, 1), new Fraction(3, 1))
    const group = new FiniteCoxeterGroup(matrix)
    const symmetry = new SymmetryGroup3(group)
    const polyhedron = new NormalPolyhedron(symmetry)

    console.log(polyhedron.symmetryGroup.transforms.map((q) => `[${q.w}, ${q.x}, ${q.y}, ${q.z}]`).join("\n"))
    console.log(polyhedron.vertexes.map((vertex, index) => `v${index} = [${vertex[0]}, ${vertex[1]}, ${vertex[2]}]`).join("\n"))
    console.log(polyhedron.lineIndexes.map(([a, b]) => `line(v${a}, v${b})`).join("\n"))
})
