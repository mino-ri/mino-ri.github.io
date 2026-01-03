import { clearChildren, createCircle, createLine, setCenter } from "./svg_generator.js"

const generatorColors = ["#DF4121", "#339564", "#217BDF", "#C3B827"]

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
        return new CoxeterMatrix([a, b, 2, c, 2, 2])
    }
}

// コクセター群の要素
export class CoxeterGroupElement {
    #periodValue: number | undefined

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
}

// コクセター群
export class CoxeterGroup {
    ranks: CoxeterGroupElement[][]
    matrix: CoxeterMatrix
    order: number

    constructor(matrix: CoxeterMatrix) {
        const exchanges = matrix.getExchanges()
        const identity = new CoxeterGroupElement(0, 0, "", new Array(matrix.dimension))
        this.ranks = [[identity]]
        this.matrix = matrix
        let order = 1
        let index = 1
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
                break
            }
            if (targetElements.length == 1 && targetElements[0]!.neighbors.every(e => !!e)) {
                break
            }
        } // while

        // 列挙中に "1" が伝搬するのを防ぐため、最後に名前を入れ替え
        identity.representation = "1"
        this.order = order
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
}

export interface IRenderableGroupElement {
    readonly rank: number
    readonly index: number
    readonly period: number
    readonly neighbors: IRenderableGroupElement[]
    mul(other: IRenderableGroupElement): IRenderableGroupElement
}

export interface IRenderableGroup {
    ranks: IRenderableGroupElement[][]
    readonly order: number
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

    render<TGroup extends IRenderableGroup>(coxeterGroup: TGroup) {
        // レイアウト定数
        const circleRadius = 6
        const horizontalSpacing = 40
        const verticalSpacing = 40
        const padding = 30

        // 各要素の座標を計算
        const positions = new Map<IRenderableGroupElement, { x: number; y: number }>()
        let maxWidth = 0
        for (let rankIndex = 0; rankIndex < coxeterGroup.ranks.length; rankIndex++) {
            const rankElements = coxeterGroup.ranks[rankIndex]!
            const rankWidth = (rankElements.length - 1) * horizontalSpacing
            maxWidth = Math.max(maxWidth, rankWidth)
            const startX = -rankWidth / 2
            const y = rankIndex * verticalSpacing

            for (let i = 0; i < rankElements.length; i++) {
                positions.set(rankElements[i]!, { x: startX + i * horizontalSpacing, y })
            }
        }

        // viewBoxのサイズを決定
        const viewWidth = maxWidth + padding * 2 + circleRadius * 2
        const viewHeight = (coxeterGroup.ranks.length - 1) * verticalSpacing + padding * 2 + circleRadius * 2

        setCenter(viewWidth / 2, padding + circleRadius)
        clearChildren(this.lineGroup, this.elementGroup)
        // 既に線を描画したインデックス (min * 65536 + max)
        // (オブジェクトは参照比較されてしまうため、数値に変換する)
        const renderedIndexSet = new Set<number>()

        // 線を描画
        for (const rankElements of coxeterGroup.ranks) {
            for (const element of rankElements) {
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
                    this.lineGroup.appendChild(line)
                }
            }
        }

        // 丸を描画
        for (const rankElements of coxeterGroup.ranks) {
            for (const element of rankElements) {
                const pos = positions.get(element)!
                const fillColor = element.rank === 0 ? "#000000" : "#FFFFFF"
                const circle = createCircle(pos.x, pos.y, circleRadius, fillColor, "#000000", "2")

                // クリックによる選択機能
                if (element.rank !== 0) {
                    circle.style.cursor = "pointer"
                    circle.addEventListener("click", () => {
                        const index = selectedElement.indexOf(element)
                        if (index === -1) {
                            // 選択
                            selectedElement.push(element)
                            circle.setAttribute("fill", "#FFFF00")
                        } else {
                            // 選択解除
                            selectedElement.splice(index, 1)
                            circle.setAttribute("fill", "#FFFFFF")
                        }
                    })
                }

                this.elementGroup.appendChild(circle)
            }
        }

        this.orderText.textContent = `order = ${coxeterGroup.order}`
        this.previewFigure.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`)
    }
}

window.addEventListener("load", () => {
    const textEditor = document.getElementById("textarea_editor") as HTMLTextAreaElement
    const buttonRender = document.getElementById("button_render") as HTMLInputElement
    const buttonSubgroup = document.getElementById("button_subgroup") as HTMLInputElement
    const previewFigure = document.getElementById("preview_figure") as unknown as SVGSVGElement
    const lineGroup = document.getElementById("line_group") as unknown as SVGGElement
    const elementGroup = document.getElementById("element_group") as unknown as SVGGElement
    const oerderText = document.getElementById("order_text") as unknown as SVGTextElement
    // const fadeRect = document.getElementById("fade_rect") as unknown as SVGRectElement
    const renderer = new CoxeterGroupRenderer(previewFigure, lineGroup, elementGroup, oerderText)

    buttonRender.addEventListener("click", () => {
        // fadeRect.setAttribute("fill-opacity", "0")
        coxeterGroup = CoxeterGroup.parse(textEditor.value)
        selectedElement.length = 0
        renderer.render(coxeterGroup)
    })
    buttonSubgroup.addEventListener("click", () => {
        // fadeRect.setAttribute("fill-opacity", "0.95")
        if (!coxeterGroup || selectedElement.length < 1) {
            return
        }

        coxeterGroup = new CoxeterSubgroup(coxeterGroup, [...selectedElement])
        selectedElement.length = 0
        renderer.render(coxeterGroup)
    })
})
