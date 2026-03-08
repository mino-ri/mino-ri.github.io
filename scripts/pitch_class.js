import { ColorScheme } from "./svg_generator.js";
import { parsePitches, XLengthType } from "./pitch.js";
import { PitchClassSvgGenerator } from "./pitch_class_svg.js";
import { ColorControl } from "./color_palette.js";
import { AudioSource } from "./sound.js";
import { Monzo } from "./monzo.js";
let textArea;
let checkboxQuantize;
let checkboxShowStep;
let textEdo;
let checkboxLimitInterval;
let textPrime;
let previewSvg;
let pitchClassSvgGenerator;
let colorControl;
let pitches = [];
let playingAudio = null;
function addEventListnerById(id, eventName, listner) {
    const target = document.getElementById(id);
    target.addEventListener(eventName, () => listner(target));
}
function createSvgUrl() {
    const svgText = new XMLSerializer().serializeToString(previewSvg);
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
}
function playSound() {
    if (!playingAudio) {
        playingAudio = document.createElement("audio");
    }
    else {
        playingAudio.pause();
        playingAudio.currentTime = 0;
    }
    if (pitches.length === 0) {
        return;
    }
    const quantizeEdo = checkboxQuantize.checked ? Number(textEdo.value) : 0;
    const soundPitches = pitches.filter((p) => !p.mute).map((p) => ({
        monzo: p.originalMonzo.toPitchClassMonzo(),
        pitchClass: p.originalMonzo.quantizedPitchClass(quantizeEdo),
    }));
    soundPitches.sort((a, b) => a.pitchClass - b.pitchClass);
    const uniqueSoundPitches = soundPitches.filter((p, index, arr) => index === 0 || p.pitchClass !== arr[index - 1].pitchClass);
    if (uniqueSoundPitches.length === 0) {
        return;
    }
    uniqueSoundPitches.push({
        monzo: Monzo.from2Factor(1),
        pitchClass: 0,
    });
    playingAudio.src = AudioSource.createFromMonzoSerial(uniqueSoundPitches.map(p => p.monzo), 220, 0.5, quantizeEdo);
    playingAudio.play();
}
function downloadSvg(aDownloadSvg) {
    aDownloadSvg.href = createSvgUrl();
}
function downloadPng() {
    const svgImage = document.createElement("img");
    svgImage.src = createSvgUrl();
    const svgCanvas = document.createElement("canvas");
    svgCanvas.width = previewSvg.viewBox.baseVal.width;
    svgCanvas.height = previewSvg.viewBox.baseVal.height;
    const ctx = svgCanvas.getContext("2d");
    svgImage.onload = () => {
        ctx?.drawImage(svgImage, 0, 0);
        const a = document.createElement("a");
        a.href = svgCanvas.toDataURL("image/png");
        a.setAttribute("download", "chordGraph.png");
        a.dispatchEvent(new MouseEvent("click"));
    };
}
function loadMonzo() {
    pitches = parsePitches(textArea.value, true, XLengthType.Integer);
    pitchClassSvgGenerator.generate(pitches, {
        quantizeEdo: checkboxQuantize.checked ? Number(textEdo.value) : 0,
        showSteps: checkboxShowStep.checked,
        autoCompleteLimitInterval: checkboxLimitInterval.checked ? Number(textPrime.value) : 0,
    });
}
window.addEventListener("load", () => {
    textArea = document.getElementById("textarea_editor");
    checkboxQuantize = document.getElementById("checkbox_quantize");
    checkboxShowStep = document.getElementById("checkbox_show_step");
    checkboxLimitInterval = document.getElementById("checkbox_limit_interval");
    textEdo = document.getElementById("text_edo");
    textPrime = document.getElementById("text_prime");
    previewSvg = document.getElementById("preview_figure");
    const editorPreview = document.getElementById("editor_preview");
    const lineGroup = previewSvg.getElementById("line_group");
    const gridGroup = previewSvg.getElementById("grid");
    const pitchClassGroup = previewSvg.getElementById("pitch_class_group");
    colorControl = new ColorControl(editorPreview, new ColorScheme(), () => loadMonzo());
    pitchClassSvgGenerator = new PitchClassSvgGenerator(previewSvg, gridGroup, lineGroup, pitchClassGroup, colorControl.colorScheme);
    textArea.addEventListener("input", () => loadMonzo());
    addEventListnerById("a_download_svg", "click", downloadSvg);
    addEventListnerById("a_download_png", "click", downloadPng);
    addEventListnerById("button_play", "click", playSound);
    const uiElements = [
        textArea,
        checkboxQuantize,
        checkboxShowStep,
        checkboxLimitInterval,
        textEdo,
        textPrime,
    ];
    for (const element of uiElements) {
        element.addEventListener("input", () => loadMonzo());
    }
    loadMonzo();
});
