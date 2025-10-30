import { ColorScheme } from "./svg_generator";

export type ColorPalette = {
    back: string
    main: string
    sub: string
    fill: string
    pitchClass0: string
    pitchClass1: string
    pitchClass2: string
    pitchClass3: string
    pitchClass4: string
    pitchClass5: string
}

const colorPalettes: ColorPalette[] = [
    {
        back: "#FEFAEE",
        main: "#2B2F75",
        sub: "#FDC6FE",
        fill: "#FFFFFF",
        pitchClass0: "#30D8D4",
        pitchClass1: "#25938E",
        pitchClass2: "#E39D11",
        pitchClass3: "#F24E75",
        pitchClass4: "#9664F0",
        pitchClass5: "#39A2E9",
    },
    {
        back: "#F4F4F6",
        main: "#4C5156",
        sub: "#AAAAAA",
        fill: "#FFFFFF",
        pitchClass0: "#11EDE8",
        pitchClass1: "#339564",
        pitchClass2: "#C3B827",
        pitchClass3: "#DF4121",
        pitchClass4: "#C838C8",
        pitchClass5: "#217BDF",
    },
    {
        back: "#676681",
        main: "#FFFFFF",
        sub: "#AAAAAA",
        fill: "#676681",
        pitchClass0: "#8CF2F6",
        pitchClass1: "#96CC6A",
        pitchClass2: "#ECD551",
        pitchClass3: "#F08676",
        pitchClass4: "#EB71C6",
        pitchClass5: "#C779FF",
    },
    {
        back: "#01323D",
        main: "#6C7A78",
        sub: "#89A0A5",
        fill: "#FFFFFF",
        pitchClass0: "#43C1C1",
        pitchClass1: "#589547",
        pitchClass2: "#DD9B3B",
        pitchClass3: "#DD3B75",
        pitchClass4: "#B33AD8",
        pitchClass5: "#3B88DD",
    },
]

function addEventListnerById<T extends HTMLElement>(id: string, eventName: string, listner: (target: T) => void) {
    const target = document.getElementById(id) as T
    target.addEventListener(eventName, () => listner(target))
}

export class ColorControl {
    #previewBackground: HTMLElement
    colorScheme: ColorScheme
    action: (colorScheme: ColorScheme) => void

    constructor(previewBackground: HTMLElement, colorScheme: ColorScheme, action: (colorScheme: ColorScheme) => void) {
        this.#previewBackground = previewBackground
        this.colorScheme = colorScheme
        this.action = action

        addEventListnerById<HTMLSelectElement>("select_color_palette", "input", (select) => this.changeColorPalette(select))
        addEventListnerById<HTMLInputElement>("color_back", "input", (input) => { previewBackground.style.background = input.value })
        addEventListnerById<HTMLInputElement>("color_main", "input", (input) => { colorScheme.noteStroke = input.value; action(this.colorScheme) })
        addEventListnerById<HTMLInputElement>("color_sub", "input", (input) => { colorScheme.gridStroke = input.value; action(this.colorScheme) })
        addEventListnerById<HTMLInputElement>("color_fill", "input", (input) => { colorScheme.noteFill = input.value; action(this.colorScheme) })
        addEventListnerById<HTMLInputElement>("color0", "input", (input) => { colorScheme.setPitchClassColor(0, input.value); action(this.colorScheme) })
        addEventListnerById<HTMLInputElement>("color1", "input", (input) => { colorScheme.setPitchClassColor(1, input.value); action(this.colorScheme) })
        addEventListnerById<HTMLInputElement>("color2", "input", (input) => { colorScheme.setPitchClassColor(2, input.value); action(this.colorScheme) })
        addEventListnerById<HTMLInputElement>("color3", "input", (input) => { colorScheme.setPitchClassColor(3, input.value); action(this.colorScheme) })
        addEventListnerById<HTMLInputElement>("color4", "input", (input) => { colorScheme.setPitchClassColor(4, input.value); action(this.colorScheme) })
        addEventListnerById<HTMLInputElement>("color5", "input", (input) => { colorScheme.setPitchClassColor(5, input.value); action(this.colorScheme) })        
    }

    changeColorPalette(select: HTMLSelectElement) {
        const palette = colorPalettes[Number(select.value)]
        if (!palette) {
            return
        }
    
        document.getElementById("color_back")?.setAttribute("value", palette.back)
        document.getElementById("color_main")?.setAttribute("value", palette.main)
        document.getElementById("color_sub")?.setAttribute("value", palette.sub)
        document.getElementById("color_fill")?.setAttribute("value", palette.fill)
        document.getElementById("color0")?.setAttribute("value", palette.pitchClass0)
        document.getElementById("color1")?.setAttribute("value", palette.pitchClass1)
        document.getElementById("color2")?.setAttribute("value", palette.pitchClass2)
        document.getElementById("color3")?.setAttribute("value", palette.pitchClass3)
        document.getElementById("color4")?.setAttribute("value", palette.pitchClass4)
        document.getElementById("color5")?.setAttribute("value", palette.pitchClass5)
    
        this.colorScheme.noteStroke = palette.main
        this.colorScheme.gridStroke = palette.sub
        this.colorScheme.noteFill = palette.fill
        this.colorScheme.setPitchClassColor(0, palette.pitchClass0)
        this.colorScheme.setPitchClassColor(1, palette.pitchClass1)
        this.colorScheme.setPitchClassColor(2, palette.pitchClass2)
        this.colorScheme.setPitchClassColor(3, palette.pitchClass3)
        this.colorScheme.setPitchClassColor(4, palette.pitchClass4)
        this.colorScheme.setPitchClassColor(5, palette.pitchClass5)
    
        this.#previewBackground.style.background = palette.back
        this.action(this.colorScheme)
    }
}
