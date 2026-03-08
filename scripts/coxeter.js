import { clearChildren, createCircle, createLine, setCenter } from "./svg_generator.js";
const generatorColors = ["#DF4121", "#339564", "#217BDF", "#C3B827"];
const directionMap = new Map([[2, [[1, 0], [0, 1]]]]);
const positionCenter = 250;
class Vectors {
    static dot(a, b) {
        let result = 0;
        const length = Math.min(a.length, b.length);
        for (let i = 0; i < length; i++) {
            result += a[i] * b[i];
        }
        return result;
    }
    static mul(a, s) {
        const result = new Array(a.length);
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i] * s;
        }
        return result;
    }
    static add(a, b) {
        const length = Math.min(a.length, b.length);
        const result = new Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = a[i] + b[i];
        }
        return result;
    }
    static sub(a, b) {
        const length = Math.min(a.length, b.length);
        const result = new Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = a[i] - b[i];
        }
        return result;
    }
    static normalize(v) {
        return Vectors.mul(v, 1 / Math.sqrt(Vectors.dot(v, v)));
    }
    static project(v) {
        const dimension = v.length;
        switch (dimension) {
            case 0:
                return { x: 0, y: 0, z: 1 };
            case 1:
                return { x: v[0] * 150, y: 0, z: 1 };
            case 2:
                return { x: v[0] * 150, y: v[1] * -150, z: 1 };
        }
        let directions = directionMap.get(dimension);
        if (!directions) {
            directions = new Array(dimension);
            for (let i = 0; i < dimension; i++) {
                const theta = Math.PI * 2 * (dimension - i - 1) / dimension;
                directions[i] = [Math.sin(theta) * 150, -Math.cos(theta) * 150];
            }
            directionMap.set(dimension, directions);
        }
        let result = { x: 0, y: 0, z: 0 };
        for (let i = 0; i < dimension; i++) {
            const a = v[i];
            const [dx, dy] = directions[i];
            result.x += a * dx;
            result.y += a * dy;
            result.z += a;
        }
        result.z = (result.z / dimension + 2) / 2;
        result.x = result.x * result.z;
        result.y = result.y * result.z;
        return result;
    }
}
class Mirror {
    normal;
    constructor(normal) {
        this.normal = normal;
    }
    reflection(v) {
        const r = -2 * Vectors.dot(v, this.normal);
        return Vectors.add(v, Vectors.mul(this.normal, r));
    }
}
class Representation {
    static beginCodePoint = 97;
    static charMap = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"];
    static getChar(a) {
        if (a < this.charMap.length) {
            return this.charMap[a];
        }
        return String.fromCodePoint(Representation.beginCodePoint + a);
    }
    static getAlternating(a, b, count) {
        const aChar = this.getChar(a);
        const bChar = this.getChar(b);
        const aRepr = new Array(count);
        const bRepr = new Array(count);
        for (let i = 0; i < count; i++) {
            if (i % 2 == 0) {
                aRepr[i] = aChar;
                bRepr[i] = bChar;
            }
            else {
                aRepr[i] = bChar;
                bRepr[i] = aChar;
            }
        }
        return [aRepr.join(""), bRepr.join("")];
    }
    static getAlternatingNumbers(a, b, count) {
        const aRepr = new Array(count);
        const bRepr = new Array(count);
        for (let i = 0; i < count; i++) {
            if (i % 2 == 0) {
                aRepr[i] = a;
                bRepr[i] = b;
            }
            else {
                aRepr[i] = b;
                bRepr[i] = a;
            }
        }
        return [aRepr, bRepr];
    }
}
export class CoxeterMatrix {
    values;
    dimension;
    constructor(values) {
        this.values = values;
        const length = this.values.length;
        this.dimension = Math.sqrt(2 * length + 0.25) + 0.5;
    }
    get(a, b) {
        if (a == b) {
            return 2;
        }
        const index = a > b
            ? a * (a - 1) / 2 + b
            : b * (b - 1) / 2 + a;
        return this.values[index] ?? 2;
    }
    getExchanges() {
        const result = new Array(3);
        for (let i = 0; i < this.dimension; i++) {
            result[i] = [];
        }
        for (let a = 0; a < this.dimension; a++) {
            for (let b = a + 1; b < this.dimension; b++) {
                const m = this.get(a, b);
                const [word0, word1] = Representation.getAlternatingNumbers(a, b, m);
                result[a]?.push({ from: word0, to: word1 });
                result[b]?.push({ from: word1, to: word0 });
            }
        }
        return result;
    }
    static create2D(a) {
        return new CoxeterMatrix([a]);
    }
    static create3D(a, b, c) {
        return new CoxeterMatrix([a, c ?? 2, b]);
    }
    static create4D(a, b, c) {
        return new CoxeterMatrix([a, 2, b, 2, 2, c]);
    }
    static create4DDemicube(a, b, c) {
        return new CoxeterMatrix([a, 2, b, 2, c, 2]);
    }
}
const dummyPosition = [];
export class CoxeterGroupElement {
    index;
    rank;
    representation;
    neighbors;
    #periodValue;
    position;
    constructor(index, rank, representation, neighbors) {
        this.index = index;
        this.rank = rank;
        this.representation = representation;
        this.neighbors = neighbors;
        this.#periodValue = undefined;
        this.position = dummyPosition;
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
    calcPosition(origin, mirrors) {
        this.position = origin;
        if (this.rank === 0) {
            return;
        }
        for (let i = this.representation.length - 1; i >= 0; i--) {
            const code = this.representation.charCodeAt(i);
            if (Number.isNaN(code)) {
                break;
            }
            const mirror = mirrors[code - Representation.beginCodePoint];
            this.position = mirror.reflection(this.position);
        }
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
export class SubgroupElement {
    source;
    rank;
    representation;
    neighbors;
    constructor(source, rank, representation, neighbors) {
        this.source = source;
        this.rank = rank;
        this.representation = representation;
        this.neighbors = neighbors;
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
    get index() {
        return this.source.index;
    }
    get period() {
        return this.source.period;
    }
    get position() {
        return this.source.position;
    }
}
export class CoxeterGroup {
    ranks;
    matrix;
    order;
    hasPosition;
    isLimitOver;
    constructor(matrix) {
        const exchanges = matrix.getExchanges();
        const identity = new CoxeterGroupElement(0, 0, "", new Array(matrix.dimension));
        this.ranks = [[identity]];
        this.matrix = matrix;
        let order = 1;
        let index = 1;
        let isLimitOver = false;
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
                        let followed = CoxeterGroup.#follow(element, ex.from, 1);
                        if (!followed) {
                            continue;
                        }
                        targetElement = targetElements.find(target => followed === CoxeterGroup.#follow(target, ex.to));
                        if (targetElement) {
                            break;
                        }
                    }
                    if (!targetElement) {
                        targetElement = new CoxeterGroupElement(index, nextRank, newRepresentation, new Array(matrix.dimension));
                        targetElements.push(targetElement);
                        index++;
                    }
                    targetElement.neighbors[g] = element;
                    element.neighbors[g] = targetElement;
                }
            }
            this.ranks.push(targetElements);
            order += targetElements.length;
            if (order >= maxOrder || nextRank >= maxIncrRank && targetElements.length >= this.ranks[this.ranks.length - 2].length) {
                isLimitOver = true;
                break;
            }
            if (targetElements.length == 1 && targetElements[0].neighbors.every(e => !!e)) {
                break;
            }
        }
        identity.representation = "1";
        this.order = order;
        this.isLimitOver = isLimitOver;
        this.hasPosition = !isLimitOver && CoxeterGroup.#setPositions(this.ranks, this.matrix);
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
    static #setPositions(elements, matrix) {
        switch (matrix.dimension) {
            case 2:
                return CoxeterGroup.#setPositions2(elements, matrix);
            case 3:
                return CoxeterGroup.#setPositions3(elements, matrix);
            case 4:
                return CoxeterGroup.#setPositions4(elements, matrix);
            default:
                return false;
        }
    }
    static #setPositions2(elements, matrix) {
        if (matrix.dimension !== 2) {
            return false;
        }
        const theta = Math.PI / matrix.get(0, 1) * 0.5;
        const cosP = Math.cos(theta);
        const sinP = Math.sin(theta);
        const origin = [0, 1];
        const mirrors = [
            new Mirror([cosP, sinP]),
            new Mirror([cosP, -sinP]),
        ];
        for (const rank of elements) {
            for (const element of rank) {
                element.calcPosition(origin, mirrors);
            }
        }
        return true;
    }
    static #setPositions3(elements, matrix) {
        if (matrix.dimension !== 3) {
            return false;
        }
        const cosP = Math.cos(Math.PI / matrix.get(0, 1));
        const cosQ = Math.cos(Math.PI / matrix.get(1, 2));
        const cos2P = cosP * cosP;
        const cos2Q = cosQ * cosQ;
        const zs = 1 - cos2P - cos2Q;
        if (zs <= 0.0001) {
            return false;
        }
        const z = Math.sqrt(zs);
        const mirrors = [
            new Mirror([1, 0, 0]),
            new Mirror([-cosP, -cosQ, z]),
            new Mirror([0, 1, 0]),
        ];
        const origin = Vectors.normalize([z, z, 1 + cosP + cosQ]);
        for (const rank of elements) {
            for (const element of rank) {
                element.calcPosition(origin, mirrors);
            }
        }
        return true;
    }
    static #setPositions4(elements, matrix) {
        if (matrix.dimension !== 4) {
            return false;
        }
        const thetaP = Math.PI / matrix.get(0, 1);
        const thetaQ = Math.PI / matrix.get(1, 2);
        const cosP = Math.cos(thetaP);
        const cosQ = Math.cos(thetaQ);
        const s = matrix.get(1, 3);
        const mirrors = [
            new Mirror([1, 0, 0, 0]),
            null,
            null,
            new Mirror([0, 1, 0, 0]),
        ];
        let origin = dummyPosition;
        if (s >= 3) {
            const cosS = Math.cos(Math.PI / s);
            const ws = 1 - cosP * cosP - cosQ * cosQ - cosS * cosS;
            if (ws <= 0.0001) {
                return false;
            }
            const w = Math.sqrt(ws);
            mirrors[1] = new Mirror([-cosP, -cosS, -cosQ, w]);
            mirrors[2] = new Mirror([0, 0, 1, 0]);
            origin = Vectors.normalize([w, w, w, 1 + cosP + cosQ + cosS]);
        }
        else {
            const thetaR = Math.PI / matrix.get(2, 3);
            const sinP = Math.sin(thetaP);
            const sinR = Math.sin(thetaR);
            const cosR = Math.cos(thetaR);
            const z = (1 - cosQ / sinP / sinR) / 2;
            if (z <= 0.0001) {
                return false;
            }
            const cosZ = Math.sqrt(z);
            const sinZ = Math.sqrt(1 - z);
            mirrors[1] = new Mirror([-cosP, 0, sinP * sinZ, sinP * cosZ]);
            mirrors[2] = new Mirror([0, -cosR, -sinR * sinZ, sinR * cosZ]);
            const t = 2 * sinZ * cosZ;
            const tP = (1 + cosP) / sinP;
            const tR = (1 + cosR) / sinR;
            origin = Vectors.normalize([
                t,
                t,
                cosZ * (tP - tR),
                sinZ * (tP + tR),
            ]);
        }
        for (const rank of elements) {
            for (const element of rank) {
                element.calcPosition(origin, mirrors);
            }
        }
        return true;
    }
    static parse(text) {
        const isDemicube = text.startsWith("d");
        if (isDemicube) {
            text = text.slice(1);
        }
        const args = text
            .split(" ")
            .filter(s => s.length > 0)
            .map(s => parseInt(s));
        return new CoxeterGroup(args.length == 1 ? CoxeterMatrix.create2D(args[0])
            : args.length == 2 ? CoxeterMatrix.create3D(args[0], args[1])
                : args.length == 3 ? (isDemicube
                    ? CoxeterMatrix.create4DDemicube(args[0], args[1], args[2])
                    : CoxeterMatrix.create4D(args[0], args[1], args[2]))
                    : CoxeterMatrix.create3D(2, 2));
    }
}
export class CoxeterSubgroup {
    parent;
    ranks;
    order;
    elementMap;
    constructor(parent, generators) {
        this.parent = parent;
        const dimension = generators.length;
        const identitySource = parent.ranks[0][0];
        const identity = new SubgroupElement(identitySource, 0, "", new Array(dimension));
        this.ranks = [[identity]];
        this.elementMap = new Map();
        this.elementMap.set(identitySource, identity);
        this.order = 1;
        let elementAdded = true;
        while (elementAdded) {
            elementAdded = false;
            const nextRank = this.ranks.length;
            const sourceElements = this.ranks[nextRank - 1];
            const targetElements = [];
            for (const element of sourceElements) {
                for (let g = 0; g < dimension; g++) {
                    if (element.neighbors[g]) {
                        continue;
                    }
                    const newParentElement = element.source.mul(generators[g]);
                    let targetElement = this.elementMap.get(newParentElement);
                    if (!targetElement) {
                        const newRepresentation = element.representation + Representation.getChar(g);
                        targetElement = new SubgroupElement(newParentElement, nextRank, newRepresentation, new Array(dimension));
                        targetElements.push(targetElement);
                        this.elementMap.set(newParentElement, targetElement);
                        elementAdded = true;
                        this.order++;
                    }
                    element.neighbors[g] = targetElement;
                }
            }
            this.ranks.push(targetElements);
        }
        identity.representation = "1";
    }
    get hasPosition() {
        return this.parent.hasPosition;
    }
    get isLimitOver() {
        return this.parent.isLimitOver;
    }
}
let coxeterGroup = null;
let selectedElement = [];
class CoxeterGroupRenderer {
    #previewFigure;
    #lineGroup;
    #elementGroup;
    #orderText;
    constructor(previewFigure, lineGroup, elementGroup, orderText) {
        this.#previewFigure = previewFigure;
        this.#lineGroup = lineGroup;
        this.#elementGroup = elementGroup;
        this.#orderText = orderText;
    }
    clear() {
        clearChildren(this.#lineGroup, this.#elementGroup);
    }
    render(coxeterGroup, displayNd) {
        const circleRadius = 6;
        const horizontalSpacing = 40;
        const verticalSpacing = 40;
        const padding = 30;
        const positions = new Map();
        let viewWidth = 0;
        let viewHeight = 0;
        if (displayNd && coxeterGroup.hasPosition) {
            viewWidth = positionCenter * 2;
            viewHeight = positionCenter * 2;
            setCenter(positionCenter, positionCenter);
            const unit = coxeterGroup.ranks[0][0];
            console.log(`${unit.representation} : [${unit.position}]`);
            for (const rank of coxeterGroup.ranks) {
                for (const element of rank) {
                    if (element.rank % 2 === 1 && element.period === 2) {
                        const position = Vectors.normalize(Vectors.sub(element.position, unit.position));
                        console.log(`${element.representation} : [${position}]`);
                    }
                    positions.set(element, Vectors.project(element.position));
                }
            }
        }
        else {
            let maxWidth = 0;
            for (let rankIndex = 0; rankIndex < coxeterGroup.ranks.length; rankIndex++) {
                const rankElements = coxeterGroup.ranks[rankIndex];
                const rankWidth = (rankElements.length - 1) * horizontalSpacing;
                maxWidth = Math.max(maxWidth, rankWidth);
                const startX = -rankWidth / 2;
                const y = rankIndex * verticalSpacing;
                for (let i = 0; i < rankElements.length; i++) {
                    positions.set(rankElements[i], { x: startX + i * horizontalSpacing, y, z: 1 });
                }
            }
            viewWidth = maxWidth + padding * 2 + circleRadius * 2;
            viewHeight = (coxeterGroup.ranks.length - 1) * verticalSpacing + padding * 2 + circleRadius * 2;
            setCenter(viewWidth / 2, padding + circleRadius);
        }
        clearChildren(this.#lineGroup, this.#elementGroup);
        const renderedIndexSet = new Set();
        const allElements = coxeterGroup.ranks.flat();
        allElements.sort((e1, e2) => e1.index - e2.index);
        for (const element of allElements) {
            const fromPos = positions.get(element);
            for (let i = 0; i < element.neighbors.length; i++) {
                const neighbor = element.neighbors[i];
                if (!neighbor) {
                    continue;
                }
                const lineIndex = element.index > neighbor.index
                    ? element.index + neighbor.index * 65536
                    : element.index * 65536 + neighbor.index;
                if (renderedIndexSet.has(lineIndex)) {
                    continue;
                }
                renderedIndexSet.add(lineIndex);
                const toPos = positions.get(neighbor);
                const color = generatorColors[i % generatorColors.length] ?? "#000000";
                const line = createLine(fromPos.x, fromPos.y, toPos.x, toPos.y, color, "4");
                const backLine = createLine(fromPos.x, fromPos.y, toPos.x, toPos.y, "#FFFFFF", "8");
                this.#lineGroup.prepend(line);
                this.#lineGroup.prepend(backLine);
            }
        }
        for (const element of allElements) {
            const pos = positions.get(element);
            const fillColor = element.rank === 0 ? "#000000" : "#FFFFFF";
            const circle = createCircle(pos.x, pos.y, circleRadius * pos.z, fillColor, "#000000", "2");
            if (element.rank !== 0) {
                circle.style.cursor = "pointer";
                circle.addEventListener("click", () => {
                    const index = selectedElement.indexOf(element);
                    if (index === -1) {
                        selectedElement.push(element);
                        circle.setAttribute("fill", "#FF00FF");
                    }
                    else {
                        selectedElement.splice(index, 1);
                        circle.setAttribute("fill", "#FFFFFF");
                    }
                });
            }
            this.#elementGroup.prepend(circle);
        }
        this.#orderText.textContent = `order = ${coxeterGroup.isLimitOver ? "∞" : coxeterGroup.order}`;
        this.#previewFigure.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
    }
}
window.addEventListener("load", () => {
    const textEditor = document.getElementById("textarea_editor");
    const buttonRender = document.getElementById("button_render");
    const checkNd = document.getElementById("checkbox_nd");
    const buttonSubgroup = document.getElementById("button_subgroup");
    const previewFigure = document.getElementById("preview_figure");
    const lineGroup = document.getElementById("line_group");
    const elementGroup = document.getElementById("element_group");
    const oerderText = document.getElementById("order_text");
    const renderer = new CoxeterGroupRenderer(previewFigure, lineGroup, elementGroup, oerderText);
    buttonRender.addEventListener("click", () => {
        coxeterGroup = CoxeterGroup.parse(textEditor.value);
        selectedElement.length = 0;
        renderer.render(coxeterGroup, checkNd.checked);
    });
    buttonSubgroup.addEventListener("click", () => {
        if (!coxeterGroup || selectedElement.length < 1) {
            return;
        }
        coxeterGroup = new CoxeterSubgroup(coxeterGroup, [...selectedElement]);
        selectedElement.length = 0;
        renderer.render(coxeterGroup, checkNd.checked);
    });
});
