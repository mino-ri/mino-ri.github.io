class Representation {
    static beginCodePoint = 97;
    static charMap = ["a", "b", "c", "d", "e", "f"];
    static getChar(a) {
        if (a < this.charMap.length) {
            return this.charMap[a];
        }
        return String.fromCodePoint(Representation.beginCodePoint + a);
    }
}
export class CoxeterGroupElement {
    index;
    rank;
    representation;
    neighbors;
    #periodValue;
    constructor(index, rank, representation, neighbors) {
        this.index = index;
        this.rank = rank;
        this.representation = representation;
        this.neighbors = neighbors;
        this.#periodValue = undefined;
    }
    mul(other) {
        if (other.rank === 0) {
            return this;
        }
        else if (this.rank === 0) {
            return other;
        }
        let target = this;
        for (let i = 0; i < other.representation.length; i++) {
            const code = other.representation.charCodeAt(i);
            if (Number.isNaN(code)) {
                break;
            }
            target = target.neighbors[code - Representation.beginCodePoint];
        }
        return target;
    }
    toString() {
        return this.representation;
    }
    get period() {
        if (this.#periodValue !== undefined) {
            return this.#periodValue;
        }
        let period = 1;
        let element = this;
        while (element.rank > 0) {
            period++;
            element = element.mul(this);
        }
        this.#periodValue = period;
        return period;
    }
}
export class FiniteCoxeterGroup {
    ranks;
    elements;
    matrix;
    order;
    constructor(matrix) {
        const exchanges = matrix.getExchanges();
        const identity = new CoxeterGroupElement(0, 0, "", new Array(matrix.dimension));
        this.ranks = [[identity]];
        this.elements = [identity];
        this.matrix = matrix;
        let order = 1;
        let index = 1;
        const maxOrder = matrix.dimension >= 4 ? 14401 : 121;
        const maxIncrRank = matrix.dimension >= 4 ? 31 : 13;
        while (true) {
            const nextRank = this.ranks.length;
            const sourceElements = this.ranks[nextRank - 1];
            const targetElements = [];
            for (const element of sourceElements) {
                for (let g = 0; g < matrix.dimension; g++) {
                    if (element.neighbors[g]) {
                        continue;
                    }
                    const newRepresentation = element.representation + Representation.getChar(g);
                    let targetElement = undefined;
                    for (const ex of exchanges[g]) {
                        let followed = FiniteCoxeterGroup.#follow(element, ex.from, 1);
                        if (!followed) {
                            continue;
                        }
                        targetElement = targetElements.find(target => followed === FiniteCoxeterGroup.#follow(target, ex.to));
                        if (targetElement) {
                            break;
                        }
                    }
                    if (!targetElement) {
                        targetElement = new CoxeterGroupElement(index, nextRank, newRepresentation, new Array(matrix.dimension));
                        targetElements.push(targetElement);
                        this.elements.push(targetElement);
                        index++;
                    }
                    targetElement.neighbors[g] = element;
                    element.neighbors[g] = targetElement;
                }
            }
            this.ranks.push(targetElements);
            order += targetElements.length;
            if (order >= maxOrder || nextRank >= maxIncrRank && targetElements.length >= this.ranks[this.ranks.length - 2].length) {
                break;
            }
            else if (targetElements.length == 1 && targetElements[0].neighbors.every(e => !!e)) {
                break;
            }
        }
        identity.representation = "1";
        this.order = order;
    }
    static #follow(beginElement, route, routeIndex) {
        let current = beginElement;
        for (let i = routeIndex ?? 0; i < route.length; i++) {
            const next = current.neighbors[route[i]];
            if (!next || next.rank > current.rank) {
                return null;
            }
            current = next;
        }
        return current;
    }
}
