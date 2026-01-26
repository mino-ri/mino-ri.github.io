import { Fraction } from "./fraction.js";
import { CoxeterMatrix } from "./coxeter_matrix.js";
import { FiniteCoxeterGroup } from "./coxeter_group.js";
import { Vectors } from "./vector.js";
import { Quaternions } from "./quaternion.js";
export class SymmetryGroup3 {
    coxeterGroup;
    origin;
    transforms;
    constructor(coxeterGroup) {
        this.coxeterGroup = coxeterGroup;
        const cosP = Math.cos(Math.PI / coxeterGroup.matrix.get(0, 1).toNumber());
        const cosQ = Math.cos(Math.PI / coxeterGroup.matrix.get(1, 2).toNumber());
        const cos2P = cosP * cosP;
        const cos2Q = cosQ * cosQ;
        const z = Math.sqrt(1 - cos2P - cos2Q);
        const mirrors = [
            Quaternions.mirror([1, 0, 0]),
            Quaternions.mirror([-cosP, -cosQ, z]),
            Quaternions.mirror([0, 1, 0]),
        ];
        this.origin = Vectors.normalize([z, z, 1 + cosP + cosQ]);
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
    getDefaultFaces() {
        const a = this.coxeterGroup.ranks[1][0];
        const b = this.coxeterGroup.ranks[1][1];
        const c = this.coxeterGroup.ranks[1][2];
        return {
            symmetryGroup: this,
            faces: [[a, b], [b, c], [c, a]]
        };
    }
    getFaces(a, b, c) {
        const fa = this.coxeterGroup.elements[a];
        const fb = this.coxeterGroup.elements[b];
        const fc = this.coxeterGroup.elements[c];
        return {
            symmetryGroup: this,
            faces: [[fa, fb], [fb, fc], [fc, fa]],
        };
    }
}
export const unitTriangles = function () {
    const createSymmetry = (p, q) => {
        return new SymmetryGroup3(new FiniteCoxeterGroup(CoxeterMatrix.create3D(new Fraction(p, 1), new Fraction(q, 1))));
    };
    const symmetry3 = createSymmetry(3, 3);
    const symmetry4 = createSymmetry(3, 4);
    const symmetry5 = createSymmetry(3, 5);
    return [
        { id: "a00", name: "2 3 3", unit: symmetry3.getDefaultFaces() },
        { id: "a01", name: "2 3 3'", unit: symmetry3.getFaces(2, 1, 21) },
        { id: "a02", name: "3 3 3'", unit: symmetry3.getFaces(1, 2, 13) },
        { id: "b00", name: "2 3 4", unit: symmetry4.getDefaultFaces() },
        { id: "b01", name: "2 3 4'", unit: symmetry4.getFaces(1, 9, 3) },
        { id: "b02", name: "3 4 4'", unit: symmetry4.getFaces(1, 2, 13) },
        { id: "h00", name: "2 3 5", unit: symmetry5.getDefaultFaces() },
        { id: "p31", name: "2 2 3", unit: createSymmetry(2, 3).getDefaultFaces() },
        { id: "p41", name: "2 2 4", unit: createSymmetry(2, 4).getDefaultFaces() },
        { id: "p51", name: "2 2 5", unit: createSymmetry(2, 5).getDefaultFaces() },
        { id: "p61", name: "2 2 6", unit: createSymmetry(2, 6).getDefaultFaces() },
        { id: "p71", name: "2 2 7", unit: createSymmetry(2, 7).getDefaultFaces() },
    ];
}();
export class NormalPolyhedron {
    origin;
    vertexes;
    lineIndexes;
    faces;
    symmetryGroup;
    constructor(source) {
        this.vertexes = new Array(source.symmetryGroup.coxeterGroup.order);
        this.symmetryGroup = source.symmetryGroup;
        this.origin = source.symmetryGroup.origin;
        for (let i = 0; i < source.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(source.symmetryGroup.origin, source.symmetryGroup.transforms[i]);
        }
        const faceDefinitions = source.faces;
        const lineSet = new Map();
        for (const element of source.symmetryGroup.coxeterGroup.elements) {
            const currentIndex = element.index;
            for (const faceDef of faceDefinitions) {
                for (const edgeElement of faceDef) {
                    const otherIndex = element.mul(edgeElement).index;
                    const [minIndex, maxIndex] = currentIndex < otherIndex ? [currentIndex, otherIndex] : [otherIndex, currentIndex];
                    if (!lineSet.has(minIndex)) {
                        lineSet.set(minIndex, new Set());
                    }
                    lineSet.get(minIndex).add(maxIndex);
                }
            }
        }
        const lines = [];
        for (const [a, bs] of lineSet) {
            for (const b of bs) {
                lines.push([a, b]);
            }
        }
        const usedVertexSet = new Set();
        const faces = [];
        faceDefinitions.forEach((faceDef, mirrorA) => {
            usedVertexSet.clear();
            for (const element of source.symmetryGroup.coxeterGroup.elements) {
                let currentIndex = element.index;
                if (usedVertexSet.has(currentIndex)) {
                    continue;
                }
                let targetElement = element;
                const faceVertexIndexes = [];
                usedVertexSet.add(currentIndex);
                while (true) {
                    for (const edgeElement of faceDef) {
                        targetElement = targetElement.mul(edgeElement);
                        faceVertexIndexes.push(targetElement.index);
                        usedVertexSet.add(targetElement.index);
                    }
                    if (targetElement.index === currentIndex) {
                        break;
                    }
                }
                faces.push({
                    ColorIndex: mirrorA,
                    VertexIndexes: faceVertexIndexes,
                });
            }
        });
        this.lineIndexes = lines;
        this.faces = faces;
    }
    setOrigin(newOrigin) {
        this.origin = newOrigin;
        for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(newOrigin, this.symmetryGroup.transforms[i]);
        }
    }
}
