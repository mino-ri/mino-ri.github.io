import { clearChildren, createCircle, createLine, setCenter } from "./svg_generator.js"

const generatorColors = ["#DF4121", "#339564", "#217BDF", "#C3B827"]

type Vector2 = [x: number, y: number]
type Vector = number[]
const directionMap = new Map<number, Vector2[]>([[2, [[1, 0], [0, 1]]]])
const positionCenter = 250

class Vectors {
    static dot(a: Vector, b: Vector): number {
        let result = 0
        const length = Math.min(a.length, b.length)
        for (let i = 0; i < length; i++) {
            result += a[i]! * b[i]!
        }
        return result
    }

    static mul(a: Vector, s: number): Vector {
        const result = new Array<number>(a.length)
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i]! * s
        }
        return result
    }

    static add(a: Vector, b: Vector): Vector {
        const length = Math.min(a.length, b.length)
        const result = new Array<number>(length)
        for (let i = 0; i < length; i++) {
            result[i] = a[i]! + b[i]!
        }
        return result
    }

    static sub(a: Vector, b: Vector): Vector {
        const length = Math.min(a.length, b.length)
        const result = new Array<number>(length)
        for (let i = 0; i < length; i++) {
            result[i] = a[i]! - b[i]!
        }
        return result
    }

    static normalize(v: Vector): Vector {
        return Vectors.mul(v, 1 / Math.sqrt(Vectors.dot(v, v)))
    }

    static project(v: Vector): { x: number; y: number; z: number } {
        const dimension = v.length
        switch (dimension) {
            case 0:
                return { x: 0, y: 0, z: 1 }
            case 1:
                return { x: v[0]! * 150, y: 0, z: 1 }
            case 2:
                return { x: v[0]! * 150, y: v[1]! * -150, z: 1 }
        }

        let directions = directionMap.get(dimension)
        if (!directions) {
            directions = new Array<Vector2>(dimension)
            for (let i = 0; i < dimension; i++) {
                const theta = Math.PI * 2 * (dimension - i - 1) / dimension
                directions[i] = [Math.sin(theta) * 150, -Math.cos(theta) * 150]
            }

            directionMap.set(dimension, directions)
        }

        let result = {x: 0, y: 0, z: 0}
        for (let i = 0; i < dimension; i++) {
            const a = v[i]!
            const [dx, dy] = directions[i]!
            result.x += a * dx
            result.y += a * dy
            result.z += a
        }

        // 遠近感調整
        result.z = (result.z / dimension + 2) / 2
        result.x = result.x * result.z
        result.y = result.y * result.z
        return result
    }
}

class Mirror {
    constructor(public normal: Vector) { }

    reflection(v: Vector): Vector {
        const r = -2 * Vectors.dot(v, this.normal)
        return Vectors.add(v, Vectors.mul(this.normal, r))
    }
}

class Representation {
    static beginCodePoint = 97 // 'a'

    static charMap = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"]

    static getChar(a: number): string {
        if (a < this.charMap.length) {
            return this.charMap[a]!
        }

        return String.fromCodePoint(Representation.beginCodePoint + a)
    }

    static getAlternating(a: number, b: number, count: number): [string, string] {
        const aChar = this.getChar(a)
        const bChar = this.getChar(b)
        const aRepr = new Array<string>(count)
        const bRepr = new Array<string>(count)
        for (let i = 0; i < count; i++) {
            if (i % 2 == 0) {
                aRepr[i] = aChar
                bRepr[i] = bChar
            } else {
                aRepr[i] = bChar
                bRepr[i] = aChar
            }
        }

        return [aRepr.join(""), bRepr.join("")]
    }

    static getAlternatingNumbers(a: number, b: number, count: number): [number[], number[]] {
        const aRepr = new Array<number>(count)
        const bRepr = new Array<number>(count)
        for (let i = 0; i < count; i++) {
            if (i % 2 == 0) {
                aRepr[i] = a
                bRepr[i] = b
            } else {
                aRepr[i] = b
                bRepr[i] = a
            }
        }

        return [aRepr, bRepr]
    }
}

export type ElementExchange = {
    from: number[]
    to: number[]
}

// コクセター行列 (コクセター図形の代替として入力値に使う)
// 次のようなインデックスで配列に保存する
//   a b c d
// a - 0 1 3
// b 0 - 2 4
// c 1 2 - 5
// d 3 4 5 -
export class CoxeterMatrix {
    values: number[]
    dimension: number

    constructor(values: number[]) {
        this.values = values
        const length = this.values.length
        this.dimension = Math.sqrt(2 * length + 0.25) + 0.5
    }

    get(a: number, b: number): number {
        if (a == b) {
            return 2
        }

        const index = a > b
            ? a * (a - 1) / 2 + b
            : b * (b - 1) / 2 + a
        return this.values[index] ?? 2
    }

    // ElementExchange[先頭のジェネレータ番号][index]
    getExchanges(): ElementExchange[][] {
        const result = new Array<ElementExchange[]>(3)
        for (let i = 0; i < this.dimension; i++) {
            result[i] = []
        }

        for (let a = 0; a < this.dimension; a++) {
            for (let b = a + 1; b < this.dimension; b++) {
                const m = this.get(a, b)
                const [word0, word1] = Representation.getAlternatingNumbers(a, b, m)
                result[a]?.push({ from: word0, to: word1 })
                result[b]?.push({ from: word1, to: word0 })
            }
        }


        return result
    }

    static create2D(a: number): CoxeterMatrix {
        return new CoxeterMatrix([a])
    }

    static create3D(a: number, b: number, c?: number): CoxeterMatrix {
        return new CoxeterMatrix([a, c ?? 2, b])
    }

    static create4D(a: number, b: number, c: number): CoxeterMatrix {
        return new CoxeterMatrix([a, 2, b, 2, 2, c])
    }

    static create4DDemicube(a: number, b: number, c: number): CoxeterMatrix {
        return new CoxeterMatrix([a, 2, b, 2, c, 2])
    }
}

const dummyPosition: Vector = []

// コクセター群の要素
export class CoxeterGroupElement {
    #periodValue: number | undefined
    position: Vector

    constructor(
        // 群の中で一意なインデックス
        public index: number,
        // 要素の階数、単位元に最低いくつの生成元を乗算すればこの現にたどり着けるか
        public rank: number,
        // 要素の表示の一例
        public representation: string,
        // この要素に生成元を乗算した結果の要素への参照
        public neighbors: CoxeterGroupElement[]
    ) {
        this.#periodValue = undefined
        this.position = dummyPosition
    }

    mul(other: CoxeterGroupElement): CoxeterGroupElement {
        // 一方が単位元なら他方がそのまま積となる
        if (other.rank === 0) {
            return this
        } else if (this.rank === 0) {
            return other
        }

        let target: CoxeterGroupElement = this
        for (let i = 0; i < other.representation.length; i++) {
            const code = other.representation.charCodeAt(i)
            if (Number.isNaN(code)) {
                break
            }
            target = target.neighbors[code - Representation.beginCodePoint]!
        }

        return target
    }

    calcPosition(origin: Vector, mirrors: Mirror[]) {
        this.position = origin
        if (this.rank === 0) {
            return
        }

        for (let i = this.representation.length - 1; i >= 0; i--) {
            const code = this.representation.charCodeAt(i)
            if (Number.isNaN(code)) {
                break
            }

            const mirror = mirrors[code - Representation.beginCodePoint]!
            this.position = mirror.reflection(this.position)
        }

        console.log(`${this.representation}: ${this.position}`)
    }

    toString(): string {
        return this.representation
    }

    // この要素の位数 (何乗したら単位元になるか)
    get period(): number {
        if (this.#periodValue !== undefined) {
            return this.#periodValue
        }

        let period = 1
        let element: CoxeterGroupElement = this
        while (element.rank > 0) {
            period++
            element = element.mul(this)
        }

        this.#periodValue = period
        return period
    }
}

export class SubgroupElement {
    constructor(
        // 元となった群の要素
        public source: IRenderableGroupElement,
        // 部分群内における要素の階数、単位元に最低いくつの生成元を乗算すればこの現にたどり着けるか
        public rank: number,
        // 要素の表示の一例 (部分群の生成元を使った表示)
        public representation: string,
        // この要素に部分群の生成元を乗算した結果の要素への参照
        public neighbors: SubgroupElement[]
    ) {
    }

    mul(other: SubgroupElement): SubgroupElement {
        // 一方が単位元なら他方がそのまま積となる
        if (other.rank === 0) {
            return this
        } else if (this.rank === 0) {
            return other
        }

        let target: SubgroupElement = this
        for (let i = 0; i < other.representation.length; i++) {
            const code = other.representation.charCodeAt(i)
            if (Number.isNaN(code)) {
                break
            }
            target = target.neighbors[code - Representation.beginCodePoint]!
        }

        return target
    }

    toString(): string {
        return this.representation
    }

    get index(): number {
        return this.source.index
    }

    get period(): number {
        return this.source.period
    }

    get position(): Vector {
        return this.source.position
    }
}

// コクセター群
export class CoxeterGroup {
    ranks: CoxeterGroupElement[][]
    matrix: CoxeterMatrix
    order: number
    hasPosition: boolean
    isLimitOver: boolean

    constructor(matrix: CoxeterMatrix) {
        const exchanges = matrix.getExchanges()
        const identity = new CoxeterGroupElement(0, 0, "", new Array(matrix.dimension))
        this.ranks = [[identity]]
        this.matrix = matrix
        let order = 1
        let index = 1
        let isLimitOver = false
        const maxOrder = matrix.dimension >= 4 ? 14401 : 121
        const maxIncrRank = matrix.dimension >= 4 ? 31 : 13

        while (true) {
            const nextRank = this.ranks.length
            console.log(`探索: rank${nextRank}`)
            const sourceElements = this.ranks[nextRank - 1]!
            const targetElements: CoxeterGroupElement[] = []
            for (const element of sourceElements) {
                for (let g = 0; g < matrix.dimension; g++) {
                    if (element.neighbors[g]) {
                        // 既に値が設定されている (低いランクと繋がっている) ためスキップ
                        continue
                    }

                    // 新しい要素の代表的な表現
                    const newRepresentation = element.representation + Representation.getChar(g)

                    // 既存の要素に同じ表現を持つものがあるか探索
                    let targetElement: CoxeterGroupElement | undefined = undefined
                    for (const ex of exchanges[g]!) {
                        let followed = CoxeterGroup.#follow(element, ex.from, 1)
                        if (!followed) {
                            continue
                        }

                        targetElement = targetElements.find(target => followed === CoxeterGroup.#follow(target, ex.to))
                        if (targetElement) {
                            break
                        }
                    }

                    // 新規要素を作るか、既存要素の隣を登録
                    if (!targetElement) {
                        targetElement = new CoxeterGroupElement(index, nextRank, newRepresentation, new Array(matrix.dimension))
                        targetElements.push(targetElement)
                        index++
                    }

                    targetElement.neighbors[g] = element
                    element.neighbors[g] = targetElement
                }
            }
            console.log(`追加要素数: ${targetElements.length}`)
            this.ranks.push(targetElements)
            order += targetElements.length
            if (order >= maxOrder || nextRank >= maxIncrRank && targetElements.length >= this.ranks[this.ranks.length - 2]!.length) {
                // [3 3 5] でも rank31 以降でランクあたりの要素数が減り始めるので、それ以上の要素数が予想される場合は打ち切り
                isLimitOver = true
                break
            }
            if (targetElements.length == 1 && targetElements[0]!.neighbors.every(e => !!e)) {
                break
            }
        } // while

        // 列挙中に "1" が伝搬するのを防ぐため、最後に名前を入れ替え
        identity.representation = "1"
        this.order = order
        this.isLimitOver = isLimitOver
        this.hasPosition = !isLimitOver && CoxeterGroup.#setPositions(this.ranks, this.matrix)
    }

    static #follow(beginElement: CoxeterGroupElement, route: number[], routeIndex?: number): CoxeterGroupElement | null {
        let current = beginElement
        for (let i = routeIndex ?? 0; i < route.length; i++) {
            const next = current.neighbors[route[i]!]
            if (!next || next.rank > current.rank) {
                return null
            }
            current = next
        }

        return current
    }

    static #setPositions(elements: CoxeterGroupElement[][], matrix: CoxeterMatrix): boolean {
        switch (matrix.dimension) {
            case 2:
                return CoxeterGroup.#setPositions2(elements, matrix)

            case 3:
                return CoxeterGroup.#setPositions3(elements, matrix)

            case 4:
                return CoxeterGroup.#setPositions4(elements, matrix)
            default:
                return false
        }
    }

    static #setPositions2(elements: CoxeterGroupElement[][], matrix: CoxeterMatrix): boolean {
        if (matrix.dimension !== 2) {
            return false
        }
        
        const theta = Math.PI / matrix.get(0, 1) * 0.5
        const cosP = Math.cos(theta)
        const sinP = Math.sin(theta)
        const origin: Vector = [0, 1]
        const mirrors = [
            new Mirror([cosP, sinP]),
            new Mirror([cosP, -sinP]),
        ]

        for (const rank of elements) {
            for (const element of rank) {
                element.calcPosition(origin, mirrors)
            }
        }

        return true
    }

    static #setPositions3(elements: CoxeterGroupElement[][], matrix: CoxeterMatrix): boolean {
        if (matrix.dimension !== 3) {
            return false
        }

        const cosP = Math.cos(Math.PI / matrix.get(0, 1))
        const cosQ = Math.cos(Math.PI / matrix.get(1, 2))
        const cos2P = cosP * cosP
        const cos2Q = cosQ * cosQ
        const zs = 1 - cos2P - cos2Q
        if (zs <= 0.0001) {
            return false
        }

        const z = Math.sqrt(zs)
        const mirrors = [
            new Mirror([1, 0, 0]),
            new Mirror([-cosP, -cosQ, z]),
            new Mirror([0, 1, 0]),
        ]
        const origin = Vectors.normalize([z, z, 1 + cosP + cosQ])
        for (const rank of elements) {
            for (const element of rank) {
                element.calcPosition(origin, mirrors)
            }
        }

        return true
    }

    static #setPositions4(elements: CoxeterGroupElement[][], matrix: CoxeterMatrix): boolean {
        if (matrix.dimension !== 4) {
            return false
        }

        const thetaP = Math.PI / matrix.get(0, 1)
        const thetaQ = Math.PI / matrix.get(1, 2)
        const cosP = Math.cos(thetaP)
        const cosQ = Math.cos(thetaQ)
        const s = matrix.get(1, 3)
        const mirrors = [
            new Mirror([1, 0, 0, 0]),
            null!,
            null!,
            new Mirror([0, 1, 0, 0]),
        ]
        let origin: Vector = dummyPosition
        if (s >= 3) {
            // この状況では入力制限により R = 2 が確定
            const cosS = Math.cos(Math.PI / s)
            const ws = 1 - cosP * cosP - cosQ * cosQ - cosS * cosS
            if (ws <= 0.0001) {
                return false
            }
            const w = Math.sqrt(ws)
            mirrors[1] = new Mirror([-cosP, -cosS, -cosQ, w])
            mirrors[2] = new Mirror([0, 0, 1, 0])
            origin = Vectors.normalize([w, w, w, 1 + cosP + cosQ + cosS])
        } else {
            const thetaR = Math.PI / matrix.get(2, 3)
            const sinP = Math.sin(thetaP)
            const sinR = Math.sin(thetaR)
            const cosR = Math.cos(thetaR)
            const z = (1 - cosQ / sinP / sinR) / 2
            if (z <= 0.0001) {
                return false
            }
            const cosZ = Math.sqrt(z)
            const sinZ = Math.sqrt(1 - z)
            mirrors[1] = new Mirror([-cosP, 0, sinP * sinZ, sinP * cosZ])
            mirrors[2] = new Mirror([0, -cosR, -sinR * sinZ, sinR * cosZ])
            const t = 2 * sinZ * cosZ
            const tP = (1 + cosP) / sinP
            const tR = (1 + cosR) / sinR
            origin = Vectors.normalize([
                t,
                t,
                sinZ * (tP - tR),
                cosZ * (tP + tR),
            ])
        }

        for (const rank of elements) {
            for (const element of rank) {
                element.calcPosition(origin, mirrors)
            }
        }

        return true
    }

    static parse(text: string): CoxeterGroup {
        const isDemicube = text.startsWith("d")
        if (isDemicube) {
            text = text.slice(1)
        }
        const args = text
            .split(" ")
            .filter(s => s.length > 0)
            .map(s => parseInt(s))
        return new CoxeterGroup(
            args.length == 1 ? CoxeterMatrix.create2D(args[0]!)
                : args.length == 2 ? CoxeterMatrix.create3D(args[0]!, args[1]!)
                    : args.length == 3 ? (isDemicube
                        ? CoxeterMatrix.create4DDemicube(args[0]!, args[1]!, args[2]!)
                        : CoxeterMatrix.create4D(args[0]!, args[1]!, args[2]!))
                        : CoxeterMatrix.create3D(2, 2))
    }
}

export class CoxeterSubgroup {
    parent: IRenderableGroup
    ranks: SubgroupElement[][]
    order: number
    elementMap: Map<IRenderableGroupElement, SubgroupElement>

    constructor(parent: IRenderableGroup, generators: IRenderableGroupElement[]) {
        this.parent = parent
        // 実際には次元を表さないが、生成元表示においては実質次元として機能するため dimension と名付けておく
        const dimension = generators.length
        const identitySource = parent.ranks[0]![0]!
        const identity = new SubgroupElement(identitySource, 0, "", new Array<SubgroupElement>(dimension))
        this.ranks = [[identity]]
        this.elementMap = new Map<IRenderableGroupElement, SubgroupElement>()
        this.elementMap.set(identitySource, identity)
        this.order = 1

        let elementAdded = true
        while (elementAdded) {
            elementAdded = false
            const nextRank = this.ranks.length
            console.log(`探索: rank${nextRank}`)
            const sourceElements = this.ranks[nextRank - 1]!
            const targetElements: SubgroupElement[] = []
            for (const element of sourceElements) {
                for (let g = 0; g < dimension; g++) {
                    if (element.neighbors[g]) {
                        // 既に値が設定されているためスキップ
                        continue
                    }

                    const newParentElement = element.source.mul(generators[g]!)
                    let targetElement = this.elementMap.get(newParentElement)
                    if (!targetElement) {
                        const newRepresentation = element.representation + Representation.getChar(g)
                        targetElement = new SubgroupElement(newParentElement, nextRank, newRepresentation, new Array<SubgroupElement>(dimension))
                        targetElements.push(targetElement)
                        this.elementMap.set(newParentElement, targetElement)
                        elementAdded = true
                        this.order++
                    }

                    // ジェネレータが対合とは限らないため、逆向きスロットには登録しない
                    element.neighbors[g] = targetElement
                }
            }

            console.log(`追加要素数: ${targetElements.length}`)
            this.ranks.push(targetElements)
        }

        // 列挙中に "1" が伝搬するのを防ぐため、最後に名前を入れ替え
        identity.representation = "1"
    }

    get hasPosition(): boolean {
        return this.parent.hasPosition
    }

    get isLimitOver(): boolean {
        return this.parent.isLimitOver
    }
}

export interface IRenderableGroupElement {
    readonly rank: number
    readonly index: number
    readonly period: number
    readonly neighbors: IRenderableGroupElement[]
    readonly position: Vector
    mul(other: IRenderableGroupElement): IRenderableGroupElement
}

export interface IRenderableGroup {
    readonly ranks: IRenderableGroupElement[][]
    readonly order: number
    readonly hasPosition: boolean
    readonly isLimitOver: boolean
}

let coxeterGroup: IRenderableGroup | null = null
let selectedElement: IRenderableGroupElement[] = []

class CoxeterGroupRenderer {
    constructor(
        private previewFigure: SVGSVGElement,
        private lineGroup: SVGGElement,
        private elementGroup: SVGGElement,
        private orderText: SVGTextElement,
    ) { }

    clear() {
        clearChildren(this.lineGroup, this.elementGroup)
    }

    render<TGroup extends IRenderableGroup>(coxeterGroup: TGroup, displayNd: boolean) {
        // レイアウト定数
        const circleRadius = 6
        const horizontalSpacing = 40
        const verticalSpacing = 40
        const padding = 30

        // 各要素の座標を計算
        const positions = new Map<IRenderableGroupElement, { x: number; y: number; z: number }>()
        let viewWidth = 0
        let viewHeight = 0

        if (displayNd && coxeterGroup.hasPosition) {
            viewWidth = positionCenter * 2
            viewHeight = positionCenter * 2
            setCenter(positionCenter, positionCenter)

            for (const rank of coxeterGroup.ranks) {
                for (const element of rank) {
                    positions.set(element, Vectors.project(element.position))
                }
            }
        } else {
            let maxWidth = 0
            for (let rankIndex = 0; rankIndex < coxeterGroup.ranks.length; rankIndex++) {
                const rankElements = coxeterGroup.ranks[rankIndex]!
                const rankWidth = (rankElements.length - 1) * horizontalSpacing
                maxWidth = Math.max(maxWidth, rankWidth)
                const startX = -rankWidth / 2
                const y = rankIndex * verticalSpacing
    
                for (let i = 0; i < rankElements.length; i++) {
                    positions.set(rankElements[i]!, { x: startX + i * horizontalSpacing, y, z: 1 })
                }
            }
    
            // viewBoxのサイズを決定
            viewWidth = maxWidth + padding * 2 + circleRadius * 2
            viewHeight = (coxeterGroup.ranks.length - 1) * verticalSpacing + padding * 2 + circleRadius * 2
            setCenter(viewWidth / 2, padding + circleRadius)
        }

        clearChildren(this.lineGroup, this.elementGroup)
        // 既に線を描画したインデックス (min * 65536 + max)
        // (オブジェクトは参照比較されてしまうため、数値に変換する)
        const renderedIndexSet = new Set<number>()
        const allElements = coxeterGroup.ranks.flat()
        allElements.sort((e1, e2) => e1.index - e2.index)

        // 線を描画
        for (const element of allElements) {
            const fromPos = positions.get(element)!
            for (let i = 0; i < element.neighbors.length; i++) {
                const neighbor = element.neighbors[i]
                if (!neighbor) {
                    continue
                }
                const lineIndex = element.index > neighbor.index
                    ? element.index + neighbor.index * 65536
                    : element.index * 65536 + neighbor.index
                if (renderedIndexSet.has(lineIndex)) {
                    continue
                }
                renderedIndexSet.add(lineIndex)
                const toPos = positions.get(neighbor)!
                const color = generatorColors[i % generatorColors.length] ?? "#000000"
                const line = createLine(fromPos.x, fromPos.y, toPos.x, toPos.y, color, "4")
                const backLine = createLine(fromPos.x, fromPos.y, toPos.x, toPos.y, "#FFFFFF", "8")
                this.lineGroup.prepend(line)
                this.lineGroup.prepend(backLine)
            }
        }

        // 丸を描画
        for (const element of allElements) {
            const pos = positions.get(element)!
            const fillColor = element.rank === 0 ? "#000000" : "#FFFFFF"
            const circle = createCircle(pos.x, pos.y, circleRadius * pos.z, fillColor, "#000000", "2")

            // クリックによる選択機能
            if (element.rank !== 0) {
                circle.style.cursor = "pointer"
                circle.addEventListener("click", () => {
                    const index = selectedElement.indexOf(element)
                    if (index === -1) {
                        // 選択
                        selectedElement.push(element)
                        circle.setAttribute("fill", "#FF00FF")
                    } else {
                        // 選択解除
                        selectedElement.splice(index, 1)
                        circle.setAttribute("fill", "#FFFFFF")
                    }
                })
            }

            this.elementGroup.prepend(circle)
        }

        this.orderText.textContent = `order = ${coxeterGroup.isLimitOver ? "∞" : coxeterGroup.order}`
        this.previewFigure.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`)
    }
}

window.addEventListener("load", () => {
    const textEditor = document.getElementById("textarea_editor") as HTMLTextAreaElement
    const buttonRender = document.getElementById("button_render") as HTMLInputElement
    const checkNd = document.getElementById("checkbox_nd") as HTMLInputElement
    const buttonSubgroup = document.getElementById("button_subgroup") as HTMLInputElement
    const previewFigure = document.getElementById("preview_figure") as unknown as SVGSVGElement
    const lineGroup = document.getElementById("line_group") as unknown as SVGGElement
    const elementGroup = document.getElementById("element_group") as unknown as SVGGElement
    const oerderText = document.getElementById("order_text") as unknown as SVGTextElement
    const renderer = new CoxeterGroupRenderer(previewFigure, lineGroup, elementGroup, oerderText)

    buttonRender.addEventListener("click", () => {
        coxeterGroup = CoxeterGroup.parse(textEditor.value)
        selectedElement.length = 0
        renderer.render(coxeterGroup, checkNd.checked)
    })
    buttonSubgroup.addEventListener("click", () => {
        if (!coxeterGroup || selectedElement.length < 1) {
            return
        }

        coxeterGroup = new CoxeterSubgroup(coxeterGroup, [...selectedElement])
        selectedElement.length = 0
        renderer.render(coxeterGroup, checkNd.checked)
    })
})
