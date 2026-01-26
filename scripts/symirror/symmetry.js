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
        return [[a, b], [b, c], [c, a]];
    }
}
export class NormalPolyhedron {
    symmetryGroup;
    origin;
    vertexes;
    lineIndexes;
    faces;
    constructor(symmetryGroup) {
        this.symmetryGroup = symmetryGroup;
        this.vertexes = new Array(symmetryGroup.coxeterGroup.order);
        this.origin = symmetryGroup.origin;
        for (let i = 0; i < symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(symmetryGroup.origin, symmetryGroup.transforms[i]);
        }
        const faceDefinitions = symmetryGroup.getDefaultFaces();
        const lineSet = new Map();
        for (const element of symmetryGroup.coxeterGroup.elements) {
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
            for (const element of symmetryGroup.coxeterGroup.elements) {
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
        console.log(faces);
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
