import { setCenter, createPolyLine, createRect, clearChildren } from "./svg_generator.js"

const svgMargin = 700

type MosSetting = {
    period: number
    periodCount: number
    minMosSize: number
    defaultPitch: number
    minPitch: number
    maxPitch: number
    calcFrequency: (mill: number) => number
}

const mosSettingMap = new Map<string, MosSetting>([
    ["octave", {
        period: 12000,
        periodCount: 2,
        minMosSize: 6,
        defaultPitch: 7000,
        minPitch: 1800,
        maxPitch: 10200,
        calcFrequency: (mill: number) => (2 ** (mill / 12000)) * 174.6141157165,
    }],
    ["half-octave", {
        period: 6000,
        periodCount: 4,
        minMosSize: 3,
        defaultPitch: 1000,
        minPitch: 100,
        maxPitch: 500,
        calcFrequency: (mill: number) => (2 ** (mill / 12000)) * 174.6141157165,
    }],
    ["tritave", {
        period: 12000,
        periodCount: 2,
        minMosSize: 6,
        defaultPitch: 7000,
        minPitch: 1200,
        maxPitch: 10800,
        calcFrequency: (mill: number) => (3 ** (mill / 12000)) * 120,
    }],
])

class MosTester {
    private audioContext = new AudioContext()
    private period = 12000
    private periodCount = 2
    private minMosSize = 6
    private mainPitches: number[] = []
    private subPitches: number[] = []
    private subPitchPlaces: number[] = []
    private calcFrequency = (mill: number) => (2 ** (mill / 12000)) * 174.6141157165

    constructor(
        setting: MosSetting,
        inputGenerator: HTMLInputElement,
        inputReverse: HTMLInputElement,
        private svgGroupPitch: SVGGElement,
        private svgGroupKeyboard: SVGGElement,
    ) {
        this.period = setting.period
        this.periodCount = setting.periodCount
        this.minMosSize = setting.minMosSize
        this.calcFrequency = setting.calcFrequency

        const handleGeneratorChanged = () => {
            const newGenerator = parseInt(inputGenerator.value)
            if (Number.isFinite(newGenerator)) {
                this.calcMos(newGenerator)
                this.createSvg(newGenerator)
                this.createKeyboard()
            }
        }
        const setHash = () => {
            history.replaceState(null, "", `${location.pathname}#${inputGenerator.value}`)
        }
        const setGenerator = (value: number) => {
            inputGenerator.value = value.toString()
            handleGeneratorChanged()
            setHash()
        }

        window.addEventListener("hashchange", () => {
            const value = parseInt(location.hash.replace('#', ''))
            if (isFinite(value) && parseInt(inputGenerator.min) <= value && value <= parseInt(inputGenerator.max) && value.toString() != inputGenerator.value) {
                setGenerator(value)
            }
        })
        inputGenerator.addEventListener("input", handleGeneratorChanged)
        inputGenerator.addEventListener("change", setHash)

        const value = parseInt(location.hash.replace('#', ''))
        if (isFinite(value) && parseInt(inputGenerator.min) <= value && value <= parseInt(inputGenerator.max) && value.toString() != inputGenerator.value) {
            inputGenerator.value = value.toString()
        }

        for (const button of document.querySelectorAll<HTMLInputElement>("input[data-generator]")) {
            const genString = button.getAttribute("data-generator")
            if (!genString) {
                continue
            }
            const gen = parseInt(genString)
            if (isNaN(gen)) {
                continue
            }

            button.addEventListener("click", () => setGenerator(gen))
        }

        inputReverse.addEventListener("click", () => {
            const gen = parseInt(inputGenerator.value)
            if (Number.isFinite(gen)) {
                setGenerator(this.period - gen)
            }
        })

        handleGeneratorChanged()
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

    private createSvg(generator: number) {
        const svgWidth = this.period * this.periodCount + svgMargin * 2
        const svgOffset = -svgMargin
        const mainKeyCount = this.mainPitches.length * this.periodCount + 1
        const mainKeyInterval = svgWidth / mainKeyCount
        clearChildren(this.svgGroupPitch)

        // 黒鍵
        for (let cycle = 0; cycle < this.periodCount; cycle++) {
            const millOffset = this.period * cycle
            const keyOffset = this.mainPitches.length * cycle
            this.subPitches.forEach((s, i) => {
                const place = this.subPitchPlaces[i] ?? 0
                this.svgGroupPitch.appendChild(createPolyLine(
                    [
                        [s + millOffset, 0],
                        [s + millOffset, 1000],
                        [mainKeyInterval * (place + keyOffset + 0.5) + svgOffset, 1500],
                    ], "#287950", "100", "square"))
            })
        }

        // 白鍵
        for (let cycle = 0; cycle < this.periodCount; cycle++) {
            const millOffset = this.period * cycle
            const keyOffset = this.mainPitches.length * cycle
            this.mainPitches.forEach((l, i) => {
                const color = l === 0 ? "#AAAAAA" : l === generator ? "#DF4121" : "#FF9900"
                this.svgGroupPitch.appendChild(createPolyLine(
                    [
                        [l + millOffset, 0],
                        [l + millOffset, 1000],
                        [mainKeyInterval * (i + keyOffset + 0.5) + svgOffset, 1500],
                    ], color, "100", "square"))
            })
        }

        // 白鍵 (最高音)
        this.svgGroupPitch.appendChild(createPolyLine(
            [
                [this.period * this.periodCount, 0],
                [this.period * this.periodCount, 1000],
                [mainKeyInterval * (mainKeyCount - 0.5) + svgOffset, 1500],
            ], "#AAAAAA", "100", "square"))
    }

    createKeyboard() {
        const svgWidth = this.period * this.periodCount + svgMargin * 2
        const svgOffset = -svgMargin
        const mainKeyCount = this.mainPitches.length * this.periodCount + 1
        const mainKeyInterval = svgWidth / mainKeyCount
        clearChildren(this.svgGroupKeyboard)

        // 白鍵
        for (let cycle = 0; cycle < this.periodCount; cycle++) {
            this.mainPitches.forEach((l, i) => {
                const x = mainKeyInterval * (i + this.mainPitches.length * cycle) + svgOffset
                const freq = this.calcFrequency(l + this.period * cycle)
                this.addMainKey(x, mainKeyInterval, freq)
            })
        }

        // 白鍵 (最高音)
        const highestX = mainKeyInterval * (mainKeyCount - 1) + svgOffset
        const highestFreq = this.calcFrequency(this.period * this.periodCount)
        this.addMainKey(highestX, mainKeyInterval, highestFreq)

        // 黒鍵
        const subKeyWidth = mainKeyInterval * 0.75
        const subKeyOffset = (mainKeyInterval - subKeyWidth) / 2
        for (let cycle = 0; cycle < this.periodCount; cycle++) {
            this.subPitches.forEach((s, i) => {
                const x = mainKeyInterval * ((this.subPitchPlaces[i] ?? 0) + this.mainPitches.length * cycle) + svgOffset + subKeyOffset
                const freq = this.calcFrequency(s + this.period * cycle)
                this.addSubKey(x, subKeyWidth, freq)
            })
        }
    }

    private addMainKey(x: number, width: number, freq: number) {
        const rect = createRect(x, 1500, width, 4400, "#EEEEEE", "#000000", "20")
        rect.classList.add("key-main")
        rect.addEventListener("pointerdown", (ev) => { 
            ev.preventDefault()
            this.playTone(freq)
            rect.classList.remove("flash")
            void rect.getBoundingClientRect()
            rect.classList.add("flash")
        })
        this.svgGroupKeyboard.appendChild(rect)
    }

    private addSubKey(x: number, width: number, freq: number) {
        const rect = createRect(x, 1500, width, 2250, "#222222", "#000000", "20")
        rect.classList.add("key-sub")
        rect.addEventListener("pointerdown", (ev) => {
            ev.preventDefault()
            this.playTone(freq)
            rect.classList.remove("flash")
            void rect.getBoundingClientRect()
            rect.classList.add("flash")
        })
        this.svgGroupKeyboard.appendChild(rect)

    }

    private playTone(freq: number) {
        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()
        osc.type = "sawtooth"
        osc.frequency.value = freq
        const now = this.audioContext.currentTime

        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.25, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5)
        osc.connect(gain)
        gain.connect(this.audioContext.destination)
        osc.start(now)
        osc.stop(now + 2.5)
    }
}

window.addEventListener("load", () => {
    setCenter(0, 0)
    const inputGenerator = document.getElementById("input_generator") as HTMLInputElement
    const inputMosId = document.getElementById("input_mos_id") as HTMLInputElement
    const inputReverse = document.getElementById("input_reverse") as HTMLInputElement
    const svgGroupPitch = document.getElementById("g_pitches") as unknown as SVGGElement
    const svgGroupKeyboard = document.getElementById("g_keyboard") as unknown as SVGGElement
    const setting = mosSettingMap.get(inputMosId.value)
    if (setting) {
        new MosTester(setting, inputGenerator, inputReverse, svgGroupPitch, svgGroupKeyboard)
    }
})
