class ExprNumber {
    value = 0;
    constructor(value) {
        this.value = value;
    }

    getValue() {
        return this.value;
    }

    getMath() {
        return `<mn>${this.value}</mn>`;
    }
}

class ExprFraction {
    numerator;
    denominator;
    constructor(numerator, denominator) {
        this.numerator = numerator;
        this.denominator = denominator;
    }

    getValue() {
        return this.numerator / this.denominator;
    }

    getMath() {
        return `<mfrac>${this.numerator.getMath()}${this.denominator.getMath()}</mfrac>`;
    }
}

const codePoint0 = "0".codePointAt(0);
const codePoint9 = "9".codePointAt(0);

function $(id) {
    return  document.getElementById(id);
}

// text の0文字目が0-9か
function isDigit(text) {
    const codePoint = text.codePointAt(0);
    return codePoint0 <= codePoint && codePoint <= codePoint9;
}

// text の index 文字目から整数として解釈できるだけ文字列を読み込む(空白を無視)
function readInteger(text, index) {
    let i = index;
    let result = 0.0;
    for (; i < text.length; i++) {
        const c = text.charAt(i) + "";
        const codePoint = c.codePointAt(0);
        if (c.trim() == "") {
            continue;
        } else if (isDigit(c)) {
            result = result * 10 + codePoint - codePoint0;
            continue;
        } else {
            break;
        }
    }

    return { index: i, num: result };
}

// 先行するスペースをスキップ
function skipSpaces(text, index) {
    let i = index;
    for (; i < text.length && text.charAt(i).trim() == ""; i++) {
    }
    return i;
}

function readFactor(text, index) {
    let i = skipSpaces(text, index);
    if (i < text.length && text.charAt(i) == "(") {
        let { index: i1, num: value } = readTerm(text, i + 1);
        i1 = skipSpaces(text, i1);
        if (i1 < text.length && text.charAt(i1) == ")") {
            i1++;
        }
        return { index: i1, num: value };
    } else {
        return readInteger(text, i);
    }
}

// text の index 文字目から、 n^i の形で表される累乗を読み込む
function readPow(text, index) {
    let { index: i, num: value } = readFactor(text, index);
    for (; i < text.length; i++) {
        const c = text.charAt(i) + "";
        if (c.trim() == "") {
            continue;
        } else if (c == "^") {
            let { index: i1, num: power } = readFactor(text, i + 1);
            return { index: i1, num: value ** power };
        } else {
            break;
        }
    }

    return { index: i, num: value };
}

// text の index 文字目から、n/d の形で表される分数を読み込む
function readFraction(text, index) {
    let { index: i, num: value } = readPow(text, index);
    for (; i < text.length; i++) {
        const c = text.charAt(i) + "";
        console.log(`index: ${i} : '${c}'`);
        if (c.trim() == "") {
            continue;
        } else if (c == "/") {
            let { index: i1, num: denominator } = readPow(text, i + 1);
            i = i1 - 1;
            value = value / denominator;
        } else if (c == "*") {
            let { index: i1, num: operand } = readPow(text, i + 1);
            i = i1 - 1;
            value = value * operand;
        } else {
            break;
        }
    }

    return { index: i, num: value };
}

// text の index 文字目から、n/d の形で表される分数を読み込む
function readTerm(text, index) {
    let { index: i, num: value } = readFraction(text, index);
    for (; i < text.length; i++) {
        const c = text.charAt(i) + "";
        console.log(`index: ${i} : '${c}'`);
        if (c.trim() == "") {
            continue;
        } else if (c == "+") {
            let { index: i1, num: operand } = readFraction(text, i + 1);
            i = i1 - 1;
            value = value + operand;
        } else if (c == "-") {
            let { index: i1, num: operand } = readFraction(text, i + 1);
            i = i1 - 1;
            value = value - operand;
        } else {
            break;
        }
    }

    return { index: i, num: value };
}

function readPitch(text, index) {
    try {
        let { num } = readTerm(text, 0);
        return num;
    } catch {
        return NaN;
    }
}

var figureRadius = 100;
var centerX = 150;
var centerY = 150;

function calcPitchClass(frequency) {
    return (Math.log2(frequency) % 1.0) * 2.0 * Math.PI;
}

function calcX(pitchClass) {
    return centerX + Math.cos(pitchClass) * figureRadius;
}

function calcY(pitchClass) {
    return centerY - Math.sin(pitchClass) * figureRadius;
}

function resetFigure() {
    const pitchPointGroup = $("pitch_point_group");
    while (pitchPointGroup.firstChild) {
        pitchPointGroup.removeChild(pitchPointGroup.firstChild);
    }
    const ratioLineGroup = $("ratio_line_group");
    while (ratioLineGroup.firstChild) {
        ratioLineGroup.removeChild(ratioLineGroup.firstChild);
    }
}

function pitchPointId(index) {
    return `pitch_point${index}`;
}

function ratioLineId(index) {
    return `ratio_line${index}`;
}

function createPitchPoint(frequency, index, color) {
    const pitchClass = calcPitchClass(frequency);
    const figureSvg = $("pitch_point_group");
    const pitchPoint = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pitchPoint.id = pitchPointId(index);
    pitchPoint.setAttribute("class", "pitch");
    pitchPoint.setAttribute("r", 6);
    pitchPoint.setAttribute("cx", calcX(pitchClass));
    pitchPoint.setAttribute("cy", calcY(pitchClass));
    pitchPoint.style.fill = color;
    figureSvg.appendChild(pitchPoint);
}

function createRatioLine(frequency1, frequency2, index, color) {
    const pitchClass1 = calcPitchClass(frequency1);
    const pitchClass2 = calcPitchClass(frequency2);
    const figureSvg = $("ratio_line_group");
    const ratioLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ratioLine.id = ratioLineId(index);
    ratioLine.setAttribute("class", "ratio");
    ratioLine.setAttribute("x1", calcX(pitchClass1));
    ratioLine.setAttribute("y1", calcY(pitchClass1));
    ratioLine.setAttribute("x2", calcX(pitchClass2));
    ratioLine.setAttribute("y2", calcY(pitchClass2));
    ratioLine.style.stroke = color;
    figureSvg.appendChild(ratioLine);
}

function createFigure() {
    const container = $(controlContainerName);
    const toneCount = (container.childElementCount + 1) / 2;

    resetFigure();
    let prevPitch = NaN;
    for (var i = 0; i < toneCount; i++) {
        var pitch = readPitch($(`freq${i}`).value, 0);
        if (!isFinite(pitch) || pitch <= 0) {
            pitch = 1;
        }
        createPitchPoint(pitch, i, $(`pitch_color${i}`).value);
        
        if (prevPitch > 0 && $(`ratio${i}`).checked) {
            createRatioLine(prevPitch, pitch, i, $(`ratio_color${i}`).value);
        }
        prevPitch = pitch;
    }
}

var controlContainerName = "control_container";

function createLabel(forId, content) {
    const label = document.createElement("label");
    label.htmlFor = forId;
    label.innerText = content;
    return label;
}

function createTextBox(id, value) {
    const input = document.createElement("input");
    input.id = id;
    input.name = id;
    input.type = "text";
    input.value = value;
    input.oninput = createFigure;
    return input;
}

function createCheckBox(id, value) {
    const input = document.createElement("input");
    input.id = id;
    input.name = id;
    input.type = "checkbox";
    input.checked = value;
    input.oninput = createFigure;
    return input;
}

function createColor(id, value) {
    const input = document.createElement("input");
    input.id = id;
    input.name = id;
    input.type = "color";
    input.value = value;
    input.oninput = createFigure;
    return input;
}

// '末尾に追加'ボタン
function addTone() {
    const container = $(controlContainerName);
    const childCount = (container.childElementCount + 1) / 2;
    const controlRatio = document.createElement("div");
    controlRatio.className = "control-ratio";
    {
        const divRatioVisible = document.createElement("div");
        divRatioVisible.appendChild(createCheckBox(`ratio${childCount}`, true));
        divRatioVisible.append(" ");
        divRatioVisible.appendChild(createLabel(`ratio${childCount}`, "線を表示"));
        controlRatio.appendChild(divRatioVisible);

        const divRatioColor = document.createElement("div");
        divRatioColor.appendChild(createLabel(`ratio_color${childCount}`, "色"));
        divRatioColor.append(" ");
        divRatioColor.appendChild(createColor(`ratio_color${childCount}`, "#ff0000"));
        controlRatio.appendChild(divRatioColor);
    }
    container.appendChild(controlRatio);

    const controlTone = document.createElement("div");
    controlTone.className = "control-tone";
    {
        const divFreq = document.createElement("div");
        divFreq.appendChild(createLabel(`freq${childCount}`, "値"));
        divFreq.append(" ");
        divFreq.appendChild(createTextBox(`freq${childCount}`, "1"))
        controlTone.appendChild(divFreq);

        const divPitchColor = document.createElement("div");
        divPitchColor.appendChild(createLabel(`pitch_color${childCount}`, "色"));
        divPitchColor.append(" ");
        divPitchColor.appendChild(createColor(`pitch_color${childCount}`, "#000000"));
        controlTone.appendChild(divPitchColor);
     }
    container.appendChild(controlTone);
    createFigure();
}

// '末尾を削除'ボタン
function removeLastTone() {
    const container = $(controlContainerName);
    if (container.childElementCount <= 1) {
        return;
    }
    container.removeChild(container.lastElementChild);
    container.removeChild(container.lastElementChild);
    createFigure();
}

window.onload = () => {
    createPitchPoint(4, 0, "#000000");
};
