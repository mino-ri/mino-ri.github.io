import { ColorScheme, setCenter, clearChildren, createLine, createText, createPolyLine } from "./svg_generator.js"
import { ColorControl } from "./color_palette.js"
import { Monzo } from "./monzo.js"
import { parsePitches, XLengthType } from "./pitch.js"

const height = 1800
const width = 1200

type MonzoKey = "p3" | "p5" | "p7" | "p11" | "p13" | "others"

type MonzoMap = Record<MonzoKey, Monzo[]>

class Renderer {
    #textArea: HTMLTextAreaElement
    #numberEdo: HTMLInputElement
    #checkIgnoreOctave: HTMLInputElement
    #rangeFontSize: HTMLInputElement
    #colorScheme: ColorScheme
    #groupGrid: SVGGElement
    #group3: SVGGElement
    #group5: SVGGElement
    #group7: SVGGElement
    #group11: SVGGElement
    #group13: SVGGElement
    #groupOthers: SVGGElement
    #groupText: SVGGElement
    #monzos: MonzoMap = { p3: [], p5: [], p7: [], p11: [], p13: [], others: [] }
    #monzoEntries = Object.entries(this.#monzos) as [MonzoKey, Monzo[]][]
    static #maxTargetPrime = 13

    constructor() {
        const textArea = document.getElementById("textarea_editor") as HTMLTextAreaElement
        const numberEdo = document.getElementById("number_edo") as HTMLInputElement
        const checkIgnoreOctave = document.getElementById("check_ignore_octave") as HTMLInputElement
        const rangeFontSize = document.getElementById("range_font_size") as HTMLInputElement
        const editorPreview = document.getElementById("editor_preview") as HTMLElement
        const previewSvg = document.getElementById("preview_figure") as unknown as SVGSVGElement
        this.#textArea = textArea
        this.#numberEdo = numberEdo
        this.#checkIgnoreOctave = checkIgnoreOctave
        this.#rangeFontSize = rangeFontSize
        this.#colorScheme = new ColorScheme()
        this.#groupGrid = previewSvg.getElementById("group_grid") as SVGGElement
        this.#group3 = previewSvg.getElementById("group_3") as SVGGElement
        this.#group5 = previewSvg.getElementById("group_5") as SVGGElement
        this.#group7 = previewSvg.getElementById("group_7") as SVGGElement
        this.#group11 = previewSvg.getElementById("group_11") as SVGGElement
        this.#group13 = previewSvg.getElementById("group_13") as SVGGElement
        this.#groupOthers = previewSvg.getElementById("group_others") as SVGGElement
        this.#groupText = previewSvg.getElementById("group_text") as SVGGElement

        new ColorControl(editorPreview, this.#colorScheme, () => this.render())

        textArea.addEventListener("input", () => { this.setMonzos(); this.render() })
        numberEdo.addEventListener("input", () => this.render())
        checkIgnoreOctave.addEventListener("input", () => this.render())
        rangeFontSize.addEventListener("input", () => this.render())
    }

    setMonzos() {
        const intervals = this.#textArea.value
        const allPitches = parsePitches(intervals, true, XLengthType.Integer)
        this.#monzoEntries.forEach(([_, monzos]) => {
            monzos.length = 0
        })

        for (const { monzo } of allPitches) {
            const monzoKey = Renderer.#getMonzoKey(monzo)
            this.#monzos[monzoKey].push(monzo)
        }
    }

    static #getMonzoKey(monzo: Monzo): MonzoKey {
        const primeLimit = monzo.maxPrime
        if (primeLimit > Renderer.#maxTargetPrime) {
            return "others"
        }
        if (primeLimit <= 3) {
            return "p3"
        }

        const minPrime = monzo.minPrime
        if (monzo.factors.size <= 2 && (minPrime === 3 || minPrime === primeLimit)) {
            switch (primeLimit) {
                case 5: return "p5"
                case 7: return "p7"
                case 11: return "p11"
                case 13: return "p13"
            }
        }

        return "others"
    }

    static #getMonzoKeyX(key: MonzoKey): number {
        switch (key) {
            case "p3": return width * 7.5 / 7.5
            case "p5": return width * 6.5 / 7.5
            case "p7": return width * 5.5 / 7.5
            case "p11": return width * 4.5 / 7.5
            case "p13": return width * 3.5 / 7.5
            default: return width * 2.5 / 7.5
        }
    }

    #getMonzoColor(monzoKey: MonzoKey): string {
        switch (monzoKey) {
            case "p3": return this.#colorScheme.getPitchClassColor(0.5)
            case "p5": return this.#colorScheme.getPitchClassColor(0.25)
            case "p7": return this.#colorScheme.getPitchClassColor(0.75)
            case "p11": return this.#colorScheme.getPitchClassColor(0.375)
            case "p13": return this.#colorScheme.getPitchClassColor(0.625)
            default: return this.#colorScheme.noteStroke
        }
    }

    #getGroupByMonzoKey(monzoKey: MonzoKey): SVGGElement {
        switch (monzoKey) {
            case "p3": return this.#group3
            case "p5": return this.#group5
            case "p7": return this.#group7
            case "p11": return this.#group11
            case "p13": return this.#group13
            default: return this.#groupOthers
        }
    }

    render() {
        const edo = Number(this.#numberEdo.value ?? "1")
        const ignoreOctave = this.#checkIgnoreOctave.checked
        const fontSize = Number(this.#rangeFontSize.value ?? "10")

        clearChildren(this.#groupGrid)
        clearChildren(this.#group3)
        clearChildren(this.#group5)
        clearChildren(this.#group7)
        clearChildren(this.#group11)
        clearChildren(this.#group13)
        clearChildren(this.#groupOthers)
        clearChildren(this.#groupText)

        this.#renderGrid(edo)
        this.#renderMonzos(edo, ignoreOctave, fontSize)
    }

    #renderGrid(edo: number) {
        const lineHeight = height / edo
        const textSize = Math.min(32, Math.max(lineHeight - 8, 8)).toString()
        for (let i = 0; i <= edo; i++) {
            const y = (edo - i) / edo * height
            const line = createLine(0, y, width, y, this.#colorScheme.gridStroke, "2")
            line.setAttribute("stroke-opacity", "0.5")
            this.#groupGrid.appendChild(line)
            this.#groupGrid.appendChild(createText(4, y - 4, i.toString(), textSize, this.#colorScheme.noteStroke))
        }
    }

    #renderMonzos(edo: number, ignoreOctave: boolean, fontSize: number) {
        const space = fontSize + 2
        const fontSizeText = fontSize.toString()
        for (const [monzoKey, monzos] of this.#monzoEntries) {
            const color = this.#getMonzoColor(monzoKey)
            const group = this.#getGroupByMonzoKey(monzoKey)
            const x = Renderer.#getMonzoKeyX(monzoKey)

            const pitchClasses = monzos.map(monzo => {
                const pitchClassMonzo = monzo.toPitchClassMonzo()
                const y = (1 - pitchClassMonzo.pitch) * height
                return {
                    text: (ignoreOctave ? monzo : pitchClassMonzo).toFractionString(),
                    y,
                    yText: y,
                    yQuantized: (1 - pitchClassMonzo.quantizedPitch(edo)) * height,
                }
            })
            // ピッチが低い順
            pitchClasses.sort((a, b) => b.yText - a.yText)

            // テキストのY座標を調整（重なりを避ける）
            for (let i = 0; i < pitchClasses.length - 1; i++) {
                const prev = pitchClasses[i - 1]
                const current = pitchClasses[i]!
                const next = pitchClasses[i + 1]!
                if (current.yText < next.yText + space) {
                    const prevY = prev?.yText ?? height + space
                    current.yText = Math.min(prevY, (current.yText + next.yText + space) / 2)
                    next.yText = current.yText - space
                }
            }

            // 描画
            for (let i = 0; i < pitchClasses.length; i++) {
                const { text, y, yText, yQuantized } = pitchClasses[i]!
                const polyline = createPolyLine([
                    [width * 0.5 / 7.5, yQuantized],
                    [width * 1.5 / 7.5, y],
                    [x, y],
                ], color, "8", "round")
                group.appendChild(polyline)

                const textEdgeElement = createText(x, yText, text, fontSizeText, this.#colorScheme.back, this.#colorScheme.back, "8", "end", "middle")
                textEdgeElement.setAttribute("font-weight", "bold")
                this.#groupText.appendChild(textEdgeElement)

                const textElement = createText(x, yText, text, fontSizeText, color, "", "", "end", "middle")
                textElement.setAttribute("font-weight", "bold")
                this.#groupText.appendChild(textElement)
            }
        }
    }
}

window.addEventListener("load", () => {
    setCenter(40, 60)
    const renderer = new Renderer()
    renderer.setMonzos()
    renderer.render()
})
