import { CoxeterMatrix } from "./coxeter_matrix.js";
import { FiniteCoxeterGroup } from "./coxeter_group.js";
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
        this.origin = [0, 0, 1];
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
    const symmetryP5 = createSymmetry(2, 5);
    const symmetryP7 = createSymmetry(2, 7);
    return [
        { id: "a00", name: "2 3 3", unit: symmetry3.getDefaultGenerators(), snubPoints: [[0.3719739026214218, 0.3711063250059786, 0.8508322462795742], [-0.6016644209754163, -0.6013068195365014, 0.5257661393730243]] },
        { id: "a01", name: "3 3 3'", unit: symmetry3.getGenerators(1, 2, 13) },
        { id: "b00", name: "2 3 4", unit: symmetry4.getDefaultGenerators(), snubPoints: [[0.274529843297775, 0.2514828934900627, 0.9281108335865738]] },
        { id: "b01", name: "3 4 4'", unit: symmetry4.getGenerators(1, 2, 13) },
        { id: "h00", name: "2 3 5", unit: symmetry5.getDefaultGenerators(), snubPoints: [[0.17362276702464857, 0.1532781551762212, 0.9728108459081235]] },
        { id: "h01", name: "2 3 5/2", unit: symmetry5.getGenerators(2, 1, 83), snubPoints: [[0.2934737350596348, -0.34884613790107505, 0.890044683654507], [-0.9062343791439471, -0.3502908195091824, 0.236718380835055], [-0.5879050866151723, 0.7896142609307613, 0.17571832023660608]] },
        { id: "h02", name: "2 5 5/2", unit: symmetry5.getGenerators(1, 13, 3), snubPoints: [[0.2441220393050724, 0.30667128071226984, 0.919976714657403], [0.1868151186710511, -0.55662847504144, 0.8094843125156671]] },
        { id: "h03", name: "3 3 5'", unit: symmetry5.getGenerators(1, 2, 28) },
        { id: "h04", name: "3 3 5/2", unit: symmetry5.getGenerators(1, 2, 15), snubPoints: [[0.1842680470996585, 0.0002323682813360037, 0.9828760007361356], [-0.9934037311234103, 0.0006531253985034092, 0.11466734677884965]] },
        { id: "h05", name: "3 5 5'", unit: symmetry5.getGenerators(1, 13, 2) },
        { id: "h06", name: "3 5 5/2'", unit: symmetry5.getGenerators(1, 33, 2), snubPoints: [[0.09453035692186709, -0.16374423004893354, 0.9819632573298791]] },
        { id: "h07", name: "3 5/2 5/2'", unit: symmetry5.getGenerators(1, 99, 2), snubPoints: [[0.5839708202463768, -0.32701548905717087, 0.7429932375314551], [-0.20197213592544647, 0.9450410298772749, 0.25710835878713195]] },
        { id: "h08", name: "5 5 5'", unit: symmetry5.getGenerators(2, 3, 28) },
        { id: "h09", name: "5/2 5/2 5/2", unit: symmetry5.getGenerators(3, 13, 26) },
        { id: "p31", name: "2 2 2", unit: createSymmetry(2, 2).getDefaultGenerators() },
        { id: "p31", name: "2 2 3", unit: createSymmetry(2, 3).getDefaultGenerators(), snubPoints: [[-0.5771802530924266, 0.40832752047197346, 0.7071998242826227], [0.5771802530924266, 0.40832752047197346, 0.7071998242826227]] },
        { id: "p41", name: "2 2 4", unit: createSymmetry(2, 4).getDefaultGenerators(), snubPoints: [[-0.5111347434249403, 0.3286316758425271, 0.7941929839131373], [0.5111347434249403, 0.3286316758425271, 0.7941929839131373]] },
        { id: "p51", name: "2 2 5", unit: symmetryP5.getDefaultGenerators(), snubPoints: [[-0.44660623733507715, 0.2765531581360969, 0.8509178688324484], [0.44660623733507715, 0.2765531581360969, 0.8509178688324484]] },
        { id: "p53", name: "2 2 5/2", unit: symmetryP5.getGenerators(1, 2, 11), snubPoints: [[-0.5987426743493759, 0.0002110478231757374, 0.8009414244323824], [0.5987426743493759, 0.0002110478231757374, 0.8009414244323824], [-0.44711653107453697, -0.8944757166111083, 0.000005737334089724187], [0.44711653107453697, -0.8944757166111083, 0.000005737334089724187]] },
        { id: "p61", name: "2 2 6", unit: createSymmetry(2, 6).getDefaultGenerators(), snubPoints: [[-0.3931935908064074, 0.23786331464090538, 0.8881553038161767], [0.3931935908064074, 0.23786331464090538, 0.8881553038161767]] },
        { id: "p71", name: "2 2 7", unit: symmetryP7.getDefaultGenerators(), snubPoints: [[-0.34915940259840533, 0.2083295343698897, 0.9136117975849204], [0.34915940259840533, 0.2083295343698897, 0.9136117975849204]] },
        { id: "p72", name: "2 2 7/2", unit: symmetryP7.getGenerators(1, 2, 11), snubPoints: [[-0.5455983391838306, 0.0002153961070602594, 0.8380467802481928], [0.5455983391838306, 0.0002153961070602594, 0.8380467802481928]] },
        { id: "p73", name: "2 2 7/3", unit: symmetryP7.getGenerators(1, 2, 19), snubPoints: [[-0.5994232712396262, -0.1779700836642542, 0.7803963039487846], [0.5994232712396262, -0.1779700836642542, 0.7803963039487846], [-0.5034145899510695, 0.8423776194324194, 0.19228545681815487], [0.5034145899510695, 0.8423776194324194, 0.19228545681815487]] },
        { id: "cb00", name: "2×[2 3 3]", unit: symmetry4.getGenerators(2, 1, 15), beginPointIndex: [0, 5], snubPoints: [[0.23030006087238106, 0, 0.9731196647700516], [-0.9732344089600085, 0.0005764752903657746, 0.2298139527802928]] },
        { id: "cb01", name: "2×[3 3 3']", unit: symmetry4.getGenerators(2, 1, 27), beginPointIndex: [0, 5] },
        { id: "cb02", name: "3×[2 2 4]", unit: symmetry4.getGenerators(1, 13, 3), beginPointIndex: [0, 4, 6], snubPoints: [[0.32900712135821136, 0.5112749643087343, 0.7939472431885418], [0.32900712135821136, -0.5112749643087343, 0.7939472431885418]] },
        { id: "ch00", name: "15×[2 2 2]", unit: symmetry5.getGenerators(1, 3, 114), beginPointIndex: [0, 4, 6, 8, 18, 43, 24, 39, 17, 21, 44, 40, 46, 20, 36] },
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
            return [[a, bab], [bc], [a, cac], [cac, cb, bab, bc]];
        }],
    ["oxo", (a, b, c) => {
            const aba = a.mul(b).mul(a);
            const cbc = c.mul(b).mul(c);
            const ac = a.mul(c);
            const ca = c.mul(a);
            return [[b, aba], [b, cbc], [ac], [cbc, ca, aba, ac]];
        }],
    ["oox", (a, b, c) => {
            const aca = a.mul(c).mul(a);
            const bcb = b.mul(c).mul(b);
            const ab = a.mul(b);
            const ba = b.mul(a);
            return [[ab], [c, bcb], [c, aca], [bcb, ba, aca, ab]];
        }],
    ["ooo", (a, b, c) => {
            const ab = a.mul(b);
            const bc = b.mul(c);
            const ca = c.mul(a);
            return [[ab], [bc], [ca], [ab, bc, ca]];
        }],
    ["oooo", (a, b, c) => {
            const ab = a.mul(b);
            const bc = b.mul(c);
            const ac = a.mul(c);
            const ca = c.mul(a);
            const abDash = ac.mul(ab).mul(ca);
            const bcDash = ca.mul(bc).mul(ac);
            return [[bc], [bcDash], [ab], [ab, bc, abDash, bcDash], [abDash]];
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
    faceDefinitions;
    snubPoints;
    constructor(source, snubPoints, beginPoints, faceSelector) {
        this.vertexes = new Array(source.symmetryGroup.coxeterGroup.order);
        this.symmetryGroup = source.symmetryGroup;
        this.generators = source.generators;
        this.origin = source.symmetryGroup.origin;
        this.snubPoints = snubPoints;
        for (let i = 0; i < source.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(source.symmetryGroup.origin, source.symmetryGroup.transforms[i]);
        }
        const faceDefinitions = faceSelector(source.generators[0], source.generators[1], source.generators[2]);
        this.faceDefinitions = faceDefinitions;
        const vertexIndexes = beginPoints ? [...beginPoints] : [0];
        const vertexColorMap = new Map();
        for (let i = 0; i < vertexIndexes.length; i++) {
            vertexColorMap.set(vertexIndexes[i], i % 5);
        }
        for (let i = 0; i < vertexIndexes.length; i++) {
            const currentIndex = vertexIndexes[i];
            const currentElement = source.symmetryGroup.coxeterGroup.elements[currentIndex];
            for (const faceDef of faceDefinitions) {
                for (const edgeElement of faceDef) {
                    const otherIndex = currentElement.mul(edgeElement).index;
                    if (!vertexColorMap.has(otherIndex)) {
                        vertexColorMap.set(otherIndex, vertexColorMap.get(currentIndex) ?? 0);
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
        for (let mirrorA = 0; mirrorA < faceDefinitions.length; mirrorA++) {
            const faceDef = faceDefinitions[mirrorA];
            usedVertexSet.clear();
            const isReflectable = faceDef[0].period === 2 && faceDef[0].rank % 2 === 1;
            for (const currentIndex of vertexIndexes) {
                const element = source.symmetryGroup.coxeterGroup.elements[currentIndex];
                if (usedVertexSet.has(currentIndex)) {
                    continue;
                }
                let targetElement = element;
                const faceVertexIndexes = [];
                while (true) {
                    usedVertexSet.add(targetElement.index);
                    if (isReflectable) {
                        usedVertexSet.add(targetElement.mul(faceDef[0]).index);
                    }
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
                        colorIndex: mirrorA,
                        connectedIndex: vertexColorMap.get(currentIndex) ?? 0,
                        vertexIndexes: faceVertexIndexes,
                    });
                }
            }
        }
        this.lineIndexes = lines;
        this.faces = faces;
    }
    #isExisting(existing, element) {
        for (const ex of existing) {
            if (ex.index === element.index) {
                return true;
            }
            else if (ex.mul(element).index === 0) {
                return true;
            }
        }
        return false;
    }
    getEdgeGenerators() {
        const result = [];
        for (const face of this.faceDefinitions) {
            for (const element of face) {
                if (!this.#isExisting(result, element)) {
                    result.push(element);
                }
            }
        }
        return result.map((e) => this.symmetryGroup.transforms[e.index]);
    }
    maxRatio = 0.8;
    setOrigin(newOrigin) {
        this.origin = newOrigin;
        for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(newOrigin, this.symmetryGroup.transforms[i]);
        }
    }
}
