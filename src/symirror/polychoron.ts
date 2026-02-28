import { CoxeterGroupElement, FiniteCoxeterGroup } from "./coxeter_group.js";
import { Vector } from "./vector.js";
import { QuaternionPairs } from "./quaternion_pair.js";
import { SymmetryGroup4, UnitTetrahedron } from "./symmetry4.js";
import { CoxeterMatrix } from "./coxeter_matrix.js";

export type CellSelectorFunction = (
    a: CoxeterGroupElement,
    b: CoxeterGroupElement,
    c: CoxeterGroupElement,
    d: CoxeterGroupElement,
    g: SymmetryGroup4) => { cellDefinition: CoxeterGroupElement[][][] }

export type PolychoronCell = {
    colorIndex: number
    connectedIndex: number
    faceIndexes: number[][]
}

export type PolychoronEdge = {
    connectedIndex: number
    index1: number
    index2: number
}

export class Polychoron {
    symmetryGroup: SymmetryGroup4
    vertexes: Vector[]
    // vertexConnectedIndexes: number[]
    // edges: PolychoronEdge[]
    cells: PolychoronCell[]

    constructor(
        source: UnitTetrahedron,
        faceSelector: CellSelectorFunction,
    ) {
        const vertexCount = source.symmetryGroup.order
        this.vertexes = new Array<Vector>(vertexCount)
        this.symmetryGroup = source.symmetryGroup
        const { cellDefinition } = faceSelector(source.generators[0]!, source.generators[1]!, source.generators[2]!, source.generators[3]!, source.symmetryGroup)

        const generatorEdges = new Set<CoxeterGroupElement>()
        for (const cellDef of cellDefinition) {
            for (const faceDef of cellDef) {
                for (const edgeDef of faceDef) {
                    generatorEdges.add(edgeDef)
                }
            }
        }

        // 利用可能な頂点の列挙 (キラル図形では一部頂点が無効化されるため)
        const activeVertexes = [0]
        const activeVertexSet = new Set<number>()
        for (let i = 0; i < activeVertexes.length; i++) {
            const currentIndex = activeVertexes[i]!
            const currentElement = source.symmetryGroup.getElement(currentIndex)
            for (const edgeElement of generatorEdges) {
                const otherElement = currentElement.mul(edgeElement)
                const otherIndex = otherElement.index
                if (!activeVertexSet.has(otherIndex)) {
                    activeVertexSet.add(otherIndex)
                    activeVertexes.push(otherIndex)
                }
            }
        }

        const cells: PolychoronCell[] = []
        for (let cellDefIndex = 0; cellDefIndex < cellDefinition.length; cellDefIndex++) {
            const cellDef = cellDefinition[cellDefIndex]!
            if (cellDef.length == 0) continue

            const cellVertexIndexMap = new Map<number, number>()
            cellVertexIndexMap.clear()
            const cellByEdgeMap = new Map<number, PolychoronCell>()
            const edgesByCellMap = new Map<PolychoronCell, Set<number>>()
            cellByEdgeMap.clear()
            for (const faceDef of cellDef) {
                if (faceDef.length === 0) continue
                const usedVertexSet = new Set<number>()
                usedVertexSet.clear()
                const isReflectable = faceDef[0]!.period === 2 && faceDef[0]!.rank % 2 === 1
                for (const currentIndex of activeVertexes) {
                    const element = source.symmetryGroup.getElement(currentIndex)!
                    if (usedVertexSet.has(currentIndex)) continue

                    // 面の生成
                    let targetElement = element
                    const face: number[] = []
                    while (true) {
                        usedVertexSet.add(targetElement.index)
                        if (isReflectable) {
                            usedVertexSet.add(targetElement.mul(faceDef[0]!).index)
                        }
                        for (const edgeElement of faceDef) {
                            targetElement = targetElement.mul(edgeElement)
                            face.push(targetElement.index)
                        }
                        if (targetElement.index === currentIndex) break
                    }

                    if (face.length < 3) continue

                    // 面が属する胞を判定し、登録
                    let cell: PolychoronCell | undefined = undefined
                    for (let i = 0; i < face.length; i++) {
                        const left = face[i]!
                        const right = face[(i + 1) % face.length]!
                        const edgeIndex = left < right ? left * vertexCount + right : right * vertexCount + left
                        let cellOfEdge = cellByEdgeMap.get(edgeIndex)
                        if (!cell) {
                            // この面が属する胞が確定していない場合
                            if (cellOfEdge) {
                                cell = cellOfEdge
                                cell.faceIndexes.push(face)
                            }
                        } else if (cellOfEdge && cellOfEdge !== cell) {
                            // この面が属する胞が確定している場合
                            cell.faceIndexes.push(...cellOfEdge.faceIndexes)
                            const currentEdgeSet = edgesByCellMap.get(cell)!
                            for (const existingEdge of edgesByCellMap.get(cellOfEdge)!) {
                                cellByEdgeMap.set(existingEdge, cell)
                                currentEdgeSet.add(existingEdge)
                            }
                            edgesByCellMap.delete(cellOfEdge)
                        }
                    }

                    cell ??= { colorIndex: cellDefIndex, connectedIndex: 0, faceIndexes: [face] }
                    let edgeSet = edgesByCellMap.get(cell)
                    if (!edgeSet) {
                        edgeSet = new Set<number>()
                        edgesByCellMap.set(cell, edgeSet)
                    }

                    for (let i = 0; i < face.length; i++) {
                        const left = face[i]!
                        const right = face[(i + 1) % face.length]!
                        const edgeIndex = left < right ? left * vertexCount + right : right * vertexCount + left
                        edgeSet.add(edgeIndex)
                        cellByEdgeMap.set(edgeIndex, cell)
                    }
                }
            }

            cells.push(...edgesByCellMap.keys())
        }

        this.cells = cells
    }

    setOrigin(newOrigin: Vector): void {
        for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = QuaternionPairs.transform(newOrigin, this.symmetryGroup.transforms[i]!)
        }
    }
}

export const unitTetrahedrons = function (): UnitTetrahedron[] {
    return [
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4D(3, 3, 3))).getDefaultGenerators(),
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4DDemicube(3, 3, 3))).getDefaultGenerators(),
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4D(3, 3, 4))).getDefaultGenerators(),
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4D(3, 4, 3))).getDefaultGenerators(),
        new SymmetryGroup4(new FiniteCoxeterGroup(CoxeterMatrix.create4D(3, 3, 5))).getDefaultGenerators(),
    ]
}()

export const cellSelectorFunctions = function (): Map<string, CellSelectorFunction> {
    return new Map<string, CellSelectorFunction>([
        ["full", (a, b, c, d) => {
            return {
                cellDefinition: [
                    [[a, b], [b, c], [c, a]],
                    [[d, a], [a, b], [b, d]],
                    [[c, d], [d, a], [a, c]],
                    [[b, c], [c, d], [d, b]],
                ]
            }
        }]
    ])
}
