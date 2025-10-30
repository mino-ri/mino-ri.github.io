import { ColorScheme } from "./svg_generator.js"
import { parsePitches, XLengthType } from "./pitch.js"
import { PitchClassSvgGenerator } from "./pitch_class_svg.js"
import { ColorControl } from "./color_palette.js"
import { PitchInfo } from "./pitch.js"
import { AudioSource } from "./sound.js"
import { Monzo } from "./monzo.js"

let textArea: HTMLTextAreaElement
let checkboxQuantize: HTMLInputElement
let checkboxShowStep: HTMLInputElement
let textEdo: HTMLInputElement
let checkboxLimitInterval: HTMLInputElement
let textPrime: HTMLInputElement
let previewSvg: SVGSVGElement
let pitchClassSvgGenerator: PitchClassSvgGenerator
let colorControl: ColorControl
let pitches: PitchInfo[] = []
let playingAudio: HTMLAudioElement | null = null

function addEventListnerById<T extends HTMLElement>(id: string, eventName: string, listner: (target: T) => void) {
    const target = document.getElementById(id) as T
    target.addEventListener(eventName, () => listner(target))
}

function createSvgUrl(): string {
    const svgText = new XMLSerializer().serializeToString(previewSvg)
    const blob = new Blob([svgText], { type: "image/svg+xml" })
    return URL.createObjectURL(blob)
}

function playSound() {
    if (!playingAudio) {
        playingAudio = document.createElement("audio")
    } else {
        playingAudio.pause()
        playingAudio.currentTime = 0
    }

    if (pitches.length === 0) {
        return
    }

    const quantizeEdo = checkboxQuantize.checked ? Number(textEdo.value) : 0
    const soundPitches = pitches.filter((p) => !p.mute).map((p) => ({
        monzo: p.originalMonzo.toPitchClassMonzo(),
        pitchClass: p.originalMonzo.quantizedPitchClass(quantizeEdo),
    }))

    // pitchClass の昇順で並べ替え
    soundPitches.sort((a, b) => a.pitchClass - b.pitchClass)
    // pitchClass が重複する要素を排除
    const uniqueSoundPitches = soundPitches.filter((p, index, arr) =>
        index === 0 || p.pitchClass !== arr[index - 1]!.pitchClass
    )
    if (uniqueSoundPitches.length === 0) {
        return
    }

    uniqueSoundPitches.push({
        monzo: Monzo.from2Factor(1),
        pitchClass: 0,
    })

    playingAudio.src = AudioSource.createFromMonzoSerial(
        uniqueSoundPitches.map(p => p.monzo),
        220, 0.5, quantizeEdo)
    playingAudio.play()
}

function downloadSvg(aDownloadSvg: HTMLAnchorElement) {
    aDownloadSvg.href = createSvgUrl()
}

function downloadPng() {
    const svgImage = document.createElement("img")
    svgImage.src = createSvgUrl()
    const svgCanvas = document.createElement("canvas")
    svgCanvas.width = previewSvg.viewBox.baseVal.width
    svgCanvas.height = previewSvg.viewBox.baseVal.height
    const ctx = svgCanvas.getContext("2d")
    svgImage.onload = () => {
        ctx?.drawImage(svgImage, 0, 0)
        const a = document.createElement("a")
        a.href = svgCanvas.toDataURL("image/png")
        a.setAttribute("download", "chordGraph.png")
        a.dispatchEvent(new MouseEvent("click"))
    }
}

function loadMonzo() {
    pitches = parsePitches(textArea.value, true, XLengthType.Integer)
    pitchClassSvgGenerator.generate(pitches, {
        quantizeEdo: checkboxQuantize.checked ? Number(textEdo.value) : 0,
        showSteps: checkboxShowStep.checked,
        autoCompleteLimitInterval: checkboxLimitInterval.checked ? Number(textPrime.value) : 0,
    })
}

window.addEventListener("load", () => {
    textArea = document.getElementById("textarea_editor") as HTMLTextAreaElement
    checkboxQuantize = document.getElementById("checkbox_quantize") as HTMLInputElement
    checkboxShowStep = document.getElementById("checkbox_show_step") as HTMLInputElement
    checkboxLimitInterval = document.getElementById("checkbox_limit_interval") as HTMLInputElement
    textEdo = document.getElementById("text_edo") as HTMLInputElement
    textPrime = document.getElementById("text_prime") as HTMLInputElement
    previewSvg = document.getElementById("preview_figure") as unknown as SVGSVGElement
    const editorPreview = document.getElementById("editor_preview") as HTMLElement
    const lineGroup = previewSvg.getElementById("line_group") as SVGGElement
    const gridGroup = previewSvg.getElementById("grid") as SVGGElement
    const pitchClassGroup = previewSvg.getElementById("pitch_class_group") as SVGGElement

    colorControl = new ColorControl(editorPreview, new ColorScheme(), () => loadMonzo())
    pitchClassSvgGenerator = new PitchClassSvgGenerator(previewSvg, gridGroup, lineGroup, pitchClassGroup, colorControl.colorScheme)

    textArea.addEventListener("input", () => loadMonzo())

    addEventListnerById("a_download_svg", "click", downloadSvg)
    addEventListnerById("a_download_png", "click", downloadPng)
    addEventListnerById("button_play", "click", playSound)

    const uiElements: HTMLElement[] = [
        textArea,
        checkboxQuantize,
        checkboxShowStep,
        checkboxLimitInterval,
        textEdo,
        textPrime,
    ]
    for (const element of uiElements) {
        element.addEventListener("input", () => loadMonzo())
    }

    loadMonzo()
})
