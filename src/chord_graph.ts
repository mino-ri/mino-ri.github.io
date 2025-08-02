import { PitchInfo, XLengthType, parsePitches } from "./pitch.js"
import { ColorScheme, PitchSvgGenerator } from "./chord_graph_svg.js"
import { AudioSource } from "./sound.js"

let textArea: HTMLTextAreaElement
let checkboxAutoSize: HTMLInputElement
let checkboxAngleLog: HTMLInputElement
let checkboxLimitYLength: HTMLInputElement
let checkboxIgnoreOctave: HTMLInputElement
let radioXInteger: HTMLInputElement
let radioXOctaveReduced: HTMLInputElement
let radioXShasavic: HTMLInputElement
let previewSvg: SVGSVGElement
let pitches: PitchInfo[] = []
let colorScheme: ColorScheme
let svgGenerator: PitchSvgGenerator
let playingAudio: HTMLAudioElement | null = null

function loadMonzo(ignoreSave?: boolean) {
    const text = textArea.value
    const xLengthType =
        radioXOctaveReduced.checked ? XLengthType.OctaveReduced :
            radioXShasavic.checked ? XLengthType.Shasavic : XLengthType.Integer
    pitches = parsePitches(text, checkboxIgnoreOctave.checked, xLengthType)
    svgGenerator.createSvg(pitches, {
        xLengthType,
        autoSize: checkboxAutoSize.checked,
        isAngleLog: checkboxAngleLog.checked,
        yLengthLimit: checkboxLimitYLength.checked,
     })

    if (!ignoreSave) {
        saveToHash()
    }
}

function createSvgUrl(): string {
    const svgText = new XMLSerializer().serializeToString(previewSvg)
    const blob = new Blob([svgText], { type: "image/svg+xml" })
    return URL.createObjectURL(blob)
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

    playingAudio.src = AudioSource.createFromMonzos(pitches.filter((p) => !p.mute).map((p) => p.originalMonzo), 220, 2)
    playingAudio.play()
}

function encodeHash(obj: {[key: string]: string}) {
    return Object.keys(obj).map(key => `${key}=${obj[key]}`).join('&')
}

function decodeHash(hash: string) {
    const obj: {[key: string]: string} = {}
    hash.split('&').forEach((pair) => {
        const [key, value] = pair.split('=')
        if (key && value) {
            obj[key] = value
        }
    })
    return obj
}

function saveToHash() {
    const hashData = {
        c: textArea.value.replace(/[^0-9x/\s]+/g, '').trim().replace(/\s+/g, '_'),
        i: (Number(checkboxIgnoreOctave.checked) |
            (Number(checkboxAngleLog.checked) << 1) |
            (Number(checkboxLimitYLength.checked) << 2)).toString(),
        x: radioXInteger.checked ? 'i' : radioXOctaveReduced.checked ? 'o' : 's',
    }

    history.replaceState(null, "", `${location.pathname}#${encodeHash(hashData)}`)
}

function loadFromHash() {
    const { c: chord, i, x: xType } = decodeHash(location.hash.replace('#', ''))
    if (chord && chord.length > 0) {
        textArea.value = chord.replace(/_/g, ' ')
    }
    if (i) {
        const flags = Number(i)
        checkboxIgnoreOctave.checked = flags % 2 >= 1
        checkboxAngleLog.checked = flags % 4 >= 2
        checkboxLimitYLength.checked = flags % 8 >= 4
    }
    if (xType) {
        if (xType === 'i') {
            radioXInteger.checked = true
        } else if (xType === 'o') {
            radioXOctaveReduced.checked = true
        } else if (xType === 's') {
            radioXShasavic.checked = true
        }
    }
}

function addEventListnerById<T extends HTMLElement>(id: string, eventName: string, listner: (target: T) => void) {
    const target = document.getElementById(id) as T
    target.addEventListener(eventName, () => listner(target))
}

window.addEventListener("load", () => {
    textArea = document.getElementById("textarea_editor") as HTMLTextAreaElement
    checkboxAutoSize = document.getElementById("checkbox_auto_size") as HTMLInputElement
    checkboxAngleLog = document.getElementById("checkbox_angle_log") as HTMLInputElement
    checkboxLimitYLength = document.getElementById("limit_y_length") as HTMLInputElement
    checkboxIgnoreOctave = document.getElementById("checkbox_ignore_octave") as HTMLInputElement
    radioXInteger = document.getElementById("radio_x_integer") as HTMLInputElement
    radioXOctaveReduced = document.getElementById("radio_x_octave_reduced") as HTMLInputElement
    radioXShasavic = document.getElementById("radio_x_shasavic") as HTMLInputElement
    previewSvg = document.getElementById("preview_figure") as unknown as SVGSVGElement
    const grid = previewSvg.getElementById("grid") as SVGGElement
    const lineGroup = previewSvg.getElementById("line_group") as SVGGElement
    const pitchClassGroup = previewSvg.getElementById("pitch_class_group") as SVGGElement
    
    colorScheme = new ColorScheme()
    svgGenerator = new PitchSvgGenerator(previewSvg, grid, lineGroup, pitchClassGroup, colorScheme)

    const uiElements: HTMLElement[] = [
        textArea,
        checkboxAutoSize,
        checkboxAngleLog,
        checkboxLimitYLength,
        checkboxIgnoreOctave,
        radioXInteger,
        radioXOctaveReduced,
        radioXShasavic,
    ]
    for (const element of uiElements) {
        element.addEventListener("input", () => loadMonzo())
    }

    addEventListnerById("a_download_svg", "click", downloadSvg)
    addEventListnerById("a_download_png", "click", downloadPng)
    addEventListnerById("button_play", "click", playSound)
    addEventListnerById<HTMLInputElement>("color_main", "input", (input) => { colorScheme.noteStroke = input.value; loadMonzo() })
    addEventListnerById<HTMLInputElement>("color_sub", "input", (input) => { colorScheme.gridStroke = input.value; loadMonzo() })
    addEventListnerById<HTMLInputElement>("color_fill", "input", (input) => { colorScheme.noteFill = input.value; loadMonzo() })
    addEventListnerById<HTMLInputElement>("color0", "input", (input) => { colorScheme.setPitchClassColor(0, input.value); loadMonzo() })
    addEventListnerById<HTMLInputElement>("color1", "input", (input) => { colorScheme.setPitchClassColor(1, input.value); loadMonzo() })
    addEventListnerById<HTMLInputElement>("color2", "input", (input) => { colorScheme.setPitchClassColor(2, input.value); loadMonzo() })
    addEventListnerById<HTMLInputElement>("color3", "input", (input) => { colorScheme.setPitchClassColor(3, input.value); loadMonzo() })
    addEventListnerById<HTMLInputElement>("color4", "input", (input) => { colorScheme.setPitchClassColor(4, input.value); loadMonzo() })
    addEventListnerById<HTMLInputElement>("color5", "input", (input) => { colorScheme.setPitchClassColor(5, input.value); loadMonzo() })
    
    loadFromHash()
    loadMonzo(true)
})
