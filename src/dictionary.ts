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
    const words = text.split("\n").map((s) => s.split(","))
    words.sort((a, b) => compareBySatu(a[0] ?? "", b[0] ?? ""))

    const pattern = /\{(.+?)\}/g
    for (const word of words) {
        const satu = word[0] ?? ""
        const wordType = word[1] ?? ""
        const paramCount = word[2] ?? ""
        const title = word[3] ?? ""
        const explain = (word[4] ?? "").replaceAll(pattern, `<a href='#$1' class='satu'>$1</a>`)
        const noun = word[5] ?? ""
        const verb = word[6] ?? ""
        const modif = word[7] ?? ""
        const conj = word[8] ?? ""

        const root = template.content.cloneNode(true) as ParentNode
        const summary = root.querySelector("summary")
        if (summary) {
            summary.querySelector("a")?.setAttribute("id", satu)
            summary.querySelector(".satu")!.textContent = satu
            summary.querySelector(".dict-sound")!.textContent = `/${satuToSound(satu)}/`
            summary.querySelector(".dict-mean")!.textContent = title
        }
        const p = root.querySelector("p")
        if (p) {
            let title = paramCount === "0" ? `【${wordType}語】 ${explain}<br />` : `【${wordType}語-${paramCount}】 ${explain}<br />`
            let body = ""
            if (noun !== "") {
                body += `【名】${noun}`
            }

            if (verb !== "") {
                if (body !== "") {
                    body += " "
                }
                let verbTitle = "動"
                if (modif === "●") {
                    verbTitle += "|飾"
                }
                if (conj === "●") {
                    verbTitle += "|接"
                }
                body += `【${verbTitle}】${verb}`
            }

            if (modif !== "" && modif !== "●") {
                if (body !== "") {
                    body += " "
                }
                const modifTitle = (verb === "" && conj === "●") ? "飾|接" : "飾"
                body += `【${modifTitle}】${modif}`
            }

            if (conj !== "" && conj !== "●") {
                if (body !== "") {
                    body += " "
                }
                body += `【接】${conj}`
            }

            p.innerHTML = title + body
        }

        parent.appendChild(root)
    }
}

window.addEventListener("load", loadDictionary)
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
