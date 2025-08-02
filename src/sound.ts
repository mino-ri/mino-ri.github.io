import { Monzo } from "./monzo"

export interface IWaveChunk {
    size: number
    tag: string
    writeDataTo(writer: WaveWriter): void
}

export class WaveWriter {
    buffer: string
    constructor() {
        this.buffer = ""
    }

    writeByte(byte: number) {
        this.buffer += String.fromCharCode(byte)
    }

    writeText(text: string) {
        this.buffer += text
    }

    writeInt16(value: number) {
        this.writeByte(value & 0xFF)
        this.writeByte((value >> 8) & 0xFF)
    }

    writeInt32(value: number) {
        this.writeByte(value & 0xFF)
        this.writeByte((value >> 8) & 0xFF)
        this.writeByte((value >> 16) & 0xFF)
        this.writeByte((value >> 24) & 0xFF)
    }

    encodeBase64() {
        return btoa(this.buffer)
    }

    static fromChunks(chunks: IWaveChunk[]) {
        const waveWriter = new WaveWriter()
        const sumSize = chunks.reduce((acm, chunk) => acm + chunk.size + 8, 0)

        waveWriter.writeText("RIFF")
        waveWriter.writeInt32(sumSize + 4)
        waveWriter.writeText("WAVE")

        for (let chunk of chunks) {
            waveWriter.writeText(chunk.tag)
            waveWriter.writeInt32(chunk.size)
            chunk.writeDataTo(waveWriter)
        }

        return waveWriter
    }
}

export class WaveHeader {
    code: number
    channels: number
    samplesPerSecond: number
    bytesPerSecond: number
    blockAlign: number
    bitsPerSample: number
    constructor(code: number, channels: number, samplesPerSecond: number, bytesPerSample: number) {
        this.code = code
        this.channels = channels
        this.samplesPerSecond = samplesPerSecond
        this.bytesPerSecond = samplesPerSecond * channels * bytesPerSample
        this.blockAlign = channels * bytesPerSample
        this.bitsPerSample = bytesPerSample * 8
    }

    get size() {
        return 16
    }

    get tag() {
        return "fmt "
    }

    writeDataTo(writer: WaveWriter) {
        writer.writeInt16(this.code)
        writer.writeInt16(this.channels)
        writer.writeInt32(this.samplesPerSecond)
        writer.writeInt32(this.bytesPerSecond)
        writer.writeInt16(this.blockAlign)
        writer.writeInt16(this.bitsPerSample)
    }

    // static stereo = new WaveHeader(1, 2, 44100, 1)
    static monaural = new WaveHeader(1, 1, 44100, 1)
}

export class WaveData {
    size: number
    data: Float64Array
    constructor(size: number) {
        this.size = size
        this.data = new Float64Array(size)
        for (let i = 0; i < size; i++) {
            this.data[i] = 0.0
        }
    }

    get tag() {
        return "data"
    }

    writeDataTo(writer: WaveWriter) {
        for (let i = 0; i < this.size; i++) {
            writer.writeByte(Math.min(255, Math.floor((this.data[i] ?? 0) * 128.0) + 128))
        }
    }

    addFloat(index: number, value: number) {
        this.data[index] = (this.data[index] ?? 0) + value
    }

    addSine(hz: number, volume: number, begin: number, length: number) {
        const wavelength = 44100 / hz
        const length2 = Math.floor(Math.floor(length / wavelength) * wavelength)
        const phase = Math.PI * 2 * hz / 44100
        for (let i = 0; i < length2; i++) {
            const startVolume = volume * Math.min(500, i) / 500.0
            const endVolume = volume * Math.min(2000, length2 - i) / 2000.0
            this.addFloat(i + begin, Math.sin(i * phase) * Math.min(startVolume, endVolume))
        }

        return length2
    }

    addSaw(hz: number, volume: number, begin: number, length: number) {
        const wavelength = 44100 / hz
        const length2 = Math.floor(Math.floor(length / wavelength) * wavelength)
        const phase = 44100 / hz
        for (let i = 0; i < length2; i++) {
            const startVolume = volume * Math.min(500, i) / 500.0
            const endVolume = volume * Math.min(2000, length2 - i) / 2000.0
            this.addFloat(i + begin, (((i % phase) / phase) * 1.2 - 0.6) * Math.min(startVolume, endVolume))
        }

        return length2
    }
}

export class AudioSource {
    constructor() {}
    
    static create(data: WaveData): string {
        return "data:audio/wav;base64," + WaveWriter.fromChunks([WaveHeader.monaural, data]).encodeBase64()
    }
    
    static createFromMonzos(monzos: Monzo[], baseHz: number, seconds: number): string {
        const data = new WaveData(Math.floor(seconds * 44100))
        for (const monzo of monzos) {
            data.addSaw(baseHz * monzo.value, 0.95 / monzos.length, 0, Math.floor(seconds * 40000))
        }
        return AudioSource.create(data)
    }}

export class Sound {
    constructor() {}

    static createMonoAudio(data: WaveData) {
        const audio = document.createElement("audio")
        audio.src = AudioSource.create(data)
        return audio
    }
}
