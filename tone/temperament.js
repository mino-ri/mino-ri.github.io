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

// text の index 文字目から、n/d の形で表される分数を読み込む
function readFraction(text, index) {
    let { index: i, num: value } = readInteger(text, index);
    for (; i < text.length; i++) {
        const c = text.charAt(i) + "";
        if (c.trim() == "") {
            continue;
        } else if (c == "/") {
            let { index: i1, num: denominator } = readInteger(text, i + 1);
            return { index: i1, num: value / denominator };
        } else {
            i = i - 1;
            break;
        }
    }

    return { index: i, num: value };
}

function readPitch(text, index) {
    try {
        let { num } = readFraction(text, 0);
        return num;
    } catch {
        return NaN;
    }
}

var figureRadius = 100;
var centerX = 200;
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

function createPitchPoint(frequency) {
    const pitchClass = calcPitchClass(frequency);
    const figureSvg = $("pitch_point_group");
    const pitchPoint = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pitchPoint.setAttribute("class", "pitch");
    pitchPoint.style.cx = calcX(pitchClass);
    pitchPoint.style.cy = calcY(pitchClass);
    figureSvg.appendChild(pitchPoint);
}

function createRatioLine(frequency1, frequency2) {
    const pitchClass1 = calcPitchClass(frequency1);
    const pitchClass2 = calcPitchClass(frequency2);
    const figureSvg = $("ratio_line_group");
    const ratioLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ratioLine.setAttribute("class", "ratio");
    ratioLine.setAttribute("x1", calcX(pitchClass1));
    ratioLine.setAttribute("y1", calcY(pitchClass1));
    ratioLine.setAttribute("x2", calcX(pitchClass2));
    ratioLine.setAttribute("y2", calcY(pitchClass2));
    figureSvg.appendChild(ratioLine);
}

function createFigure() {
    const source = document.getElementById("textarea_pitches").value + "";
    const pitches = source
        .split(" ")
        .map(s => s.trim())
        .filter(s => s != "")
        .map(s => readPitch(s, 0))
        .filter(pitch => isFinite(pitch) && pitch > 0);

    resetFigure();
    var prevPitch = NaN;
    for (let pitch of pitches) {
        createPitchPoint(pitch);
        if (prevPitch > 0) {
            createRatioLine(prevPitch, pitch);
        }
        prevPitch = pitch;
    }
}

window.onload = () => {
    createPitchPoint(1);
    createPitchPoint(1.25);
    createPitchPoint(1.5);
    createRatioLine(1, 1.25);
    createRatioLine(1.25, 1.5);
};
