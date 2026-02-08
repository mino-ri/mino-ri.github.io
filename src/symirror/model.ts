import { Vector, Vectors } from "./vector.js"
import { PolyhedronMesh } from "./gpu.js"

// カラーマッピング: colorIndex -> RGB
const faceColors: [number, number, number][] = [
    [1.00, 0.85, 0.00], // 0: 黄
    [1.00, 0.30, 0.04], // 1: 赤
    [0.01, 0.68, 0.35], // 2: 緑
    [0.00, 0.44, 1.00], // 3: 青
    [0.25, 0.88, 1.00], // 4: 空
    [0.75, 0.10, 0.95], // 5: 空
]

const crosses: { value: Vector | null, source: Vector }[] = [
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
]

const ball = function () {
    const phi = (Math.sqrt(5) + 1) / 2
    const phii = (Math.sqrt(5) - 1) / 2
    const p1: Vector = [-phii, 0, phi]
    const p2: Vector = [-1, 1, 1]
    const p3: Vector = [0, phi, phii]
    const p4: Vector = [1, 1, 1]
    const p5: Vector = [phii, 0, phi]
    const pc = Vectors.average([p1, p2, p3, p4, p5], [0, 0, 0])
    Vectors.normalizeSelf(p1)
    Vectors.normalizeSelf(p2)
    Vectors.normalizeSelf(p3)
    Vectors.normalizeSelf(p4)
    Vectors.normalizeSelf(p5)
    Vectors.normalizeSelf(pc)
    return {
        p1: { point: Vectors.div(p1, 32), normal: p1 },
        p2: { point: Vectors.div(p2, 32), normal: p2 },
        p3: { point: Vectors.div(p3, 32), normal: p3 },
        p4: { point: Vectors.div(p4, 32), normal: p4 },
        p5: { point: Vectors.div(p5, 32), normal: p5 },
        pc: { point: Vectors.div(pc, 32), normal: pc },
    }
}()

const signs = [1, -1]

function addVertex(
    triangles: number[],
    vertex: Vector,
) {
    const r = 0.95
    const g = 0.95
    const b = 0.95
    for (let i = 0; i < 3; i++) {
        const xIndex = i
        const yIndex = (i + 1) % 3
        const zIndex = (i + 2) % 3
        for (const ys of signs) {
            for (const zs of signs) {
                const signs = [1, ys, zs]
                let xSign = signs[xIndex]!
                let ySign = signs[yIndex]!
                let zSign = signs[zIndex]!

                const p1x = vertex[0]! + ball.p1.point[xIndex]! * xSign
                const p1y = vertex[1]! + ball.p1.point[yIndex]! * ySign
                const p1z = vertex[2]! + ball.p1.point[zIndex]! * zSign
                const p2x = vertex[0]! + ball.p2.point[xIndex]! * xSign
                const p2y = vertex[1]! + ball.p2.point[yIndex]! * ySign
                const p2z = vertex[2]! + ball.p2.point[zIndex]! * zSign
                const p3x = vertex[0]! + ball.p3.point[xIndex]! * xSign
                const p3y = vertex[1]! + ball.p3.point[yIndex]! * ySign
                const p3z = vertex[2]! + ball.p3.point[zIndex]! * zSign
                const p4x = vertex[0]! + ball.p4.point[xIndex]! * xSign
                const p4y = vertex[1]! + ball.p4.point[yIndex]! * ySign
                const p4z = vertex[2]! + ball.p4.point[zIndex]! * zSign
                const p5x = vertex[0]! + ball.p5.point[xIndex]! * xSign
                const p5y = vertex[1]! + ball.p5.point[yIndex]! * ySign
                const p5z = vertex[2]! + ball.p5.point[zIndex]! * zSign
                const pcx = vertex[0]! + ball.pc.point[xIndex]! * xSign
                const pcy = vertex[1]! + ball.pc.point[yIndex]! * ySign
                const pcz = vertex[2]! + ball.pc.point[zIndex]! * zSign
                // 頂点データ追加: position, normal, color
                if (ys * zs === -1) {
                    triangles.push(
                        p1x, p1y, p1z, ball.p1.normal[xIndex]! * xSign, ball.p1.normal[yIndex]! * ySign, ball.p1.normal[zIndex]! * zSign, r, g, b,
                        p2x, p2y, p2z, ball.p2.normal[xIndex]! * xSign, ball.p2.normal[yIndex]! * ySign, ball.p2.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        p2x, p2y, p2z, ball.p2.normal[xIndex]! * xSign, ball.p2.normal[yIndex]! * ySign, ball.p2.normal[zIndex]! * zSign, r, g, b,
                        p3x, p3y, p3z, ball.p3.normal[xIndex]! * xSign, ball.p3.normal[yIndex]! * ySign, ball.p3.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        p3x, p3y, p3z, ball.p3.normal[xIndex]! * xSign, ball.p3.normal[yIndex]! * ySign, ball.p3.normal[zIndex]! * zSign, r, g, b,
                        p4x, p4y, p4z, ball.p4.normal[xIndex]! * xSign, ball.p4.normal[yIndex]! * ySign, ball.p4.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        p4x, p4y, p4z, ball.p4.normal[xIndex]! * xSign, ball.p4.normal[yIndex]! * ySign, ball.p4.normal[zIndex]! * zSign, r, g, b,
                        p5x, p5y, p5z, ball.p5.normal[xIndex]! * xSign, ball.p5.normal[yIndex]! * ySign, ball.p5.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        p5x, p5y, p5z, ball.p5.normal[xIndex]! * xSign, ball.p5.normal[yIndex]! * ySign, ball.p5.normal[zIndex]! * zSign, r, g, b,
                        p1x, p1y, p1z, ball.p1.normal[xIndex]! * xSign, ball.p1.normal[yIndex]! * ySign, ball.p1.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                    )
                } else {
                    triangles.push(
                        p2x, p2y, p2z, ball.p2.normal[xIndex]! * xSign, ball.p2.normal[yIndex]! * ySign, ball.p2.normal[zIndex]! * zSign, r, g, b,
                        p1x, p1y, p1z, ball.p1.normal[xIndex]! * xSign, ball.p1.normal[yIndex]! * ySign, ball.p1.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        p3x, p3y, p3z, ball.p3.normal[xIndex]! * xSign, ball.p3.normal[yIndex]! * ySign, ball.p3.normal[zIndex]! * zSign, r, g, b,
                        p2x, p2y, p2z, ball.p2.normal[xIndex]! * xSign, ball.p2.normal[yIndex]! * ySign, ball.p2.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        p4x, p4y, p4z, ball.p4.normal[xIndex]! * xSign, ball.p4.normal[yIndex]! * ySign, ball.p4.normal[zIndex]! * zSign, r, g, b,
                        p3x, p3y, p3z, ball.p3.normal[xIndex]! * xSign, ball.p3.normal[yIndex]! * ySign, ball.p3.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        p5x, p5y, p5z, ball.p5.normal[xIndex]! * xSign, ball.p5.normal[yIndex]! * ySign, ball.p5.normal[zIndex]! * zSign, r, g, b,
                        p4x, p4y, p4z, ball.p4.normal[xIndex]! * xSign, ball.p4.normal[yIndex]! * ySign, ball.p4.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                        p1x, p1y, p1z, ball.p1.normal[xIndex]! * xSign, ball.p1.normal[yIndex]! * ySign, ball.p1.normal[zIndex]! * zSign, r, g, b,
                        p5x, p5y, p5z, ball.p5.normal[xIndex]! * xSign, ball.p5.normal[yIndex]! * ySign, ball.p5.normal[zIndex]! * zSign, r, g, b,
                        pcx, pcy, pcz, ball.pc.normal[xIndex]! * xSign, ball.pc.normal[yIndex]! * ySign, ball.pc.normal[zIndex]! * zSign, r, g, b,
                    )
                }
            }
        }
    }
}

function addEdgeSurface(
    triangles: number[],
    vertex1: Vector,
    vertex2: Vector,
    left: Vector,
    right: Vector,
) {
    const r = 0.25
    const g = 0.25
    const b = 0.25
    const p1x = vertex1[0]! + left[0]! / 96
    const p1y = vertex1[1]! + left[1]! / 96
    const p1z = vertex1[2]! + left[2]! / 96
    const p2x = vertex1[0]! + right[0]! / 96
    const p2y = vertex1[1]! + right[1]! / 96
    const p2z = vertex1[2]! + right[2]! / 96
    const p3x = vertex2[0]! + left[0]! / 96
    const p3y = vertex2[1]! + left[1]! / 96
    const p3z = vertex2[2]! + left[2]! / 96
    const p4x = vertex2[0]! + right[0]! / 96
    const p4y = vertex2[1]! + right[1]! / 96
    const p4z = vertex2[2]! + right[2]! / 96

    triangles.push(
        p1x, p1y, p1z, left[0]!, left[1]!, left[2]!, r, g, b,
        p2x, p2y, p2z, right[0]!, right[1]!, right[2]!, r, g, b,
        p3x, p3y, p3z, left[0]!, left[1]!, left[2]!, r, g, b,

        p3x, p3y, p3z, left[0]!, left[1]!, left[2]!, r, g, b,
        p2x, p2y, p2z, right[0]!, right[1]!, right[2]!, r, g, b,
        p4x, p4y, p4z, right[0]!, right[1]!, right[2]!, r, g, b,
    )
}

function addEdge(
    triangles: number[],
    vertex1: Vector,
    vertex2: Vector,
) {
    Vectors.sub(vertex2, vertex1, cv)
    if (Vectors.lengthSquared(cv) < 0.0035) {
        return
    }

    Vectors.normalizeSelf(cv)
    if (Math.abs(cv[0]!) >= 0.9) {
        mv[0] = 0
        mv[1] = 1
        mv[2] = 0
    } else {
        mv[0] = 1
        mv[1] = 0
        mv[2] = 0
    }
    Vectors.cross(mv, cv, nv)
    Vectors.normalizeSelf(nv)
    Vectors.cross(cv, nv, mv)
    Vectors.normalizeSelf(mv)
    Vectors.add(nv, mv, cv)
    Vectors.normalizeSelf(cv)
    Vectors.sub(mv, nv, ov)
    Vectors.normalizeSelf(ov)
    // nv - cv - mv - ov の順に並んでいる
    addEdgeSurface(triangles, vertex1, vertex2, nv, cv)
    addEdgeSurface(triangles, vertex1, vertex2, cv, mv)
    addEdgeSurface(triangles, vertex1, vertex2, mv, ov)
    Vectors.negateSelf(nv)
    addEdgeSurface(triangles, vertex1, vertex2, ov, nv)
    Vectors.negateSelf(cv)
    Vectors.negateSelf(mv)
    Vectors.negateSelf(ov)
    addEdgeSurface(triangles, vertex1, vertex2, nv, cv)
    addEdgeSurface(triangles, vertex1, vertex2, cv, mv)
    addEdgeSurface(triangles, vertex1, vertex2, mv, ov)
    Vectors.negateSelf(nv)
    addEdgeSurface(triangles, vertex1, vertex2, ov, nv)
}

function addTriangle(
    triangles: number[],
    v0: Vector,
    v1: Vector,
    v2: Vector,
    r: number,
    g: number,
    b: number,
) {
    // 三角形: v0, v1, v2
    // 法線を計算 (v0 -> v1 と v0 -> v2 の外積)
    Vectors.sub(v1, v0, nv)
    Vectors.sub(v2, v0, mv)
    Vectors.cross(nv, mv, nv)
    Vectors.normalizeSelf(nv)
    const nx = nv[0]!
    const ny = nv[1]!
    const nz = nv[2]!

    // 頂点データ追加: position, normal, color
    triangles.push(
        v0[0]!, v0[1]!, v0[2]!, nx, ny, nz, r, g, b,
        v1[0]!, v1[1]!, v1[2]!, nx, ny, nz, r, g, b,
        v2[0]!, v2[1]!, v2[2]!, nx, ny, nz, r, g, b,
    )
}

function addPolygon(
    triangles: number[],
    vertexes: Vector[],
    face: IPolyhedronFace,
    colorByConnected: boolean,
    evenOdd: boolean,
) {
    const indexes = face.vertexIndexes
    const colorIndex = (colorByConnected ? face.connectedIndex : face.colorIndex) % (faceColors.length)
    const [r, g, b] = faceColors[colorIndex]!
    if (indexes.length === 3) {
        addTriangle(triangles, vertexes[indexes[0]!]!, vertexes[indexes[1]!]!, vertexes[indexes[2]!]!, r, g, b)
        return
    } else if (indexes.length === 4) {
        const v0 = vertexes[indexes[0]!]!
        const v1 = vertexes[indexes[1]!]!
        const v2 = vertexes[indexes[2]!]!
        const v3 = vertexes[indexes[3]!]!
        if (Vectors.getCrossPoint(v0, v1, v2, v3, cv)) {
            addTriangle(triangles, v1, v2, cv, r, g, b)
            addTriangle(triangles, v3, v0, cv, r, g, b)
        } else if (Vectors.getCrossPoint(v1, v2, v3, v0, cv)) {
            addTriangle(triangles, v0, v1, cv, r, g, b)
            addTriangle(triangles, v2, v3, cv, r, g, b)
        } else {
            addTriangle(triangles, v0, v1, v2, r, g, b)
            addTriangle(triangles, v2, v3, v0, r, g, b)
        }
        return
    } else if (evenOdd && indexes.length === 5) {
        let hasCross = false
        for (let i = 0; i < indexes.length; i++) {
            const crossPoint = Vectors.getCrossPoint(
                vertexes[indexes[(i + 1) % indexes.length]!]!,
                vertexes[indexes[(i + 2) % indexes.length]!]!,
                vertexes[indexes[(i + 3) % indexes.length]!]!,
                vertexes[indexes[(i + 4) % indexes.length]!]!,
                crosses[i]!.source,
            )
            if (crossPoint) {
                hasCross = true
            }
            crosses[i]!.value = crossPoint
        }

        if (hasCross) {
            for (let i = 0; i < indexes.length; i++) {
                addTriangle(triangles,
                    vertexes[indexes[i]!]!,
                    crosses[(i + 4) % indexes.length]!.value ?? vertexes[indexes[(i + 4) % indexes.length]!]!,
                    crosses[(i + 1) % indexes.length]!.value ?? vertexes[indexes[(i + 1) % indexes.length]!]!,
                    r, g, b)
            }
        } else {
            addTriangle(triangles, vertexes[indexes[0]!]!, vertexes[indexes[1]!]!, vertexes[indexes[2]!]!, r, g, b)
            addTriangle(triangles, vertexes[indexes[0]!]!, vertexes[indexes[2]!]!, vertexes[indexes[3]!]!, r, g, b)
            addTriangle(triangles, vertexes[indexes[0]!]!, vertexes[indexes[3]!]!, vertexes[indexes[4]!]!, r, g, b)
        }
        return
    }

    cv[0]! = 0
    cv[1]! = 0
    cv[2]! = 0

    // 多角形の重心を計算
    for (const idx of indexes) {
        const v = vertexes[idx]!
        Vectors.add(cv, v, cv)
    }
    Vectors.div(cv, indexes.length, cv)

    // crosses に、各辺の左右の辺の交点を格納
    for (let i = 0; i < indexes.length; i++) {
        const v0 = vertexes[indexes[i]!]!
        const v1 = vertexes[indexes[(i + 1) % indexes.length]!]!
        const crossPoint = Vectors.getCrossPoint(
            vertexes[indexes[(i + indexes.length - 1) % indexes.length]!]!,
            v0,
            v1,
            vertexes[indexes[(i + 2) % indexes.length]!]!,
            crosses[i]!.source,
        )

        crosses[i]!.value = null
        if (crossPoint !== null) {
            const maxDistance = Vectors.middleDistanceSquared(v0, v1, cv)
            const distance1 = Vectors.middleDistanceSquared(v0, v1, crossPoint)
            const distance2 = Vectors.distanceSquared(crossPoint, cv)
            if (distance1 < maxDistance && distance2 < maxDistance) {
                crosses[i]!.value = crossPoint
            }
        }
    }

    // 各辺と重心で三角形を形成
    for (let i = 0; i < indexes.length; i++) {
        const beforeIndex = (i + indexes.length - 1) % indexes.length
        const afterIndex = (i + 1) % indexes.length
        const v0 = crosses[i]!.value ?? cv
        const v1 = crosses[beforeIndex]!.value ?? vertexes[indexes[i]!]!
        const v2 = crosses[afterIndex]!.value ?? vertexes[indexes[afterIndex]!]!
        addTriangle(triangles, v0, v1, v2, r, g, b)
    }
}

function hasSelfIntersection(vertexes: Vector[], face: IPolyhedronFace): boolean {
    // 4～5角形は自己交差する可能性があるが、レンダリングにおいては自己交差が起こらないように処理するため false を返す
    if (face.vertexIndexes.length <= 5) {
        return false
    }

    const v0 = vertexes[face.vertexIndexes[0]!]!
    const v1 = vertexes[face.vertexIndexes[1]!]!
    const v2 = vertexes[face.vertexIndexes[2]!]!
    if (Vectors.hasIntersection(v2, vertexes[face.vertexIndexes[3]!]!, v0, v1) ||
        Vectors.hasIntersection(vertexes[face.vertexIndexes[face.vertexIndexes.length - 1]!]!, v0, v1, v2)) {
        return true
    }
    for (let i = 3; i < face.vertexIndexes.length - 2; i++) {
        const va = vertexes[face.vertexIndexes[i]!]!
        const vb = vertexes[face.vertexIndexes[i + 1]!]!
        if (Vectors.hasIntersection(va, vb, v0, v1) || Vectors.hasIntersection(va, vb, v1, v2)) {
            return true
        }
    }
    return false
}

export interface IPolyhedronFace {
    readonly colorIndex: number
    readonly connectedIndex: number
    readonly vertexIndexes: number[]
}

export interface IPolyhedron {
    readonly vertexes: Vector[]
    readonly vertexIndexes: number[]
    readonly lineIndexes: [number, number][]
    readonly faces: IPolyhedronFace[]
}

export type VisibilityType = "All" | "VertexFigure" | "OneForEach"

export type FillType = "Fill" | "EvenOdd" | "GlobalEvenOdd"

type PlainIdentifier = {
    normal: Vector | null
    distance: number
}

function getPlain(vertexes: Vector[], face: IPolyhedronFace): PlainIdentifier {
    const normal = [0, 0, 0]
    const vertex0 = vertexes[face.vertexIndexes[0]!]!
    if (face.vertexIndexes.length <= 4) {
        Vectors.sub(vertexes[face.vertexIndexes[1]!]!, vertex0, nv)
        Vectors.sub(vertexes[face.vertexIndexes[2]!]!, vertex0, mv)
    } else {
        Vectors.sub(vertexes[face.vertexIndexes[2]!]!, vertex0, nv)
        Vectors.sub(vertexes[face.vertexIndexes[4]!]!, vertex0, mv)
    }
    Vectors.cross(nv, mv, normal)
    if (Math.abs(normal[0]!) < 0.0001 && Math.abs(normal[1]!) < 0.0001 && Math.abs(normal[2]!) < 0.0001) {
        return { normal: null, distance: 0 }
    } else {
        Vectors.normalizeSelf(normal)
        const distance = Vectors.dot(normal, vertex0)
        if (distance < 0) {
            Vectors.negateSelf(normal)
            return { normal, distance: -distance }
        } else {
            return { normal, distance }
        }
    }
}

function isSamePlain(currentPlain: PlainIdentifier, targetPlain: PlainIdentifier, isNearlyZero: boolean): boolean {
    return !!currentPlain.normal && !!targetPlain.normal &&
        Math.abs(currentPlain.distance - targetPlain.distance) < maxError && (
            Math.abs(currentPlain.normal[0]! - targetPlain.normal[0]!) < maxNormalError &&
            Math.abs(currentPlain.normal[1]! - targetPlain.normal[1]!) < maxNormalError &&
            Math.abs(currentPlain.normal[2]! - targetPlain.normal[2]!) < maxNormalError ||
            isNearlyZero &&
            Math.abs(currentPlain.normal[0]! + targetPlain.normal[0]!) < maxNormalError &&
            Math.abs(currentPlain.normal[1]! + targetPlain.normal[1]!) < maxNormalError &&
            Math.abs(currentPlain.normal[2]! + targetPlain.normal[2]!) < maxNormalError)
}

const maxNormalError = 1.0 / 1024.0
const maxError = 1.0 / 128.0
const cv = [0, 0, 0]
const nv = [0, 0, 0]
const mv = [0, 0, 0]
const ov = [0, 0, 0]

// 多面体データから描画用メッシュを生成するユーティリティ
export function buildPolyhedronMesh(
    polyhedron: IPolyhedron,
    faceVisibility: boolean[],
    visibilityType: VisibilityType,
    vertexVisibility: boolean,
    edgeVisibility: boolean,
    colorByConnected: boolean,
    fillType: FillType,
): PolyhedronMesh {
    const triangles: number[] = []
    const verfView = visibilityType === "VertexFigure"
    const eachForOne = visibilityType === "OneForEach"
    const refPointIndexes: number[] = []
    if (verfView) {
        polyhedron.vertexes.forEach((vertex, i) => {
            if (Vectors.distanceSquared(vertex, polyhedron.vertexes[0]!) < 0.005) {
                refPointIndexes.push(i)
            }
        })
    } else if (eachForOne) {
        refPointIndexes.push(0)
    }

    const colorDrawn = eachForOne ? new Set<number>() : null
    const stencilVertexCounts: number[] = []
    const drawIndexes: number[] = []
    let addedVertexCount = 0
    for (let i = 0; i < polyhedron.faces.length; i++) {
        const face = polyhedron.faces[i]!
        const colorIndex = (colorByConnected ? face.connectedIndex : face.colorIndex) % (faceColors.length)
        if (!faceVisibility[colorIndex]) {
            continue
        }
        if (colorDrawn) {
            if (colorDrawn.has(colorIndex)) {
                continue
            }
            colorDrawn.add(colorIndex)
        }

        if (verfView && face.vertexIndexes.every(i => !refPointIndexes.includes(i))) {
            continue
        }
        drawIndexes.push(i)
    }

    if (fillType === "GlobalEvenOdd") {
        const plains = new Array<PlainIdentifier>(drawIndexes.length)
        // 各面の法線ベクトルと中心からの距離を求める
        for (let i = 0; i < drawIndexes.length; i++) {
            const face = polyhedron.faces[drawIndexes[i]!]!
            plains[i] = getPlain(polyhedron.vertexes, face)
        }

        // ステンシルバッファを使って偶奇塗りする面を登録
        const drawnIndexSet = new Set<number>()
        for (let i = 0; i < drawIndexes.length; i++) {
            const currentPlain = plains[i]!
            if (drawnIndexSet.has(i) || !currentPlain.normal) continue

            const face = polyhedron.faces[drawIndexes[i]!]!
            // 自己交差の可能性がある5角形以上、または同一平面に複数の面がある場合、ステンシルバッファを使って描画する
            let drawWithStencil = hasSelfIntersection(polyhedron.vertexes, face)
            const isNearlyZero = Math.abs(currentPlain.distance) < maxError
            for (let j = i + 1; j < drawIndexes.length; j++) {
                const targetPlain = plains[j]!
                if (drawnIndexSet.has(j) || !targetPlain.normal) continue
                if (isSamePlain(currentPlain, targetPlain, isNearlyZero)) {
                    drawWithStencil = true
                    drawnIndexSet.add(j)
                    const otherFace = polyhedron.faces[drawIndexes[j]!]!
                    addPolygon(triangles, polyhedron.vertexes, otherFace, colorByConnected, true)
                }
            }

            if (drawWithStencil) {
                const face = polyhedron.faces[drawIndexes[i]!]!
                addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, true)

                drawnIndexSet.add(i)
                const vertexCount = triangles.length / 9 - addedVertexCount
                if (vertexCount > 0) {
                    stencilVertexCounts.push(vertexCount)
                    addedVertexCount += vertexCount
                }
            }
        }

        // 通常のレンダリングで描画する面を登録
        for (let i = 0; i < drawIndexes.length; i++) {
            if (drawnIndexSet.has(i)) continue
            const face = polyhedron.faces[drawIndexes[i]!]!
            addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, true)
        }
    } else if (fillType === "EvenOdd") {
        // ステンシルバッファを使って偶奇塗りする面を登録
        const drawnIndexSet = new Set<number>()
        for (let i = 0; i < drawIndexes.length; i++) {
            const face = polyhedron.faces[drawIndexes[i]!]!
            if (!hasSelfIntersection(polyhedron.vertexes, face)) continue

            addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, true)
            drawnIndexSet.add(i)
            const vertexCount = triangles.length / 9 - addedVertexCount
            if (vertexCount > 0) {
                stencilVertexCounts.push(vertexCount)
                addedVertexCount += vertexCount
            }
        }

        // 通常のレンダリングで描画する面を登録
        for (let i = 0; i < drawIndexes.length; i++) {
            if (drawnIndexSet.has(i)) continue
            const face = polyhedron.faces[drawIndexes[i]!]!
            addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, true)
        }
    } else {
        // 塗りつぶし
        for (const i of drawIndexes) {
            const face = polyhedron.faces[i]!
            addPolygon(triangles, polyhedron.vertexes, face, colorByConnected, false)
        }
    }

    if (vertexVisibility) {
        if (verfView) {
            addVertex(triangles, polyhedron.vertexes[0]!)
        } else {
            for (const index of polyhedron.vertexIndexes) {
                addVertex(triangles, polyhedron.vertexes[index]!)
            }
        }
    }

    if (edgeVisibility) {
        for (const [index1, index2] of polyhedron.lineIndexes) {
            if (verfView && !refPointIndexes.includes(index1) && !refPointIndexes.includes(index2)) {
                continue
            }
            addEdge(triangles, polyhedron.vertexes[index1]!, polyhedron.vertexes[index2]!)
        }
    }

    const normalVertexCount = triangles.length / 9 - addedVertexCount

    return {
        vertexData: new Float32Array(triangles),
        stencilVertexCounts,
        normalVertexCount,
    }
}
