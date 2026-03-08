import { XLengthType, interpolateMutedNote, parsePitches } from "./pitch.js";
import { ColorScheme } from "./svg_generator.js";
import { PitchSvgGenerator } from "./chord_graph_svg.js";
import { AudioSource } from "./sound.js";
import { ColorControl } from "./color_palette.js";
let textArea;
let checkboxAutoSize;
let checkboxAngleLog;
let checkboxLimitYLength;
let checkboxIgnoreOctave;
let checkboxQuantize;
let checkboxInterpolateMuted;
let textEdo;
let selectXLength;
let previewSvg;
let pitches = [];
let svgGenerator;
let playingAudio = null;
let colorControl;
function loadMonzo(ignoreSave) {
    const text = textArea.value;
    const xLengthType = selectXLength.value == "o" ? XLengthType.OctaveReduced
        : selectXLength.value == "s" ? XLengthType.Shasavic : XLengthType.Integer;
    pitches = parsePitches(text, checkboxIgnoreOctave.checked, xLengthType);
    if (checkboxInterpolateMuted.checked) {
        interpolateMutedNote(pitches);
    }
    svgGenerator.createSvg(pitches, {
        xLengthType,
        autoSize: checkboxAutoSize.checked,
        isAngleLog: checkboxAngleLog.checked,
        yLengthLimit: checkboxLimitYLength.checked,
        quantizeEdo: checkboxQuantize.checked ? Number(textEdo.value) : 0
    });
    if (!ignoreSave) {
        saveToHash();
    }
}
function createSvgUrl() {
    const svgText = new XMLSerializer().serializeToString(previewSvg);
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
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
    const soundPitches = pitches.filter((p) => !p.mute).map((p) => p.originalMonzo);
    const quantizeEdo = checkboxQuantize.checked ? Number(textEdo.value) : 0;
    playingAudio.src = AudioSource.createFromMonzos(soundPitches, 220, 2, quantizeEdo);
    playingAudio.play();
}
function encodeHash(obj) {
    return Object.keys(obj).map(key => `${key}=${obj[key]}`).join('&');
}
function decodeHash(hash) {
    const obj = {};
    hash.split('&').forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key && value) {
            obj[key] = value;
        }
    });
    return obj;
}
function saveToHash() {
    const hashData = {
        c: textArea.value.replace(/[^0-9x/\s]+/g, '').trim().replace(/\s+/g, '_'),
        i: (Number(checkboxIgnoreOctave.checked) |
            (Number(checkboxAngleLog.checked) << 1) |
            (Number(checkboxLimitYLength.checked) << 2) |
            (Number(checkboxInterpolateMuted.checked) << 3)).toString(),
        x: selectXLength.value,
        e: checkboxQuantize.checked ? textEdo.value : "0"
    };
    history.replaceState(null, "", `${location.pathname}#${encodeHash(hashData)}`);
}
function loadFromHash() {
    const { c: chord, i, x: xType, e: edo } = decodeHash(location.hash.replace('#', ''));
    if (chord && chord.length > 0) {
        textArea.value = chord.replace(/_/g, ' ');
    }
    if (i) {
        const flags = Number(i);
        checkboxIgnoreOctave.checked = flags % 2 >= 1;
        checkboxAngleLog.checked = flags % 4 >= 2;
        checkboxLimitYLength.checked = flags % 8 >= 4;
        checkboxInterpolateMuted.checked = flags % 16 >= 8;
    }
    if (xType) {
        selectXLength.value = xType;
    }
    if (edo && Number(edo) >= 2) {
        checkboxQuantize.checked = true;
        textEdo.value = Number(edo).toString();
    }
}
function addEventListnerById(id, eventName, listner) {
    const target = document.getElementById(id);
    target.addEventListener(eventName, () => listner(target));
}
window.addEventListener("load", () => {
    textArea = document.getElementById("textarea_editor");
    checkboxAutoSize = document.getElementById("checkbox_auto_size");
    checkboxAngleLog = document.getElementById("checkbox_angle_log");
    checkboxLimitYLength = document.getElementById("checkbox_limit_y_length");
    checkboxIgnoreOctave = document.getElementById("checkbox_ignore_octave");
    checkboxQuantize = document.getElementById("checkbox_quantize");
    checkboxInterpolateMuted = document.getElementById("checkbox_interpolate_muted");
    textEdo = document.getElementById("text_edo");
    selectXLength = document.getElementById("selecd_x_length");
    const editorPreview = document.getElementById("editor_preview");
    previewSvg = document.getElementById("preview_figure");
    const grid = previewSvg.getElementById("grid");
    const lineGroup = previewSvg.getElementById("line_group");
    const pitchClassGroup = previewSvg.getElementById("pitch_class_group");
    colorControl = new ColorControl(editorPreview, new ColorScheme(), () => loadMonzo());
    svgGenerator = new PitchSvgGenerator(previewSvg, grid, lineGroup, pitchClassGroup, colorControl.colorScheme);
    const uiElements = [
        textArea,
        checkboxAutoSize,
        checkboxAngleLog,
        checkboxLimitYLength,
        checkboxIgnoreOctave,
        checkboxQuantize,
        checkboxInterpolateMuted,
        textEdo,
        selectXLength,
    ];
    for (const element of uiElements) {
        element.addEventListener("input", () => loadMonzo());
    }
    addEventListnerById("a_download_svg", "click", downloadSvg);
    addEventListnerById("a_download_png", "click", downloadPng);
    addEventListnerById("button_play", "click", playSound);
    loadFromHash();
    loadMonzo(true);
});
