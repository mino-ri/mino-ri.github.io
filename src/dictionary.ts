import { loadLanguages } from "./language_switcher_core.js"

const sortOrder = "#,;'xzwrhsfgdbktpqnmvyieoua"

function compareBySatu(left: string, right: string): number {
    for (let i = 0; ; i++) {
        const l = left.charAt(i)
        const r = right.charAt(i)

        if (l === "") {
            return -1
        }
        if (r === "") {
            return 1
        }

        const lIndex = sortOrder.indexOf(l)
        const rIndex = sortOrder.indexOf(r)
        if (lIndex !== rIndex) {
            return rIndex - lIndex
        }
    }
}

function satuToSound(satu: string): string {
    return satu
        .replaceAll("q", "ŋ")
        .replaceAll("f", "ɸ")
        .replaceAll("sy", "ʃ")
        .replaceAll("ty", "tʃ")
        .replaceAll("dy", "dʒ")
        .replaceAll("si", "ʃi")
        .replaceAll("y", "j")
        .replaceAll("v", "əm")
        .replaceAll("r", "ɾ")
        .replaceAll("x", "ɣ")
        .replaceAll("h", "x")
}

type Translation = {
    ja: string
    en: string
}

const wordTypes: Map<string, Translation> = new Map([
    ["名称", { ja: "名称語", en: "Name" }],
    ["過程", { ja: "過程語", en: "Process" }],
    ["結果", { ja: "結果語", en: "Result" }],
    ["機能", { ja: "機能語", en: "Function" }],
    ["補助", { ja: "補助語", en: "Complementizer" }],
])

type PartOfSpeech = {
    noun: Translation
    verb: Translation
    mod: Translation
    conj: Translation
}

const partOfSpeeches: PartOfSpeech = {
    noun: { ja: "名", en: "Noun" },
    verb: { ja: "動", en: "Verb" },
    mod: { ja: "飾", en: "Mod" },
    conj: { ja: "接", en: "Conj" },
}

function buildWord({ wordType, paramCount, explain, noun, verb, modif, conj, language }: {
    wordType: string,
    paramCount: string,
    explain: string,
    noun: string,
    verb: string,
    modif: string,
    conj: string,
    language: keyof Translation
}): string {
    const wordTypeText = wordTypes.get(wordType)?.[language] ?? ""
    const wordTitle = paramCount === "0" ? `【${wordTypeText}】 ${explain}<br />` : `【${wordTypeText}-${paramCount}】 ${explain}<br />`
    let body = ""
    if (noun !== "") {
        body += `【${partOfSpeeches.noun[language]}】${noun}`
    }

    if (verb !== "") {
        if (body !== "") {
            body += " "
        }
        let verbTitle = partOfSpeeches.verb[language]
        if (modif === "●") {
            verbTitle += `|${partOfSpeeches.mod[language]}`
        }
        if (conj === "●") {
            verbTitle += `|${partOfSpeeches.conj[language]}`
        }
        body += `【${verbTitle}】${verb}`
    }

    if (modif !== "" && modif !== "●") {
        if (body !== "") {
            body += " "
        }
        const modifTitle = (verb === "" && conj === "●") ? `${partOfSpeeches.mod[language]}|${partOfSpeeches.conj[language]}` : partOfSpeeches.mod[language]
        body += `【${modifTitle}】${modif}`
    }

    if (conj !== "" && conj !== "●") {
        if (body !== "") {
            body += " "
        }
        body += `【${partOfSpeeches.conj[language]}】${conj}`
    }
    return wordTitle + body
}

const loadDictionary = async () => {
    const template = document.getElementById("template_word")
    if (!(template instanceof HTMLTemplateElement)) {
        return
    }
    const parent = template.parentElement
    if (!parent) {
        return
    }

    const url = "./dictionary.csv"
    const response = await fetch(url)
    const text = await response.text()
    const words = text.split("\n").map((s) => s.split("\t"))
    words.sort((a, b) => compareBySatu(a[0] ?? "", b[0] ?? ""))

    const pattern = /\{(([a-z]+?)[sfv]?)\}/g
    for (const word of words) {
        const satu = word[0] ?? ""
        const wordType = word[1] ?? ""
        const paramCount = word[2] ?? ""
        const title = word[3] ?? ""
        const explain = (word[4] ?? "").replaceAll(pattern, `<a href='#$2' class='satu'>$1</a>`)
        const noun = word[5] ?? ""
        const verb = word[6] ?? ""
        const modif = word[7] ?? ""
        const conj = word[8] ?? ""

        const titleEn = word[9] ?? ""
        const explainEn = (word[10] ?? "").replaceAll(pattern, `<a href='#$2' class='satu'>$1</a>`)
        const nounEn = word[11] ?? ""
        const verbEn = word[12] ?? ""
        const modifEn = word[13] ?? ""
        const conjEn = word[14] ?? ""

        const root = template.content.cloneNode(true) as ParentNode
        const summary = root.querySelector("summary")
        if (summary) {
            summary.querySelector("a")?.setAttribute("id", satu)
            summary.querySelector(".satu")!.textContent = satu
            summary.querySelector(".dict-sound")!.textContent = `/${satuToSound(satu)}/`
            const mean = summary.querySelector(".dict-mean")
            if (mean) {
                mean.textContent = title
                mean.setAttribute("data-ls-en", titleEn)
            }
        }
        const p = root.querySelector("p")
        if (p) {
            p.innerHTML = buildWord({ wordType, paramCount, explain, noun, verb, modif, conj, language: "ja" })
            p.setAttribute("data-ls-html-en", buildWord({ wordType, paramCount, explain: explainEn, noun: nounEn, verb: verbEn, modif: modifEn, conj: conjEn, language: "en" }))
        }

        parent.appendChild(root)
    }

    loadLanguages()
}

window.addEventListener("DOMContentLoaded", loadDictionary)
window.addEventListener("hashchange", (ev) => {
    console.log("HashChanged")
    const hash = location.hash.replace("#", "")
    const detail = document.querySelector(`details:has(a#${hash})`)
    if (detail) {
        detail.setAttribute("open", "open")
    }

    const target = document.getElementById(hash)
    if (target) {
        target.scrollIntoView({
            block: "start",
            behavior: "smooth",
        })
    }

    ev.preventDefault()
})
