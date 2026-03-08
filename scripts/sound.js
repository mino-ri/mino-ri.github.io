export class WaveWriter {
    buffer;
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
export class WaveHeader {
    code;
    channels;
    samplesPerSecond;
    bytesPerSecond;
    blockAlign;
    bitsPerSample;
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
    static monaural = new WaveHeader(1, 1, 44100, 1);
}
export class WaveData {
    size;
    data;
    constructor(size) {
        this.size = size;
        this.data = new Float64Array(size);
        for (let i = 0; i < size; i++) {
            this.data[i] = 0.0;
        }
    }
    get tag() {
        return "data";
    }
    writeDataTo(writer) {
        for (let i = 0; i < this.size; i++) {
            writer.writeByte(Math.min(255, Math.floor((this.data[i] ?? 0) * 128.0) + 128));
        }
    }
    addFloat(index, value) {
        this.data[index] = (this.data[index] ?? 0) + value;
    }
    addSine(hz, volume, begin, length) {
        const wavelength = 44100 / hz;
        const length2 = Math.floor(Math.floor(length / wavelength) * wavelength);
        const phase = Math.PI * 2 * hz / 44100;
        for (let i = 0; i < length2; i++) {
            const startVolume = volume * Math.min(500, i) / 500.0;
            const endVolume = volume * Math.min(2000, length2 - i) / 2000.0;
            this.addFloat(i + begin, Math.sin(i * phase) * Math.min(startVolume, endVolume));
        }
        return length2;
    }
    addSaw(hz, volume, begin, length) {
        const wavelength = 44100 / hz;
        const length2 = Math.floor(Math.floor(length / wavelength) * wavelength);
        const phase = 44100 / hz;
        for (let i = 0; i < length2; i++) {
            const startVolume = volume * Math.min(500, i) / 500.0;
            const endVolume = volume * Math.min(2000, length2 - i) / 2000.0;
            this.addFloat(i + begin, (((i % phase) / phase) * 1.2 - 0.6) * Math.min(startVolume, endVolume));
        }
        return length2;
    }
}
export class AudioSource {
    constructor() { }
    static create(data) {
        return "data:audio/wav;base64," + WaveWriter.fromChunks([WaveHeader.monaural, data]).encodeBase64();
    }
    static createFromMonzos(monzos, baseHz, seconds, quantizeEdo) {
        const data = new WaveData(Math.floor(seconds * 44100));
        const volume = 0.95 / Math.max(monzos.length, 8);
        for (const monzo of monzos) {
            data.addSaw(baseHz * monzo.quantizedValue(quantizeEdo), volume, 0, Math.floor(seconds * 40000));
        }
        return AudioSource.create(data);
    }
    static createFromMonzoSerial(monzos, baseHz, seconds, quantizeEdo) {
        const data = new WaveData(Math.floor(seconds * 44100 * monzos.length));
        const volume = 0.9;
        let index = 0;
        for (const monzo of monzos) {
            data.addSaw(baseHz * monzo.quantizedValue(quantizeEdo), volume, Math.floor(index * seconds * 44100), Math.floor(seconds * 40000));
            index++;
        }
        return AudioSource.create(data);
    }
}
export class Sound {
    constructor() { }
    static createMonoAudio(data) {
        const audio = document.createElement("audio");
        audio.src = AudioSource.create(data);
        return audio;
    }
}
