import { CoxeterMatrix } from "./coxeter_matrix.js"

class Representation {
    static beginCodePoint = 97 // 'a'

    static charMap = ["a", "b", "c", "d", "e", "f"]

    static getChar(a: number): string {
        if (a < this.charMap.length) {
            return this.charMap[a]!
        }

        return String.fromCodePoint(Representation.beginCodePoint + a)
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


// コクセター群
export class FiniteCoxeterGroup {
    ranks: CoxeterGroupElement[][]
    elements: CoxeterGroupElement[]
    matrix: CoxeterMatrix
    order: number

    constructor(matrix: CoxeterMatrix) {
        const exchanges = matrix.getExchanges()
        const identity = new CoxeterGroupElement(0, 0, "", new Array(matrix.dimension))
        this.ranks = [[identity]]
        this.elements = [identity]
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
                        let followed = FiniteCoxeterGroup.#follow(element, ex.from, 1)
                        if (!followed) {
                            continue
                        }

                        targetElement = targetElements.find(target => followed === FiniteCoxeterGroup.#follow(target, ex.to))
                        if (targetElement) {
                            break
                        }
                    }

                    // 新規要素を作るか、既存要素の隣を登録
                    if (!targetElement) {
                        targetElement = new CoxeterGroupElement(index, nextRank, newRepresentation, new Array(matrix.dimension))
                        targetElements.push(targetElement)
                        this.elements.push(targetElement)
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
            } else if (targetElements.length == 1 && targetElements[0]!.neighbors.every(e => !!e)) {
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
}
