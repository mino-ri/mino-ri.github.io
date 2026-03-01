import { CoxeterMatrix } from "./coxeter_matrix.js";
import { FiniteCoxeterGroup, CoxeterGroupElement } from "./coxeter_group.js";
import { Vector } from "./vector.js";
import { Quaternion, Quaternions } from "./quaternion.js";
import { IPolytope } from "./model.js";
import { SymmetryGroup3, UnitTriangle } from "./symmetry3.js";

export type PolyhedronSource = {
    id: string
    name: string
    unit: UnitTriangle
    compoundTransforms?: Quaternion[] | undefined
}

export type PolyhedronFace = {
    colorIndex: number
    connectedIndex: number
    faceIndexes: number[][]
}

export type PolyhedronEdge = {
    connectedIndex: number
    index1: number
    index2: number
}

export type AdditionalLengthElement = {
    element: CoxeterGroupElement
    length: number
}

export class NormalPolyhedron implements IPolytope {
    #compoundTransforms: Quaternion[]
    vertexes: Vector[]
    vertexConnectedIndexes: number[]
    edges: PolyhedronEdge[]
    units: PolyhedronFace[]
    symmetryGroup: SymmetryGroup3
    generators: CoxeterGroupElement[]
    #additionalLengths: CoxeterGroupElement[]
    #faceDefinitions: CoxeterGroupElement[][]

    constructor(
        source: UnitTriangle,
        faceSelector: FaceSelectorFunction,
        compoundTransforms?: Quaternion[],
    ) {
        const vertexCount = source.symmetryGroup.order * (compoundTransforms?.length || 1)
        const connectedIndexMap = new Array<number | undefined>(vertexCount)
        this.vertexes = new Array<number[]>(vertexCount)
        this.symmetryGroup = source.symmetryGroup
        this.generators = source.generators
        this.#compoundTransforms = compoundTransforms ?? []
        const { elements: faceDefinitions, additionalElements, mirrorImageReflector } = faceSelector(source.generators[0]!, source.generators[1]!, source.generators[2]!, source.symmetryGroup)
        this.#additionalLengths = additionalElements ?? []
        this.#faceDefinitions = faceDefinitions.map(f => f.filter(e => e.period > 1))
        const maxElement = source.symmetryGroup.getMaxElement()
        const isCentrosymmetry = maxElement.rank % 2 === 1
        const reflector = mirrorImageReflector ?? (isCentrosymmetry ? maxElement : undefined)
        for (let i = 0; i < vertexCount; i++) {
            this.vertexes[i] = [0, 0, 0]
        }
        // 頂点ごとの連結成分ID
        // 連結成分Idへのマップ
        let connectedIndex = 0
        let isHalf: boolean | null = null
        for (let i = 0; i < source.symmetryGroup.order; i++) {
            if (connectedIndexMap[i] !== undefined || (isCentrosymmetry && source.symmetryGroup.getElement(i).rank % 2 === 1)) continue

            const vertexIndexes = [i]
            let isChiral = true
            connectedIndexMap[i] = connectedIndex
            for (let j = 0; j < vertexIndexes.length; j++) {
                const currentIndex = vertexIndexes[j]!
                const currentElement = source.symmetryGroup.getElement(currentIndex)
                for (const faceDef of this.#faceDefinitions) {
                    for (const edgeElement of faceDef) {
                        const otherElement = currentElement.mul(edgeElement)
                        const otherIndex = otherElement.index
                        if (connectedIndexMap[otherIndex] === undefined) {
                            connectedIndexMap[otherIndex] = connectedIndexMap[currentIndex] ?? 0
                            vertexIndexes.push(otherIndex)
                            isChiral &&= otherElement.rank % 2 === 0
                        }
                    }
                }
            }

            if (vertexIndexes.length >= source.symmetryGroup.order) break
            isHalf ??= vertexIndexes.length >= source.symmetryGroup.order / 2

            // 鏡像が分かれている図形は、鏡像を holosnub 限定図形にする
            if (reflector && connectedIndexMap[source.symmetryGroup.getElement(i).mul(reflector).index] === undefined) {
                const oppositeConnectedIndex = connectedIndex + (isHalf ? 31 : 30)
                if (!isChiral && i !== 0) {
                    // 柱複合多面体の Ionic 対称性を得るための特殊処理
                    for (const j of vertexIndexes) {
                        connectedIndexMap[j] = oppositeConnectedIndex
                        connectedIndexMap[source.symmetryGroup.getElement(j).mul(reflector).index] ??= connectedIndex
                    }
                } else {
                    for (const j of vertexIndexes) {
                        connectedIndexMap[source.symmetryGroup.getElement(j).mul(reflector).index] ??= oppositeConnectedIndex
                    }
                }
            }

            connectedIndex += compoundTransforms ? 30 : isHalf ? 31 : 1
        }

        // 辺の生成
        const lineSet = new Map<number, { connectedIndex: number, vertexes: Set<number> }>()
        for (let currentIndex = 0; currentIndex < source.symmetryGroup.order; currentIndex++) {
            const element = source.symmetryGroup.getElement(currentIndex)
            for (const faceDef of this.#faceDefinitions) {
                for (const edgeElement of faceDef) {
                    const otherIndex = element.mul(edgeElement).index
                    const [minIndex, maxIndex] = currentIndex < otherIndex ? [currentIndex, otherIndex] : [otherIndex, currentIndex]
                    if (!lineSet.has(minIndex)) {
                        lineSet.set(minIndex, { connectedIndex: connectedIndexMap[minIndex] ?? 0, vertexes: new Set<number>() })
                    }
                    lineSet.get(minIndex)!.vertexes.add(maxIndex)
                }
            }
        }

        const edges: PolyhedronEdge[] = []
        for (const [index1, bs] of lineSet) {
            for (const index2 of bs.vertexes) {
                edges.push({ index1, index2, connectedIndex: bs.connectedIndex })
            }
        }

        // 面の生成
        const usedVertexSet = new Set<number>()
        const faces: PolyhedronFace[] = []
        for (let mirrorA = 0; mirrorA < this.#faceDefinitions.length; mirrorA++) {
            const faceDef = this.#faceDefinitions[mirrorA]!
            if (faceDef.length === 0) continue
            usedVertexSet.clear()
            const isReflectable = faceDef[0]!.period === 2 && faceDef[0]!.rank % 2 === 1
            for (let currentIndex = 0; currentIndex < source.symmetryGroup.order; currentIndex++) {
                const element = source.symmetryGroup.getElement(currentIndex)!
                if (usedVertexSet.has(currentIndex)) {
                    continue
                }

                let targetElement = element
                const faceVertexIndexes: number[] = []
                while (true) {
                    usedVertexSet.add(targetElement.index)
                    if (isReflectable) {
                        usedVertexSet.add(targetElement.mul(faceDef[0]!).index)
                    }
                    for (const edgeElement of faceDef) {
                        targetElement = targetElement.mul(edgeElement)
                        faceVertexIndexes.push(targetElement.index)
                    }
                    if (targetElement.index === currentIndex) {
                        break
                    }
                }

                if (faceVertexIndexes.length >= 3) {
                    faces.push({
                        colorIndex: mirrorA,
                        connectedIndex: connectedIndexMap[currentIndex] ?? 0,
                        faceIndexes: [faceVertexIndexes],
                    })
                }
            }
        }

        const compoundCount = this.#compoundTransforms.length
        if (compoundCount > 0) {
            const baseOrder = source.symmetryGroup.order
            const vertexIndexCount = source.symmetryGroup.order
            const lineCount = edges.length
            const faceCount = faces.length
            // compoundMap
            edges.length *= compoundCount
            faces.length *= compoundCount
            const connectedCount =
                compoundCount % 6 === 0 ? 6
                    : compoundCount % 5 === 0 ? 5
                        : compoundCount % 4 === 0 ? 4
                            : 6
            for (let c = 1; c < compoundCount; c++) {
                const baseIndex = baseOrder * c
                const baseVertexIndexIndex = vertexIndexCount * c
                const additionalConnectedIndex = c % connectedCount + Math.floor(c / connectedCount) * 6
                for (let i = 0; i < vertexIndexCount; i++) {
                    connectedIndexMap[baseVertexIndexIndex + i] = connectedIndexMap[i]! + additionalConnectedIndex
                }

                const baseLineIndex = lineCount * c
                for (let i = 0; i < lineCount; i++) {
                    const { index1, index2, connectedIndex } = edges[i]!
                    edges[baseLineIndex + i] = {
                        index1: index1 + baseIndex,
                        index2: index2 + baseIndex,
                        connectedIndex: connectedIndex + additionalConnectedIndex,
                    }
                }

                const baseFaceIndex = faceCount * c
                for (let i = 0; i < faceCount; i++) {
                    const face = faces[i]!
                    faces[baseFaceIndex + i] = {
                        colorIndex: face.colorIndex,
                        connectedIndex: face.connectedIndex + additionalConnectedIndex,
                        faceIndexes: face.faceIndexes.map(f => f.map(v => v + baseIndex)),
                    }
                }
            }
        }

        this.vertexConnectedIndexes = connectedIndexMap as number[]
        this.edges = edges
        this.units = faces
        this.setOrigin([0, 0, 1])
    }

    #isExisting(existing: CoxeterGroupElement[], element: CoxeterGroupElement): boolean {
        for (const ex of existing) {
            if (ex.index === element.index || ex.mul(element).index === 0) {
                return true
            }
        }

        return false
    }

    getEdgeGenerators(): { lengths: Quaternion[], additionalLengths: Quaternion[] } {
        const result: CoxeterGroupElement[] = []
        for (const face of this.#faceDefinitions) {
            for (const element of face) {
                if (!this.#isExisting(result, element)) {
                    result.push(element)
                }
            }
        }

        return {
            lengths: result.map((e) => this.symmetryGroup.transforms[e.index]!),
            additionalLengths: result.length <= 2 ? this.#additionalLengths.map((e) => this.symmetryGroup.transforms[e.index]!) : []
        }
    }

    getGeneratorTransform(generatorIndex: number) {
        return this.symmetryGroup.transforms[this.generators[generatorIndex]!.index]!
    }

    // maxRatio = 0.8
    setOrigin(newOrigin: Vector): void {
        for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
            Quaternions.transform(newOrigin, this.symmetryGroup.transforms[i]!, this.vertexes[i])
        }

        for (let c = this.#compoundTransforms.length - 1; c >= 0; c--) {
            let baseIndex = c * this.symmetryGroup.transforms.length
            const cTransform = this.#compoundTransforms[c]!
            for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
                Quaternions.transform(this.vertexes[i]!, cTransform, this.vertexes[baseIndex + i])
            }
        }

        /*
        // SnubPoints 計測用
        let minimum = 4
        let maximum = 0
        for (const face of this.faceDefinitions) {
            for (const element of face) {
                const distance = Vectors.distanceSquared(this.vertexes[0]!, this.vertexes[element.index]!)
                minimum = Math.min(minimum, distance)
                maximum = Math.max(maximum, distance)
            }
        }
        const ratio = Math.sqrt(minimum / maximum)
        if (this.maxRatio < ratio) {
            this.maxRatio = ratio
            console.log(ratio)
            console.log(`[${newOrigin[0]}, ${newOrigin[1]}, ${newOrigin[2]}]`)
        }
        // */
    }
}

export const unitTriangles: PolyhedronSource[] = function (): PolyhedronSource[] {
    const createSymmetry = (p: number, q: number): SymmetryGroup3 => new SymmetryGroup3(new FiniteCoxeterGroup(CoxeterMatrix.create3D(p, q)))
    const compound = (source: PolyhedronSource[], transforms: Quaternion[]): PolyhedronSource[] => source.map<PolyhedronSource>(f => ({
        id: `c${transforms.length}${f.id}`,
        unit: f.unit,
        name: `${transforms.length}×[${f.name}]`,
        compoundTransforms: transforms,
    }))

    const symmetryA = createSymmetry(3, 3)
    const symmetryB = createSymmetry(3, 4)
    const symmetryH = createSymmetry(3, 5)
    const symmetryP2 = createSymmetry(2, 2)
    const symmetryP3 = createSymmetry(2, 3)
    const symmetryP4 = createSymmetry(2, 4)
    const symmetryP5 = createSymmetry(2, 5)
    const symmetryP6 = createSymmetry(2, 6)
    const symmetryP7 = createSymmetry(2, 7)

    const aSources: PolyhedronSource[] = [
        { id: "a00", name: "3 3 2", unit: symmetryA.getDefaultGenerators() },
        { id: "a01", name: "3 3 3'", unit: symmetryA.getGenerators(13, 2, 1) },
    ]
    const bSources: PolyhedronSource[] = [
        { id: "b00", name: "4 3 2", unit: symmetryB.getDefaultGenerators() },
        { id: "b01", name: "4 4 3'", unit: symmetryB.getGenerators(13, 2, 1) },
    ]
    const hSources: PolyhedronSource[] = [
        { id: "h00", name: "5 3 2", unit: symmetryH.getDefaultGenerators() },
        { id: "h01", name: "5/2 3 2", unit: symmetryH.getGenerators(83, 1, 2) },
        { id: "h02", name: "5 5/2 2", unit: symmetryH.getGenerators(3, 13, 1) },
    ]
    const p2Sources = [
        { id: "p21", name: "2 2 2", unit: symmetryP2.getDefaultGenerators() },
    ]
    const p3Sources = [
        { id: "p31", name: "3 2 2", unit: symmetryP3.getDefaultGenerators() },
    ]
    const p4Sources = [
        { id: "p41", name: "4 2 2", unit: symmetryP4.getDefaultGenerators() },
    ]
    const p5Sources = [
        { id: "p51", name: "5 2 2", unit: symmetryP5.getDefaultGenerators() },
        { id: "p52", name: "5/2 2 2", unit: symmetryP5.getGenerators(11, 2, 1) },
    ]
    const p6Sources = [
        { id: "p61", name: "6 2 2", unit: symmetryP6.getDefaultGenerators() },
    ]
    const rotate90 = Quaternions.rotation([0, 0, 1], Math.PI / 2)
    const rotate45 = Quaternions.rotation([0, 0, 1], Math.PI / 4)
    const rotateN45 = Quaternions.rotation([0, 0, 1], Math.PI / -4)

    return [
        ...aSources,
        ...bSources,
        ...hSources,
        { id: "h03", name: "5 3 3'", unit: symmetryH.getGenerators(28, 2, 1) },
        { id: "h04", name: "5/2 3 3", unit: symmetryH.getGenerators(15, 2, 1) },
        { id: "h05", name: "5 5 3'", unit: symmetryH.getGenerators(2, 13, 1) },
        { id: "h06", name: "5 5/2 3'", unit: symmetryH.getGenerators(2, 33, 1) },
        { id: "h07", name: "5/2 5/2 3'", unit: symmetryH.getGenerators(2, 99, 1) },
        { id: "h08", name: "5 5 5'", unit: symmetryH.getGenerators(28, 3, 2) },
        { id: "h09", name: "5/2 5/2 5/2", unit: symmetryH.getGenerators(26, 13, 3) },

        ...p2Sources,
        ...p3Sources,
        ...p4Sources,
        ...p5Sources,
        ...p6Sources,
        { id: "p71", name: "7 2 2", unit: symmetryP7.getDefaultGenerators() },
        { id: "p72", name: "7/2 2 2", unit: symmetryP7.getGenerators(11, 2, 1) },
        { id: "p73", name: "7/3 2 2", unit: symmetryP7.getGenerators(19, 2, 1) },

        // 立方体対称の複合多面体
        ...compound(aSources, symmetryB.getTransforms([0, 8], symmetryB.getMirrorRotator(2, 1))),
        ...compound(hSources, symmetryB.getTransforms([0, 8], symmetryB.getMirrorRotator(2, 1))),
        // 正12面体体対称の複合多面体
        ...compound(aSources, symmetryH.getTransforms([0, 7, 22, 24, 8], rotate45)),
        ...compound(bSources, symmetryH.getTransforms([0, 7, 22, 24, 8], symmetryB.getMirrorRotator(1, 2))),
        ...compound(hSources, symmetryH.getTransforms([0, 7, 22, 24, 8], rotate90)),
        ...compound(aSources, [
            ...symmetryH.getTransforms([0, 7, 22, 24, 8], rotate45),
            ...symmetryH.getTransforms([0, 7, 22, 24, 8], rotateN45),
        ]),
    ]
}()

export type FaceSelectorFunction = (
    a: CoxeterGroupElement,
    b: CoxeterGroupElement,
    c: CoxeterGroupElement,
    g: SymmetryGroup3) => {
        elements: CoxeterGroupElement[][]
        additionalElements?: CoxeterGroupElement[] | undefined
        mirrorImageReflector?: CoxeterGroupElement | undefined
    }

export const faceSelectorMap = function (): Map<string, FaceSelectorFunction> {
    function rotateP(f: FaceSelectorFunction): FaceSelectorFunction {
        return (a, b, c, g) => {
            const { elements, additionalElements, mirrorImageReflector } = f(b, c, a, g)
            return {
                mirrorImageReflector,
                additionalElements,
                elements: [
                    elements[2]!,
                    elements[0]!,
                    elements[1]!,
                    ...elements.slice(3),
                ]
            }
        }
    }

    function rotateQ(f: FaceSelectorFunction): FaceSelectorFunction {
        return (a, b, c, g) => {
            const { elements, additionalElements, mirrorImageReflector } = f(c, a, b, g)
            return {
                mirrorImageReflector,
                additionalElements,
                elements: [
                    elements[1]!,
                    elements[2]!,
                    elements[0]!,
                    ...elements.slice(3),
                ]
            }
        }
    }

    const ionicFaceSelector: FaceSelectorFunction = (a, b, c) => {
        const aba = a.mul(b).mul(a)
        const aca = a.mul(c).mul(a)
        return {
            additionalElements: [a, b.mul(c)], elements: [[aba, b], [b, c], [aca, c], [aba, aca]],
            mirrorImageReflector: a,
        }
    }

    const halfFaceSelector: FaceSelectorFunction = (a, b, c) => {
        const bab = b.mul(a).mul(b)
        const cac = c.mul(a).mul(c)
        const bc = b.mul(c)
        const cb = c.mul(b)
        return {
            additionalElements: [b, c], elements: [[a, bab], [bc], [a, cac], [cac, cb, bab, bc]],
            mirrorImageReflector: b,
        }
    }

    const halfIonicFaceSelector: FaceSelectorFunction = (a, b, c) => {
        const ab = a.mul(b)
        const bc = b.mul(c)
        const ca = c.mul(a)
        const caca = ca.mul(ca)
        const abab = ab.mul(ab)
        const acba = a.mul(c).mul(b).mul(a)
        return { elements: [[abab], [bc], [caca], [caca, acba, abab, bc], [acba]] }
    }

    function getCompoundElements(a: CoxeterGroupElement, b: CoxeterGroupElement, group: SymmetryGroup3) {
        const period = a.mul(b).period
        let frontToBack = group.getMaxElement()
        let backToFront = frontToBack
        const oppositeA = frontToBack.mul(frontToBack.rank % 2 === 1 ? a : b).mul(frontToBack)
        const oppositeB = frontToBack.mul(frontToBack.rank % 2 === 1 ? b : a).mul(frontToBack)
        const generators = [oppositeA, oppositeB]
        for (let i = 0; i < period; i++) {
            frontToBack = frontToBack.mul(generators[i % 2]!)
            backToFront = generators[i % 2]!.mul(backToFront)
        }
        return { oppositeA, oppositeB, frontToBack, backToFront }
    }

    const compoundFaceSelector: FaceSelectorFunction = (a, b, _, group) => {
        const { oppositeA, oppositeB, frontToBack, backToFront } = getCompoundElements(a, b, group)
        if (frontToBack.rank % 2 === 0) {
            // 対面同士が180°回転 (反角柱型)
            return { elements: [[a, b], [], [], [a, frontToBack, oppositeB, backToFront]] }
        } else {
            // 対面同士が平行移動したもの (角柱型)
            return { elements: [[a, b], [b, frontToBack, oppositeB, backToFront], [a, frontToBack, oppositeA, backToFront]] }
        }
    }

    const compoundChiralFaceSelector1: FaceSelectorFunction = (a, b, _, group) => {
        const { oppositeA, oppositeB, frontToBack, backToFront } = getCompoundElements(a, b, group)
        const ab = a.mul(b)
        if (frontToBack.rank % 2 === 0) {
            // 対面同士が180°回転 (反角柱型)
            return {
                additionalElements: [frontToBack.mul(ab), ab.mul(backToFront)],
                elements: [[ab], [], [], [ab, frontToBack, oppositeA.mul(oppositeB), backToFront]],
            }
        } else {
            // 対面同士が平行移動したもの (角柱型)
            return { elements: [[ab], [], [], [ab, b.mul(frontToBack), backToFront.mul(oppositeA)]] }
        }
    }

    const compoundChiralFaceSelector2: FaceSelectorFunction = (a, b, _, group) => {
        const { oppositeA, frontToBack, backToFront } = getCompoundElements(a, b, group)
        const ab = a.mul(b)
        if (frontToBack.rank % 2 === 0) {
            // 対面同士が180°回転 (反角柱型)
            return {
                additionalElements: [frontToBack.mul(ab), ab.mul(backToFront)],
                elements: [[ab], [], [], [ab, frontToBack, backToFront.mul(b).mul(a)]],
            }
        } else {
            // 対面同士が平行移動したもの (角柱型)
            return { elements: [[ab], [], [], [ab, b.mul(frontToBack), backToFront.mul(oppositeA)]] }
        }
    }

    const compoundHalfFaceSelector: FaceSelectorFunction = (a, b, _, group) => {
        const { oppositeA, oppositeB, frontToBack, backToFront } = getCompoundElements(a, b, group)
        const ab = a.mul(b)
        if (frontToBack.rank % 2 === 0) {
            // 対面同士が180°回転 (反角柱型)
            return {
                additionalElements: [a, b],
                mirrorImageReflector: a,
                elements: [[ab], [], [], [ab, oppositeB.mul(frontToBack), backToFront.mul(oppositeA)]],
            }
        } else {
            // 対面同士が平行移動したもの (角柱型)
            return {
                additionalElements: [a, b],
                mirrorImageReflector: a,
                elements: [[ab], [], [], [ab, frontToBack, oppositeB.mul(oppositeA), backToFront]],
            }
        }
    }

    return new Map<string, FaceSelectorFunction>([
        ["xxx", (a, b, c) => ({ elements: [[a, b], [b, c], [c, a]] })],
        ["ooo", (a, b, c) => {
            const ab = a.mul(b)
            const bc = b.mul(c)
            const ca = c.mul(a)
            return { elements: [[ab], [bc], [ca], [ab, bc, ca]] }
        }],
        ["oxx", ionicFaceSelector],
        ["xox", rotateP(ionicFaceSelector)],
        ["xxo", rotateQ(ionicFaceSelector)],
        ["xoo", halfFaceSelector],
        ["oxo", rotateP(halfFaceSelector)],
        ["oox", rotateQ(halfFaceSelector)],
        ["opp", halfIonicFaceSelector],
        ["pop", rotateP(halfIonicFaceSelector)],
        ["ppo", rotateQ(halfIonicFaceSelector)],
        ["xxd", compoundFaceSelector],
        ["dxx", rotateP(compoundFaceSelector)],
        ["xdx", rotateQ(compoundFaceSelector)],
        ["ood", compoundChiralFaceSelector1],
        ["ooe", compoundChiralFaceSelector2],
        ["doo", rotateP(compoundChiralFaceSelector1)],
        ["eoo", rotateP(compoundChiralFaceSelector2)],
        ["odo", rotateQ(compoundChiralFaceSelector1)],
        ["oeo", rotateQ(compoundChiralFaceSelector2)],
        ["ppd", compoundHalfFaceSelector],
        ["dpp", rotateP(compoundHalfFaceSelector)],
        ["pdp", rotateQ(compoundHalfFaceSelector)],
        ["oooo", (a, b, c) => {
            const cb = c.mul(b)
            const ba = b.mul(a)
            const ca = c.mul(a)
            const ac = a.mul(c)
            const cbDash = ca.mul(cb).mul(ac)
            const baDash = ac.mul(ba).mul(ca)
            return { elements: [[ba], [baDash], [cb], [cb, ba, cbDash, baDash], [cbDash]] }
        }],
        ["oddd", (a, b, c) => {
            const ab = a.mul(b)
            const cb = c.mul(b)
            const ba = b.mul(a)
            const ca = c.mul(a)
            const ac = a.mul(c)
            const cbDash = ca.mul(cb).mul(ac)
            const baDash = ac.mul(ba).mul(ca)
            const antiCb = ab.mul(ac).mul(ab).mul(ca)
            return {
                elements: [[], [cb], [cb, ba, cbDash, baDash], [baDash, ba, antiCb]],
            }
        }]
    ])
}()
