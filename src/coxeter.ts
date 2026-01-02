import { clearChildren, createCircle, createLine, setCenter } from "./svg_generator.js"

const generatorColors = ["#DF4121", "#339564", "#217BDF", "#C3B827"]

class Representation {
    static charMap = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"]

    static getChar(a: number): string {
        if (a < this.charMap.length) {
            return this.charMap[a]!
        }

        const beginCodePoint = 0x41 // 'a'
        return String.fromCodePoint(beginCodePoint + a)
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

    // 交換可能な表現の生成 (a-3-b の場合の aba = bab など)
    getExchanges(): Map<string, string> {
        const exchanges = new Map<string, string>()
        for (let a = 0; a < this.dimension; a++) {
            for (let b = a + 1; b < this.dimension; b++) {
                const m = this.get(a, b)
                const [char0, char1] = Representation.getAlternating(a, b, m)
                exchanges.set(char0, char1)
                exchanges.set(char1, char0)
            }
        }

        return exchanges
    }

    // ElementExchange[先頭のジェネレータ番号][index]
    getExchanges2(): ElementExchange[][] {
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
export type CoxeterGroupElement = {
    index: number
    rank: number
    representation: string
    neighbors: CoxeterGroupElement[]
}

// コクセター群
export class CoxeterGroup {
    ranks: CoxeterGroupElement[][]

    constructor(matrix: CoxeterMatrix) {
        const exchanges = matrix.getExchanges2()
        console.log(exchanges)
        const identity: CoxeterGroupElement = {
            index: 0,
            rank: 0,
            representation: "",
            neighbors: new Array(matrix.dimension)
        }
        this.ranks = [[identity]]
        let order = 0
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
                        targetElement = {
                            index: index,
                            rank: nextRank,
                            representation: newRepresentation,
                            neighbors: new Array(matrix.dimension),
                        }
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
}

window.addEventListener("load", () => {
    const textEditor = document.getElementById("textarea_editor") as HTMLTextAreaElement
    const buttonLog = document.getElementById("button_log") as HTMLInputElement
    const previewFigure = document.getElementById("preview_figure") as unknown as SVGSVGElement
    const lineGroup = document.getElementById("line_group") as unknown as SVGGElement
    const elementGroup = document.getElementById("element_group") as unknown as SVGGElement

    buttonLog.addEventListener("click", () => {
        let text = textEditor.value
        const isDemicube = text.startsWith("d")
        if (isDemicube) {
            text = text.slice(1)
        }
        const args = text
            .split(" ")
            .filter(s => s.length > 0)
            .map(s => parseInt(s))
        const coxeterGroup = new CoxeterGroup(
            args.length == 1 ? CoxeterMatrix.create2D(args[0]!)
                : args.length == 2 ? CoxeterMatrix.create3D(args[0]!, args[1]!)
                    : args.length == 3 ? (isDemicube
                        ? CoxeterMatrix.create4DDemicube(args[0]!, args[1]!, args[2]!)
                        : CoxeterMatrix.create4D(args[0]!, args[1]!, args[2]!))
                        : CoxeterMatrix.create3D(2, 2))
        const order = coxeterGroup.ranks.reduce((acm, rankElements) => acm + rankElements.length, 0)
        console.log(`order: ${order}`)

        // レイアウト定数
        const circleRadius = 6
        const horizontalSpacing = 40
        const verticalSpacing = 40
        const padding = 30

        // 各要素の座標を計算
        const positions = new Map<CoxeterGroupElement, { x: number; y: number }>()
        let maxWidth = 0
        for (let rankIndex = 0; rankIndex < coxeterGroup.ranks.length; rankIndex++) {
            const rankElements = coxeterGroup.ranks[rankIndex]!
            const rankWidth = (rankElements.length - 1) * horizontalSpacing
            maxWidth = Math.max(maxWidth, rankWidth)
            const startX = -rankWidth / 2
            const y = rankIndex * verticalSpacing

            for (let i = 0; i < rankElements.length; i++) {
                const element = rankElements[i]!
                positions.set(element, { x: startX + i * horizontalSpacing, y })
            }
        }

        // viewBoxのサイズを決定
        const viewWidth = maxWidth + padding * 2 + circleRadius * 2
        const viewHeight = (coxeterGroup.ranks.length - 1) * verticalSpacing + padding * 2 + circleRadius * 2

        setCenter(viewWidth / 2, padding + circleRadius)
        clearChildren(lineGroup, elementGroup)

        // 線を描画
        for (const rankElements of coxeterGroup.ranks) {
            for (const element of rankElements) {
                const fromPos = positions.get(element)!
                for (let i = 0; i < element.neighbors.length; i++) {
                    const neighbor = element.neighbors[i]
                    if (!neighbor || neighbor.rank <= element.rank) {
                        continue
                    }
                    const toPos = positions.get(neighbor)!
                    const color = generatorColors[i] ?? "#000000"
                    const line = createLine(fromPos.x, fromPos.y, toPos.x, toPos.y, color, "4")
                    lineGroup.appendChild(line)
                }
            }
        }

        // 丸を描画
        for (const rankElements of coxeterGroup.ranks) {
            for (const element of rankElements) {
                const pos = positions.get(element)!
                const circle = createCircle(pos.x, pos.y, circleRadius, "#FFFFFF", "#000000", "2")
                elementGroup.appendChild(circle)
            }
        }

        previewFigure.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`)
    })
})
