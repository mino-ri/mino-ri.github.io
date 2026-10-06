import { setCenter, createPolyLine, createRect, clearChildren } from "./svg_generator.js"

class MosTester {
    private audioContext = new AudioContext()
    private period = 12000
    private minMosSize = 6
    private mainPitches: number[] = []
    private subPitches: number[] = []
    private subPitchPlaces: number[] = []

    constructor(
        inputGenerator: HTMLInputElement,
        private svgGroupPitch: SVGGElement,
        private svgGroupKeyboard: SVGGElement,
    ) {
        const eventListner = () => {
            const newGenerator = parseInt(inputGenerator.value)
            if (Number.isFinite(newGenerator)) {
                this.calcMos(newGenerator)
                this.createSvg()
                this.createKeyboard()
            }
        }
        inputGenerator.addEventListener("input", eventListner)
        eventListner()
    }

    private calcMos(generator: number) {
        let a = generator
        let b = this.period - generator
        let largeCount = 1
        let smallCount = 1

        while ((largeCount + smallCount < this.minMosSize || largeCount == 1) && a !== b) {
            // 次のスケールの間隔を計算
            const largeSize = Math.max(a, b)
            const smallSize = Math.min(a, b)
            a = smallSize
            b = largeSize - smallSize

            // 次のスケールの音数を計算
            const aCount = largeCount + smallCount
            const bCount = largeCount
            if (a <= b) {
                largeCount = bCount
                smallCount = aCount
            } else {
                largeCount = aCount
                smallCount = bCount
            }
        }

        const mainPitchCount = largeCount + smallCount
        const subPitchCount = a === b ? 0 : largeCount
        this.mainPitches = [...Array(mainPitchCount)].map((_, i) => i * generator % this.period).sort((a, b) => a - b)
        this.subPitches = [...Array(subPitchCount)].map((_, i) => (i + mainPitchCount) * generator % this.period).sort((a, b) => a - b)
        this.subPitchPlaces = this.subPitches.map((s) => this.mainPitches.findLastIndex((x) => x <= s) + 0.5)
    }

    private createSvg() {
        const svgWidth = 25400
        const svgOffset = -700
        const mainKeyCount = this.mainPitches.length * 2 + 1
        const mainKeyInterval = svgWidth / mainKeyCount
        clearChildren(this.svgGroupPitch)
        this.subPitches.forEach((s, i) => {
            const place = this.subPitchPlaces[i] ?? 0
            this.svgGroupPitch.appendChild(createPolyLine([[s, 0], [s, 1000], [mainKeyInterval * (place + 0.5) + svgOffset, 1500]], "#287950", "100", "square"))
            this.svgGroupPitch.appendChild(createPolyLine([[s + 12000, 0], [s + 12000, 1000], [mainKeyInterval * (place + this.mainPitches.length + 0.5) + svgOffset, 1500]], "#287950", "100", "square"))
        })

        this.mainPitches.forEach((l, i) => {
            this.svgGroupPitch.appendChild(createPolyLine([[l, 0], [l, 1000], [mainKeyInterval * (i + 0.5) + svgOffset, 1500]], "#FF9900", "100", "square"))
            this.svgGroupPitch.appendChild(createPolyLine([[l + 12000, 0], [l + 12000, 1000], [mainKeyInterval * (i + this.mainPitches.length + 0.5) + svgOffset, 1500]], "#FF9900", "100", "square"))
        })

        this.svgGroupPitch.appendChild(createPolyLine([[24000, 0], [24000, 1000], [mainKeyInterval * (mainKeyCount - 0.5) + svgOffset, 1500]], "#FF9900", "100", "square"))
    }

    createKeyboard() {
        const svgWidth = 25400
        const svgOffset = -700
        const mainKeyCount = this.mainPitches.length * 2 + 1
        const mainKeyInterval = svgWidth / mainKeyCount
        clearChildren(this.svgGroupKeyboard)
        this.mainPitches.forEach((l, i) => {
            const rect0 = createRect(mainKeyInterval * i + svgOffset, 1500, mainKeyInterval, 4400, "#EEEEEE", "#000000", "20")
            const rect1 = createRect(mainKeyInterval * (i + this.mainPitches.length) + svgOffset, 1500, mainKeyInterval, 4400, "#EEEEEE", "#000000", "20")
            rect0.addEventListener("click", () => this.playTone(l))
            rect1.addEventListener("click", () => this.playTone(l + 12000))
            this.svgGroupKeyboard.appendChild(rect0)
            this.svgGroupKeyboard.appendChild(rect1)
        })
        
        const rectLast = createRect(mainKeyInterval * (mainKeyCount - 1) + svgOffset, 1500, mainKeyInterval, 4400, "#EEEEEE", "#000000", "20")
        rectLast.addEventListener("click", () => this.playTone(24000))
        this.svgGroupKeyboard.appendChild(rectLast)

        const subKeyWidth = mainKeyInterval * 0.75
        const subKeyOffset = (mainKeyInterval - subKeyWidth) / 2
        this.subPitches.forEach((s, i) => {
            const place = this.subPitchPlaces[i] ?? 0
            const rect0 = createRect(mainKeyInterval * place + svgOffset + subKeyOffset, 1500, subKeyWidth, 2250, "#222222", "#000000", "20")
            const rect1 = createRect(mainKeyInterval * (place + this.mainPitches.length) + svgOffset + subKeyOffset, 1500, subKeyWidth, 2250, "#222222", "#000000", "20")
            rect0.addEventListener("click", () => this.playTone(s))
            rect1.addEventListener("click", () => this.playTone(s + 12000))
            this.svgGroupKeyboard.appendChild(rect0)
            this.svgGroupKeyboard.appendChild(rect1)
        })
    }

    playTone(mill: number) {
        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()
        osc.type = "triangle"
        osc.frequency.value = (2 ** (mill / 12000)) * 174.6141157165
        const now = this.audioContext.currentTime

        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.25, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
        osc.connect(gain)
        gain.connect(this.audioContext.destination)
        osc.start(now)
        osc.stop(now + 1.2)
    }
}

window.addEventListener("load", () => {
    setCenter(0, 0)
    const inputGenerator = document.getElementById("input_generator") as HTMLInputElement
    const svgGroupPitch = document.getElementById("g_pitches") as unknown as SVGGElement
    const svgGroupKeyboard = document.getElementById("g_keyboard") as unknown as SVGGElement
    new MosTester(inputGenerator, svgGroupPitch, svgGroupKeyboard)
})
