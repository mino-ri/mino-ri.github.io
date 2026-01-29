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
    getDefaultGenerators() {
        return this.getGenerators(1, 2, 3);
    }
    getGenerators(a, b, c) {
        return {
            symmetryGroup: this,
            generators: [
                this.coxeterGroup.elements[a],
                this.coxeterGroup.elements[b],
                this.coxeterGroup.elements[c],
            ]
        };
    }
}
export const unitTriangles = function () {
    const createSymmetry = (p, q) => {
        return new SymmetryGroup3(new FiniteCoxeterGroup(CoxeterMatrix.create3D(p, q)));
    };
    const symmetry3 = createSymmetry(3, 3);
    const symmetry4 = createSymmetry(3, 4);
    const symmetry5 = createSymmetry(3, 5);
    return [
        { id: "a00", name: "2 3 3", unit: symmetry3.getDefaultGenerators() },
        { id: "a02", name: "3 3 3'", unit: symmetry3.getGenerators(1, 2, 13) },
        { id: "b00", name: "2 3 4", unit: symmetry4.getDefaultGenerators() },
        { id: "b02", name: "3 4 4'", unit: symmetry4.getGenerators(1, 2, 13) },
        { id: "h00", name: "2 3 5", unit: symmetry5.getDefaultGenerators() },
        { id: "h03", name: "2 3 $", unit: symmetry5.getGenerators(2, 1, 83) },
        { id: "h04", name: "2 5 $", unit: symmetry5.getGenerators(1, 13, 3) },
        { id: "h06", name: "3 3 5'", unit: symmetry5.getGenerators(1, 2, 28) },
        { id: "h07", name: "3 3 $", unit: symmetry5.getGenerators(1, 2, 15) },
        { id: "h08", name: "3 5 5'", unit: symmetry5.getGenerators(1, 13, 2) },
        { id: "h09", name: "3 5 $'", unit: symmetry5.getGenerators(1, 33, 2) },
        { id: "h10", name: "3 $ $'", unit: symmetry5.getGenerators(1, 99, 2) },
        { id: "h13", name: "5 5 5'", unit: symmetry5.getGenerators(2, 3, 28) },
        { id: "h14", name: "$ $ $", unit: symmetry5.getGenerators(3, 13, 26) },
        { id: "p31", name: "2 2 3", unit: createSymmetry(2, 3).getDefaultGenerators() },
        { id: "p41", name: "2 2 4", unit: createSymmetry(2, 4).getDefaultGenerators() },
        { id: "p51", name: "2 2 5", unit: createSymmetry(2, 5).getDefaultGenerators() },
        { id: "p61", name: "2 2 6", unit: createSymmetry(2, 6).getDefaultGenerators() },
        { id: "p71", name: "2 2 7", unit: createSymmetry(2, 7).getDefaultGenerators() },
    ];
}();
export const faceSelectorMap = new Map([
    ["xxx", (a, b, c) => [[a, b], [b, c], [c, a]]],
    ["oxx", (a, b, c) => {
            const aba = a.mul(b).mul(a);
            const aca = a.mul(c).mul(a);
            return [[aba, b], [b, c], [aca, c], [aba, aca]];
        }],
    ["xox", (a, b, c) => {
            const bab = b.mul(a).mul(b);
            const bcb = b.mul(c).mul(b);
            return [[a, bab], [bcb, c], [a, c], [bab, bcb]];
        }],
    ["xxo", (a, b, c) => {
            const cac = c.mul(a).mul(c);
            const cbc = c.mul(b).mul(c);
            return [[a, b], [b, cbc], [a, cac], [cac, cbc]];
        }],
    ["xoo", (a, b, c) => {
            const bab = b.mul(a).mul(b);
            const cac = c.mul(a).mul(c);
            const bc = b.mul(c);
            const cb = c.mul(b);
            return [[a, bab], [bc], [a, cac], [bc, cac, cb, bab]];
        }],
    ["oxo", (a, b, c) => {
            const aba = a.mul(b).mul(a);
            const cbc = c.mul(b).mul(c);
            const ac = a.mul(c);
            const ca = c.mul(a);
            return [[b, aba], [b, cbc], [ac], [ac, cbc, ca, aba]];
        }],
    ["oox", (a, b, c) => {
            const aca = a.mul(c).mul(a);
            const bcb = b.mul(c).mul(b);
            const ab = a.mul(b);
            const ba = b.mul(a);
            return [[ab], [c, bcb], [c, aca], [ab, bcb, ba, aca]];
        }],
    ["ooo", (a, b, c) => {
            const ab = a.mul(b);
            const bc = b.mul(c);
            const ca = c.mul(a);
            return [[ab], [bc], [ca], [ab, bc, ca]];
        }],
]);
export class NormalPolyhedron {
    origin;
    vertexes;
    vertexIndexes;
    lineIndexes;
    faces;
    symmetryGroup;
    generators;
    constructor(source, faceSelector) {
        this.vertexes = new Array(source.symmetryGroup.coxeterGroup.order);
        this.symmetryGroup = source.symmetryGroup;
        this.generators = source.generators;
        this.origin = source.symmetryGroup.origin;
        for (let i = 0; i < source.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(source.symmetryGroup.origin, source.symmetryGroup.transforms[i]);
        }
        const faceDefinitions = faceSelector(source.generators[0], source.generators[1], source.generators[2]);
        const vertexIndexes = [0];
        const vertexSet = new Set();
        vertexSet.add(0);
        for (let i = 0; i < vertexIndexes.length; i++) {
            const currentIndex = vertexIndexes[i];
            const currentElement = source.symmetryGroup.coxeterGroup.elements[currentIndex];
            for (const faceDef of faceDefinitions) {
                for (const edgeElement of faceDef) {
                    const otherIndex = currentElement.mul(edgeElement).index;
                    if (!vertexSet.has(otherIndex)) {
                        vertexSet.add(otherIndex);
                        vertexIndexes.push(otherIndex);
                    }
                }
            }
        }
        vertexIndexes.sort((a, b) => a - b);
        this.vertexIndexes = vertexIndexes;
        const lineSet = new Map();
        for (const currentIndex of vertexIndexes) {
            const element = source.symmetryGroup.coxeterGroup.elements[currentIndex];
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
            const isReflectable = faceDef[0].period === 2 && faceDef[0].rank % 2 === 1;
            for (const currentIndex of vertexIndexes) {
                const element = source.symmetryGroup.coxeterGroup.elements[currentIndex];
                if (usedVertexSet.has(currentIndex)) {
                    continue;
                }
                let targetElement = element;
                const faceVertexIndexes = [];
                usedVertexSet.add(currentIndex);
                if (isReflectable) {
                    usedVertexSet.add(element.mul(faceDef[0]).index);
                }
                while (true) {
                    for (const edgeElement of faceDef) {
                        targetElement = targetElement.mul(edgeElement);
                        faceVertexIndexes.push(targetElement.index);
                    }
                    if (targetElement.index === currentIndex) {
                        break;
                    }
                }
                if (faceVertexIndexes.length >= 3) {
                    faces.push({
                        ColorIndex: mirrorA,
                        VertexIndexes: faceVertexIndexes,
                    });
                }
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
