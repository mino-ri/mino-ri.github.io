let defaultLangCode = ""
const switchingElements: SwitchingElement[] = []

type SwitchingElement = {
    element: HTMLElement,
    isContentTarget: boolean,
    isHtmlTarget: boolean,
    targetAttributes?: Set<string>,
}

function switchLanguage(radioButton: HTMLInputElement) {
    const langCode = radioButton.value
    if (langCode === document.documentElement.lang) {
        return
    }
    document.documentElement.lang = langCode

    const lsKey = `data-ls-${langCode}`
    const defaultLsKey = `data-ls-${defaultLangCode}`
    const lsHtmlKey = `data-ls-html-${langCode}`
    const defaultHtmlKey = `data-ls-html-${defaultLangCode}`

    for (const { element, isContentTarget, isHtmlTarget, targetAttributes } of switchingElements) {
        if (isHtmlTarget) {
            if (isContentTarget) {
                const innerHtml = element.getAttribute(lsHtmlKey) ?? element.getAttribute(defaultHtmlKey)
                if (innerHtml) {
                    element.innerHTML = innerHtml
                } else {
                    element.textContent = element.getAttribute(lsKey) ?? element.getAttribute(defaultLsKey)
                }
            } else {
                element.innerHTML = element.getAttribute(lsHtmlKey) ?? element.getAttribute(defaultHtmlKey) ?? ""
            }
        } else if (isContentTarget) {
            element.textContent = element.getAttribute(lsKey) ?? element.getAttribute(defaultLsKey)
        }

        if (targetAttributes) {
            for (const attr of targetAttributes) {
                const key = `data-ls-${attr}-${langCode}`
                const defaultKey = `data-ls-${attr}-${defaultLangCode}`
                element.setAttribute(attr, element.getAttribute(key) ?? element.getAttribute(defaultKey) ?? "")
            }
        }
    }
}

function registerElement(element: HTMLElement) {
    let entry: SwitchingElement | null = null

    for (const attr of element.attributes) {
        if (!attr.name.startsWith("data-ls-")) {
            continue
        }

        entry = entry ?? {
            element, 
            isContentTarget: false,
            isHtmlTarget: false
        }
        const hyphenIndex = attr.name.indexOf("-", 8)
        if (hyphenIndex === -1) {
            entry.isContentTarget = true
            element.setAttribute(`data-ls-${defaultLangCode}`, element.textContent ?? "")
        } else {
            const targetAttrName = attr.name.substring(8, hyphenIndex)
            if (targetAttrName == "html") {
                entry.isHtmlTarget = true
                element.setAttribute(`data-ls-html-${defaultLangCode}`, element.innerHTML ?? "")
            } else {
                if (!entry.targetAttributes) {
                    entry.targetAttributes = new Set<string>()
                }            
                entry.targetAttributes.add(targetAttrName)
    
                element.setAttribute(`data-ls-${targetAttrName}-${defaultLangCode}`, element.getAttribute(targetAttrName) ?? "")
            }
        }
    }

    if (entry) {
        switchingElements.push(entry)
    }
}

export function loadLanguages() {
    defaultLangCode = document.documentElement.lang

    for (const element of document.querySelectorAll("*")) {
        if (element instanceof HTMLElement) {
            registerElement(element)
        }
    }

    const languageSwitchers = [...document.querySelectorAll("input[name='language']")].filter((e) => e instanceof HTMLInputElement)
    for (const switcher of languageSwitchers) {
        switcher.addEventListener("click", function () { switchLanguage(this) })
    }

    // ユーザーの言語をブラウザから読み取り、デフォルトに設定する
    for (const userLang of window.navigator.languages) {
        for (const switcher of languageSwitchers) {
            const langCode = switcher.value
            if (userLang.startsWith(langCode)) {
                switcher.checked = true
                if (langCode !== defaultLangCode) {
                    switchLanguage(switcher)
                }
                return
            }
        }
    }
}
