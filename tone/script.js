class WaveWriter {
    constructor() {
        this.buffer = "";
    }

    writeByte(byte) {
        this.buffer += String.fromCharCode(byte);
    }

    writeText(text) {
        this.buffer += text;
    }

    writeInt16(value) {
        this.writeByte(value & 0xFF);
        this.writeByte((value >> 8) & 0xFF);
    }

    writeInt32(value) {
        this.writeByte(value & 0xFF);
        this.writeByte((value >> 8) & 0xFF);
        this.writeByte((value >> 16) & 0xFF);
        this.writeByte((value >> 24) & 0xFF);
    }

    encodeBase64() {
        return btoa(this.buffer);
    }
    
    static fromChunks(chunks) {
        const waveWriter = new WaveWriter();
        const sumSize = chunks.reduce((acm, chunk) => acm + chunk.size + 8, 0);
        
        waveWriter.writeText("RIFF");
        waveWriter.writeInt32(sumSize + 4);
        waveWriter.writeText("WAVE");
        
        for (let chunk of chunks) {
            waveWriter.writeText(chunk.tag);
            waveWriter.writeInt32(chunk.size);
            chunk.writeDataTo(waveWriter);
        }

        return waveWriter;
    }
}

class WaveHeader {
    constructor(code, channels, samplesPerSecond, bytesPerSample) {
        this.code = code;
        this.channels = channels;
        this.samplesPerSecond = samplesPerSecond;
        this.bytesPerSecond = samplesPerSecond * channels * bytesPerSample;
        this.blockAlign = channels * bytesPerSample;
        this.bitsPerSample = bytesPerSample * 8;
    }
    
    get size() {
        return 16;
    }

    get tag() {
        return "fmt ";
    }

    writeDataTo(writer) {
        writer.writeInt16(this.code);
        writer.writeInt16(this.channels);
        writer.writeInt32(this.samplesPerSecond);
        writer.writeInt32(this.bytesPerSecond);
        writer.writeInt16(this.blockAlign);
        writer.writeInt16(this.bitsPerSample);
    }

    // static stereo = new WaveHeader(1, 2, 44100, 1);
    static monaural = new WaveHeader(1, 1, 44100, 1);
}

class WaveData {
    constructor(size) {
        this.size = size;
        this.data = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            this.data[i] = 128;
        }
    }

    get tag() {
        return "data";
    }

    writeDataTo(writer) {
        for (let i = 0; i < this.size; i++) {
            writer.writeByte(this.data[i]);
        }
    }

    addFloat(index, value) {
        this.data[index] = Math.max(0, Math.min(255, this.data[index] + Math.floor(value * 127.0)));
    }

    addSine(hz, volume, begin, length) {
        const wavelength = 44100 / hz;
        const length2 = Math.floor(Math.floor(length / wavelength) * wavelength);
        const phase = Math.PI * 2 * hz / 44100;
        for (let i = 0; i < length2; i++) {
            this.addFloat(i + begin, Math.sin(i * phase) * volume);
        }
    }
}

const codePoint0 = "0".codePointAt(0);
const codePoint9 = "9".codePointAt(0);

const toneSettings = {
    "12": {
        baseTones: {
            C: 27.5 * (2.0 ** (-9.0 / 12.0)),
            D: 27.5 * (2.0 ** (-7.0 / 12.0)),
            E: 27.5 * (2.0 ** (-5.0 / 12.0)),
            F: 27.5 * (2.0 ** (-4.0 / 12.0)),
            G: 27.5 * (2.0 ** (-2.0 / 12.0)),
            A: 27.5,
            B: 27.5 * (2.0 ** (2.0 / 12.0)),
        },
        semiTone: 2.0 ** (1.0 / 12.0),
        quatTone: 2.0 ** (0.5 / 12.0),
    },
    "31": {
        baseTones: {
            C: 27.5 * (2.0 ** (-23.0 / 31.0)),
            D: 27.5 * (2.0 ** (-18.0 / 31.0)),
            E: 27.5 * (2.0 ** (-13.0 / 31.0)),
            F: 27.5 * (2.0 ** (-10.0 / 31.0)),
            G: 27.5 * (2.0 ** (-5.0 / 31.0)),
            A: 27.5,
            B: 27.5 * (2.0 ** (5.0 / 31.0)),
        },
        semiTone: 2.0 ** (2.0 / 31.0),
        quatTone: 2.0 ** (1.0 / 31.0),
    },
};

var toneSetting = toneSettings["12"];

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

// 1行のテキストを受け取り、トーンとして解釈して周波数である数値を返す
function readTone(text) {
    let result = 0.0;
    if (text == "'31") {
        toneSetting = toneSettings["31"];
        return 0;
    } else if (text == "'12") {
        toneSetting = toneSettings["12"];
        return 0;
    }

    for (let i = 0; i < text.length; i++) {
        const c = text[i] + "";
        if (c.trim() == "") {
            continue;
        } else if (toneSetting.baseTones[c]) {
            result = toneSetting.baseTones[c];
        } else if (c == "#") {
            result *= toneSetting.semiTone;
        } else if (c == "b" || c == "♭") {
            result /= toneSetting.semiTone;
        } else if (c == "+" || c == "ｷ") {
            result *= toneSetting.quatTone;
        } else if (c == "-" || c == "d") {
            result /= toneSetting.quatTone;
        } else if (c == "*") {
            let { index, num } = readFraction(text, i + 1);
            i = index;
            result *= num;
        } else if (c == "+") {
            let { index, num } = readFraction(text, i + 1);
            i = index;
            result *= 2 ** num;
        } else if (isDigit(c)) {
            let { index, num } = readFraction(text, i);
            i = index;
            result *= 2 ** num;
        }
    }

    return result;
}

function readTones(source) {
    toneSetting = toneSettings["12"];
    const lines = source
        .split('\n')
        .map(s => s.trim())
        .filter(s => s != "")
        .map(readTone)
        .filter(t => 1.0 <= t && t <= 200000);
    console.log(lines);
    return lines;
}

function deleteRow(elm) {
    const tr = elm.parentNode.parentNode;
    tr.parentNode.deleteRow(tr.sectionRowIndex);
}

function createAudio() {
    const source = document.getElementById("textarea_tones").value + "";
    const lines = readTones(source);
    if (lines.length == 0) {
        return;
    }
    const data = new WaveData(44100 * 2);
    for (let i = 0; i < lines.length; i++) {
        data.addSine(lines[i], 0.95 / lines.length, 0, 80000);
    }

    const k = WaveWriter.fromChunks([WaveHeader.monaural, data]);
    const base64Encoded = "data:audio/wav;base64," + k.encodeBase64();
    const audio = document.createElement("audio");
    audio.src = base64Encoded;
    audio.controls = true;
    audio.play();
    const tdCode = document.createElement("td");
    tdCode.innerText = source;
    const tdAudio = document.createElement("td");
    tdAudio.appendChild(audio);
    const tdOperation = document.createElement("td");
    tdOperation.innerHTML = '<input type="button" value="削除" onclick="javascript:deleteRow(this)" />';
    const tr = document.createElement("tr");
    tr.appendChild(tdCode);
    tr.appendChild(tdAudio);
    tr.appendChild(tdOperation);
    document.getElementById("tones").prepend(tr);
}
