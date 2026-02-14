import { CoxeterMatrix } from "./coxeter_matrix.js";
import { FiniteCoxeterGroup, CoxeterGroupElement } from "./coxeter_group.js";
import { Vector, Vectors } from "./vector.js";
import { Quaternion, Quaternions } from "./quaternion.js";
import { IPolyhedron } from "./model.js";

export interface ISymmetryGroup3 {
    readonly transforms: Quaternion[]
    readonly order: number
    getElement(index: number): CoxeterGroupElement
}

export class SymmetryGroup3 {
    transforms: Quaternion[]
    #coxeterGroup: FiniteCoxeterGroup
    constructor(
        // コクセター群 (3次元対称群に対応)
        coxeterGroup: FiniteCoxeterGroup,
    ) {
        this.#coxeterGroup = coxeterGroup
        const cosP = Math.cos(Math.PI / coxeterGroup.matrix.get(0, 1))
        const cosQ = Math.cos(Math.PI / coxeterGroup.matrix.get(1, 2))
        const cos2P = cosP * cosP
        const cos2Q = cosQ * cosQ
        const z = Math.sqrt(1 - cos2P - cos2Q)
        const mirrors = [
            Quaternions.mirror([1, 0, 0]),
            Quaternions.mirror([-cosP, -cosQ, z]),
            Quaternions.mirror([0, 1, 0]),
        ]
        // this.origin = Vectors.normalize([z, z, 1 + cosP + cosQ])
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

    get order(): number {
        return this.#coxeterGroup.order
    }

    getElement(index: number): CoxeterGroupElement {
        return this.#coxeterGroup.elements[index]!
    }

    getMaxElement(): CoxeterGroupElement {
        return this.#coxeterGroup.ranks[this.#coxeterGroup.ranks.length - 1]![0]!
    }

    getDefaultGenerators(): UnitTriangle {
        return this.getGenerators(3, 2, 1)
    }

    getGenerators(a: number, b: number, c: number): UnitTriangle {
        return {
            symmetryGroup: this,
            generators: [
                this.#coxeterGroup.elements[a]!,
                this.#coxeterGroup.elements[b]!,
                this.#coxeterGroup.elements[c]!,
            ]

        }
    }

    #getMirrorCross(index: number): Vector {
        const a = this.transforms[index % 3 + 1]!
        const b = this.transforms[(index + 1) % 3 + 1]!
        const v = [
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x,
        ]
        Vectors.normalizeSelf(v)
        return v
    }

    // 基本となる3枚の鏡を互いに映し合うための鏡となる四元数を生成する
    getMirrorRotator(fromIndex: number, toIndex: number): Quaternion {
        const fromVector = this.#getMirrorCross(fromIndex)
        const toVector = this.#getMirrorCross(toIndex)
        return Quaternions.fromTo(fromVector, toVector)
    }

    getTransforms(indexes: number[], preTransform?: Quaternion): Quaternion[] {
        if (preTransform) {
            return indexes.map(i => Quaternions.mul(this.transforms[i]!, preTransform))
        }
        return indexes.map(i => this.transforms[i]!)
    }
}

export type UnitTriangle = {
    symmetryGroup: SymmetryGroup3
    generators: CoxeterGroupElement[]
}

export type PolyhedronSource = {
    id: string
    name: string
    unit: UnitTriangle
    snubPoints?: Vector[] | undefined
    compoundTransforms?: Quaternion[] | undefined
}

export const unitTriangles: PolyhedronSource[] = function (): PolyhedronSource[] {
    const createSymmetry = (p: number, q: number): SymmetryGroup3 => new SymmetryGroup3(new FiniteCoxeterGroup(CoxeterMatrix.create3D(p, q)))
    const compound = (source: PolyhedronSource[], transforms: Quaternion[]): PolyhedronSource[] => source.map<PolyhedronSource>(f => ({
        id: `c${transforms.length}${f.id}`,
        unit: f.unit,
        name: `${transforms.length}×[${f.name}]`,
        snubPoints: f.snubPoints,
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
    const symmetryP10 = createSymmetry(2, 10)

    const aSources: PolyhedronSource[] = [
        { id: "a00", name: "3 3 2", unit: symmetryA.getDefaultGenerators(), snubPoints: [[0.3719739026214218, 0.3711063250059786, 0.8508322462795742], [-0.6016644209754163, -0.6013068195365014, 0.5257661393730243]] },
        { id: "a01", name: "3 3 3'", unit: symmetryA.getGenerators(13, 2, 1) },
    ]
    const bSources: PolyhedronSource[] = [
        { id: "b00", name: "4 3 2", unit: symmetryB.getDefaultGenerators(), snubPoints: [[0.274529843297775, 0.2514828934900627, 0.9281108335865738]] },
        { id: "b01", name: "4 4 3'", unit: symmetryB.getGenerators(13, 2, 1) },
    ]
    const hSources: PolyhedronSource[] = [
        { id: "h00", name: "5 3 2", unit: symmetryH.getDefaultGenerators(), snubPoints: [[0.17362276702464857, 0.1532781551762212, 0.9728108459081235]] },
        { id: "h01", name: "5/2 3 2", unit: symmetryH.getGenerators(83, 1, 2), snubPoints: [[0.2934737350596348, -0.34884613790107505, 0.890044683654507], [-0.9062343791439471, -0.3502908195091824, 0.236718380835055], [-0.5879050866151723, 0.7896142609307613, 0.17571832023660608]] },
        { id: "h02", name: "5 5/2 2", unit: symmetryH.getGenerators(3, 13, 1), snubPoints: [[0.2441220393050724, 0.30667128071226984, 0.919976714657403], [0.1868151186710511, -0.55662847504144, 0.8094843125156671]] },
    ]
    const p2Sources = [
        { id: "p21", name: "2 2 2", unit: symmetryP2.getDefaultGenerators() },
    ]
    const p3Sources = [
        { id: "p31", name: "3 2 2", unit: symmetryP3.getDefaultGenerators(), snubPoints: [[-0.5771802530924266, 0.40832752047197346, 0.7071998242826227], [0.5771802530924266, 0.40832752047197346, 0.7071998242826227]] },
    ]
    const p4Sources = [
        { id: "p41", name: "4 2 2", unit: symmetryP4.getDefaultGenerators(), snubPoints: [[-0.5111347434249403, 0.3286316758425271, 0.7941929839131373], [0.5111347434249403, 0.3286316758425271, 0.7941929839131373]] },
    ]
    const p5Sources = [
        { id: "p51", name: "5 2 2", unit: symmetryP5.getDefaultGenerators(), snubPoints: [[-0.44660623733507715, 0.2765531581360969, 0.8509178688324484], [0.44660623733507715, 0.2765531581360969, 0.8509178688324484]] },
        { id: "p52", name: "5/2 2 2", unit: symmetryP5.getGenerators(11, 2, 1), snubPoints: [[-0.5987426743493759, 0.0002110478231757374, 0.8009414244323824], [0.5987426743493759, 0.0002110478231757374, 0.8009414244323824], [-0.44711653107453697, -0.8944757166111083, 0.000005737334089724187], [0.44711653107453697, -0.8944757166111083, 0.000005737334089724187]] },
    ]
    const p6Sources = [
        { id: "p61", name: "6 2 2", unit: symmetryP6.getDefaultGenerators(), snubPoints: [[-0.3931935908064074, 0.23786331464090538, 0.8881553038161767], [0.3931935908064074, 0.23786331464090538, 0.8881553038161767]] },
    ]
    const p10Sources = [
        { id: "px1", name: "10 2 2", unit: symmetryP10.getDefaultGenerators(), snubPoints: [[-0.2578736359424642, 0.1511515095222257, 0.9542821433176699], [0.2578736359424642, 0.1511515095222257, 0.9542821433176699]] },
        { id: "px2", name: "10/3 2 2", unit: symmetryP10.getGenerators(19, 2, 1), snubPoints: [[-0.5560948813996377, -0.12974124631273248, 0.8209297728102823], [0.5560948813996377, -0.12974124631273248, 0.8209297728102823]] },
    ]
    const rotate90 = Quaternions.rotation([0, 0, 1], Math.PI / 2)
    const rotate45 = Quaternions.rotation([0, 0, 1], Math.PI / 4)
    const rotateN45 = Quaternions.rotation([0, 0, 1], Math.PI / -4)

    return [
        ...aSources,
        ...bSources,
        ...hSources,
        { id: "h03", name: "5 3 3'", unit: symmetryH.getGenerators(28, 2, 1) },
        { id: "h04", name: "5/2 3 3", unit: symmetryH.getGenerators(15, 2, 1), snubPoints: [[0.1842680470996585, 0.0002323682813360037, 0.9828760007361356], [-0.9934037311234103, 0.0006531253985034092, 0.11466734677884965]] },
        { id: "h05", name: "5 5 3'", unit: symmetryH.getGenerators(2, 13, 1) },
        { id: "h06", name: "5 5/2 3'", unit: symmetryH.getGenerators(2, 33, 1), snubPoints: [[0.09453035692186709, -0.16374423004893354, 0.9819632573298791]] },
        { id: "h07", name: "5/2 5/2 3'", unit: symmetryH.getGenerators(2, 99, 1), snubPoints: [[0.5839708202463768, -0.32701548905717087, 0.7429932375314551], [-0.20197213592544647, 0.9450410298772749, 0.25710835878713195]] },
        { id: "h08", name: "5 5 5'", unit: symmetryH.getGenerators(28, 3, 2) },
        { id: "h09", name: "5/2 5/2 5/2", unit: symmetryH.getGenerators(26, 13, 3) },

        ...p2Sources,
        ...p3Sources,
        ...p4Sources,
        ...p5Sources,
        ...p6Sources,
        { id: "p71", name: "7 2 2", unit: symmetryP7.getDefaultGenerators(), snubPoints: [[-0.34915940259840533, 0.2083295343698897, 0.9136117975849204], [0.34915940259840533, 0.2083295343698897, 0.9136117975849204]] },
        { id: "p72", name: "7/2 2 2", unit: symmetryP7.getGenerators(11, 2, 1), snubPoints: [[-0.5455983391838306, 0.0002153961070602594, 0.8380467802481928], [0.5455983391838306, 0.0002153961070602594, 0.8380467802481928]] },
        { id: "p73", name: "7/3 2 2", unit: symmetryP7.getGenerators(19, 2, 1), snubPoints: [[-0.5994232712396262, -0.1779700836642542, 0.7803963039487846], [0.5994232712396262, -0.1779700836642542, 0.7803963039487846], [-0.5034145899510695, 0.8423776194324194, 0.19228545681815487], [0.5034145899510695, 0.8423776194324194, 0.19228545681815487]] },

        // 立方体対称の複合多面体
        ...compound(aSources, symmetryB.getTransforms([0, 8], symmetryB.getMirrorRotator(2, 1))),
        ...compound(hSources, symmetryB.getTransforms([0, 8], symmetryB.getMirrorRotator(2, 1))),
        ...compound(p4Sources, symmetryB.getTransforms([0, 4, 6], Quaternions.mul(symmetryB.getMirrorRotator(2, 1), symmetryP4.getMirrorRotator(1, 2)))),
        ...compound(p6Sources, symmetryB.getTransforms([0, 7, 8, 22], Quaternions.mul(symmetryB.getMirrorRotator(2, 3), Quaternions.mul(rotate90, symmetryP6.getMirrorRotator(1, 2))))),
        ...compound(p2Sources, symmetryB.getTransforms([0, 4, 6, 8, 17, 20], symmetryB.getMirrorRotator(2, 1))),
        // 正12面体体対称の複合多面体
        ...compound(aSources, symmetryH.getTransforms([0, 7, 22, 24, 8], rotate45)),
        ...compound(bSources, symmetryH.getTransforms([0, 7, 22, 24, 8], symmetryB.getMirrorRotator(1, 2))),
        ...compound(hSources, symmetryH.getTransforms([0, 7, 22, 24, 8], rotate90)),
        ...compound(p10Sources, symmetryH.getTransforms([0, 4, 6, 18, 21, 46], Quaternions.mul(symmetryH.getMirrorRotator(2, 1), symmetryP5.getMirrorRotator(1, 2)))),
        ...compound(p6Sources, symmetryH.getTransforms([0, 5, 23, 22, 7, 42, 16, 19, 37, 38], Quaternions.mul(symmetryH.getMirrorRotator(2, 3), Quaternions.mul(rotate90, symmetryP6.getMirrorRotator(1, 2))))),
        ...compound(aSources, [
            ...symmetryH.getTransforms([0, 7, 22, 24, 8], rotate45),
            ...symmetryH.getTransforms([0, 7, 22, 24, 8], rotateN45),
        ]),
        ...compound(p2Sources, symmetryH.getTransforms([0, 4, 6, 8, 18, 43, 24, 39, 17, 21, 44, 40, 46, 20, 36])),
    ]
}()

export type FaceSelectorFunction = (
    a: CoxeterGroupElement,
    b: CoxeterGroupElement,
    c: CoxeterGroupElement,
    g: SymmetryGroup3) => CoxeterGroupElement[][]

function rotateP(f: FaceSelectorFunction): FaceSelectorFunction {
    return (a, b, c, g) => {
        const result = f(b, c, a, g)
        return [
            result[2]!,
            result[0]!,
            result[1]!,
            ...result.slice(3),
        ]
    }
}

function rotateQ(f: FaceSelectorFunction): FaceSelectorFunction {
    return (a, b, c, g) => {
        const result = f(c, a, b, g)
        return [
            result[1]!,
            result[2]!,
            result[0]!,
            ...result.slice(3),
        ]
    }
}

const ionicFaceSelector: FaceSelectorFunction = (a, b, c) => {
    const aba = a.mul(b).mul(a)
    const aca = a.mul(c).mul(a)
    return [[aba, b], [b, c], [aca, c], [aba, aca]]
}

const halfFaceSelector: FaceSelectorFunction = (a, b, c) => {
    const bab = b.mul(a).mul(b)
    const cac = c.mul(a).mul(c)
    const bc = b.mul(c)
    const cb = c.mul(b)
    return [[a, bab], [bc], [a, cac], [cac, cb, bab, bc]]
}

const halfIonicFaceSelector: FaceSelectorFunction = (a, b, c) => {
    const ab = a.mul(b)
    const bc = b.mul(c)
    const ca = c.mul(a)
    const caca = ca.mul(ca)
    const abab = ab.mul(ab)
    const acba = a.mul(c).mul(b).mul(a)
    return [[abab], [bc], [caca], [caca, acba, abab, bc], [acba]]
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
        return [[a, b], [], [], [a, frontToBack, oppositeB, backToFront]]
    } else {
        // 対面同士が平行移動したもの (角柱型)
        return [[a, b], [b, frontToBack, oppositeB, backToFront], [a, frontToBack, oppositeA, backToFront]]
    }
}

const compoundChiralFaceSelector: FaceSelectorFunction = (a, b, _, group) => {
    const { oppositeA, oppositeB, frontToBack, backToFront } = getCompoundElements(a, b, group)
    const ab = a.mul(b)
    if (frontToBack.rank % 2 === 0) {
        // 対面同士が180°回転 (反角柱型)
        return [[ab], [], [], [ab, frontToBack, oppositeA.mul(oppositeB), backToFront]]
    } else {
        // 対面同士が平行移動したもの (角柱型)
        return [[ab], [], [], [ab, b.mul(frontToBack), backToFront.mul(oppositeA)]]
    }
}

const compoundHalfFaceSelector: FaceSelectorFunction = (a, b, _, group) => {
    const { oppositeA, oppositeB, frontToBack, backToFront } = getCompoundElements(a, b, group)
    const ab = a.mul(b)
    if (frontToBack.rank % 2 === 0) {
        // 対面同士が180°回転 (反角柱型)
        return [[ab], [], [], [ab, oppositeB.mul(frontToBack), backToFront.mul(oppositeA)]]
    } else {
        // 対面同士が平行移動したもの (角柱型)
        return [[ab], [], [], [ab, frontToBack, oppositeB.mul(oppositeA), backToFront]]
    }
}

export const faceSelectorMap = new Map<string, FaceSelectorFunction>([
    ["xxx", (a, b, c) => [[a, b], [b, c], [c, a]]],
    ["ooo", (a, b, c) => {
        const ab = a.mul(b)
        const bc = b.mul(c)
        const ca = c.mul(a)
        return [[ab], [bc], [ca], [ab, bc, ca]]
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
    ["ood", compoundChiralFaceSelector],
    ["doo", rotateP(compoundChiralFaceSelector)],
    ["odo", rotateQ(compoundChiralFaceSelector)],
    ["ppd", compoundHalfFaceSelector],
    ["dpp", rotateP(compoundHalfFaceSelector)],
    ["pdp", rotateQ(compoundHalfFaceSelector)],
    ["oooo", (a, b, c) => {
        const ab = c.mul(b)
        const bc = b.mul(a)
        const ac = c.mul(a)
        const ca = a.mul(c)
        const abDash = ac.mul(ab).mul(ca)
        const bcDash = ca.mul(bc).mul(ac)
        return [[bc], [bcDash], [ab], [ab, bc, abDash, bcDash], [abDash]]
    }],
])

export type PolyhedronFace = {
    colorIndex: number
    connectedIndex: number
    vertexIndexes: number[]
}

export type PolyhedronEdge = {
    connectedIndex: number
    index1: number
    index2: number
}

export class NormalPolyhedron implements IPolyhedron {
    #compoundTransforms: Quaternion[]
    vertexes: Vector[]
    vertexConnectedIndexes: number[]
    edges: PolyhedronEdge[]
    faces: PolyhedronFace[]
    symmetryGroup: ISymmetryGroup3
    generators: CoxeterGroupElement[]
    #faceDefinitions: CoxeterGroupElement[][]
    snubPoints: Vector[] | undefined

    constructor(
        source: UnitTriangle,
        snubPoints: Vector[] | undefined,
        faceSelector: FaceSelectorFunction,
        compoundTransforms?: Quaternion[],
    ) {
        const vertexCount = source.symmetryGroup.order * (compoundTransforms?.length || 1)
        const connectedIndexMap = new Array<number | undefined>(vertexCount)
        this.vertexes = new Array<Vector>(vertexCount)
        this.symmetryGroup = source.symmetryGroup
        this.generators = source.generators
        this.#compoundTransforms = compoundTransforms ?? []
        this.snubPoints = snubPoints
        const faceDefinitions = faceSelector(source.generators[0]!, source.generators[1]!, source.generators[2]!, source.symmetryGroup)
            .map(f => f.filter(e => e.period > 1))
        this.#faceDefinitions = faceDefinitions
        const maxElement = source.symmetryGroup.getMaxElement()
        const isCentrosymmetry = maxElement.rank % 2 === 1

        // 頂点ごとの連結成分ID
        // 連結成分Idへのマップ
        let connectedIndex = 0
        let isHalf: boolean | null = null
        for (let i = 0; i < source.symmetryGroup.order; i++) {
            if (connectedIndexMap[i] !== undefined || (isCentrosymmetry && source.symmetryGroup.getElement(i).rank % 2 === 1)) continue

            const vertexIndexes = [i]
            connectedIndexMap[i] = connectedIndex
            for (let j = 0; j < vertexIndexes.length; j++) {
                const currentIndex = vertexIndexes[j]!
                const currentElement = source.symmetryGroup.getElement(currentIndex)
                for (const faceDef of faceDefinitions) {
                    for (const edgeElement of faceDef) {
                        const otherIndex = currentElement.mul(edgeElement).index
                        if (connectedIndexMap[otherIndex] === undefined) {
                            connectedIndexMap[otherIndex] = connectedIndexMap[currentIndex] ?? 0
                            vertexIndexes.push(otherIndex)
                        }
                    }
                }
            }

            if (vertexIndexes.length >= source.symmetryGroup.order) break
            isHalf ??= vertexIndexes.length >= source.symmetryGroup.order / 2

            // 鏡像が分かれている図形は、鏡像を holosnub 限定図形にする
            if (isCentrosymmetry && connectedIndexMap[source.symmetryGroup.getElement(i).mul(maxElement).index] === undefined) {
                for (const j of vertexIndexes) {
                    connectedIndexMap[source.symmetryGroup.getElement(j).mul(maxElement).index] ??= connectedIndex + (isHalf ? 31 : 30)
                }
            }

            connectedIndex += compoundTransforms ? 30 : isHalf ? 31 : 1
        }

        // 辺の生成
        const lineSet = new Map<number, { connectedIndex: number, vertexes: Set<number> }>()
        for (let currentIndex = 0; currentIndex < source.symmetryGroup.order; currentIndex++) {
            const element = source.symmetryGroup.getElement(currentIndex)
            for (const faceDef of faceDefinitions) {
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
        for (let mirrorA = 0; mirrorA < faceDefinitions.length; mirrorA++) {
            const faceDef = faceDefinitions[mirrorA]!
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
                        vertexIndexes: faceVertexIndexes,
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
                        vertexIndexes: face.vertexIndexes.map(v => v + baseIndex),
                    }
                }
            }
        }

        this.vertexConnectedIndexes = connectedIndexMap as number[]
        this.edges = edges
        this.faces = faces
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

    getEdgeGenerators(): Quaternion[] {
        const result: CoxeterGroupElement[] = []
        for (const face of this.#faceDefinitions) {
            for (const element of face) {
                if (!this.#isExisting(result, element)) {
                    result.push(element)
                }
            }
        }

        return result.map((e) => this.symmetryGroup.transforms[e.index]!)
    }

    getGeneratorTransform(generatorIndex: number) {
        return this.symmetryGroup.transforms[this.generators[generatorIndex]!.index]!
    }

    // maxRatio = 0.8
    setOrigin(newOrigin: Vector): void {
        for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
            this.vertexes[i] = Quaternions.transform(newOrigin, this.symmetryGroup.transforms[i]!)
        }

        for (let c = this.#compoundTransforms.length - 1; c >= 0; c--) {
            let baseIndex = c * this.symmetryGroup.transforms.length
            const cTransform = this.#compoundTransforms[c]!
            for (let i = 0; i < this.symmetryGroup.transforms.length; i++) {
                this.vertexes[baseIndex + i] = Quaternions.transform(this.vertexes[i]!, cTransform)
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
