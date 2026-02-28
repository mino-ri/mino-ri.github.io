import { FiniteCoxeterGroup } from "./coxeter_group.js";
import { QuaternionPairs } from "./quaternion_pair.js";
import { SymmetryGroup4 } from "./symmetry4.js";
import { CoxeterMatrix } from "./coxeter_matrix.js";
export class Polychoron {
    symmetryGroup;
    vertexes;
    cells;
    constructor(source, faceSelector) {
        const vertexCount = source.symmetryGroup.order;
        this.vertexes = new Array(vertexCount);
        this.symmetryGroup = source.symmetryGroup;
        const { cellDefinition } = faceSelector(source.generators[0], source.generators[1], source.generators[2], source.generators[3], source.symmetryGroup);
        const generatorEdges = new Set();
        for (const cellDef of cellDefinition) {
            for (const faceDef of cellDef) {
                for (const edgeDef of faceDef) {
                    generatorEdges.add(edgeDef);
                }
            }
        }
        const activeVertexes = [0];
        const activeVertexSet = new Set();
        for (let i = 0; i < activeVertexes.length; i++) {
            const currentIndex = activeVertexes[i];
            const currentElement = source.symmetryGroup.getElement(currentIndex);
            for (const edgeElement of generatorEdges) {
                const otherElement = currentElement.mul(edgeElement);
                const otherIndex = otherElement.index;
                if (!activeVertexSet.has(otherIndex)) {
                    activeVertexSet.add(otherIndex);
                    activeVertexes.push(otherIndex);
                }
            }
        }
        const cells = [];
        for (let cellDefIndex = 0; cellDefIndex < cellDefinition.length; cellDefIndex++) {
            const cellDef = cellDefinition[cellDefIndex];
            if (cellDef.length == 0)
                continue;
            const cellVertexIndexMap = new Map();
            cellVertexIndexMap.clear();
            const cellByEdgeMap = new Map();
            const edgesByCellMap = new Map();
            cellByEdgeMap.clear();
            for (const faceDef of cellDef) {
                if (faceDef.length === 0)
                    continue;
                const usedVertexSet = new Set();
                usedVertexSet.clear();
                const isReflectable = faceDef[0].period === 2 && faceDef[0].rank % 2 === 1;
                for (const currentIndex of activeVertexes) {
                    const element = source.symmetryGroup.getElement(currentIndex);
                    if (usedVertexSet.has(currentIndex))
                        continue;
                    let targetElement = element;
                    const face = [];
                    while (true) {
                        usedVertexSet.add(targetElement.index);
                        if (isReflectable) {
                            usedVertexSet.add(targetElement.mul(faceDef[0]).index);
                        }
                        for (const edgeElement of faceDef) {
                            targetElement = targetElement.mul(edgeElement);
                            face.push(targetElement.index);
                        }
                        if (targetElement.index === currentIndex)
                            break;
                    }
                    if (face.length < 3)
                        continue;
                    let cell = undefined;
                    for (let i = 0; i < face.length; i++) {
                        const left = face[i];
                        const right = face[(i + 1) % face.length];
                        const edgeIndex = left < right ? left * vertexCount + right : right * vertexCount + left;
                        let cellOfEdge = cellByEdgeMap.get(edgeIndex);
                        if (!cell) {
                            if (cellOfEdge) {
                                cell = cellOfEdge;
                                cell.faceIndexes.push(face);
                            }
                        }
                        else if (cellOfEdge && cellOfEdge !== cell) {
                            cell.faceIndexes.push(...cellOfEdge.faceIndexes);
                            const currentEdgeSet = edgesByCellMap.get(cell);
                            for (const existingEdge of edgesByCellMap.get(cellOfEdge)) {
                                cellByEdgeMap.set(existingEdge, cell);
                                currentEdgeSet.add(existingEdge);
                            }
                            edgesByCellMap.delete(cellOfEdge);
                        }
                    }
                    cell ??= { colorIndex: cellDefIndex, connectedIndex: 0, faceIndexes: [face] };
                    let edgeSet = edgesByCellMap.get(cell);
                    if (!edgeSet) {
                        edgeSet = new Set();
                        edgesByCellMap.set(cell, edgeSet);
                    }
                    for (let i = 0; i < face.length; i++) {
                        const left = face[i];
                        const right = face[(i + 1) % face.length];
                        const edgeIndex = left < right ? left * vertexCount + right : right * vertexCount + left;
                        edgeSet.add(edgeIndex);
                        cellByEdgeMap.set(edgeIndex, cell);
                    }
                }
            }
            cells.push(...edgesByCellMap.keys());
        }
        this.cells = cells;
    }
    setOrigin(newOrigin) {
        for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = QuaternionPairs.transform(newOrigin, this.symmetryGroup.transforms[i]);
        }
    }
}
export const unitTetrahedrons = function () {
    return [
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4D(3, 3, 3))).getDefaultGenerators(),
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4DDemicube(3, 3, 3))).getDefaultGenerators(),
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4D(3, 3, 4))).getDefaultGenerators(),
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4D(3, 4, 3))).getDefaultGenerators(),
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4D(3, 3, 5))).getDefaultGenerators(),
    ];
}();
export const cellSelectorFunctions = function () {
    return new Map([
        ["full", (a, b, c, d) => {
                return {
                    cellDefinition: [
                        [[a, b], [b, c], [c, a]],
                        [[d, a], [a, b], [b, d]],
                        [[c, d], [d, a], [a, c]],
                        [[b, c], [c, d], [d, b]],
                    ]
                };
            }]
    ]);
};
