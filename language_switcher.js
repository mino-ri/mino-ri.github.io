let defaultLangCode = ""
let switchingElements = []
let altSwitchingElements = []

function switchLanguage(radioButton) {
    if (!(radioButton instanceof HTMLInputElement)) {
        return
    }
    const langCode = radioButton.value
    if (langCode === document.documentElement.lang) {
        return
    }
    document.documentElement.lang = langCode

    const lsKey = `data-ls-${langCode}`
    const lsAltKey = `data-ls-alt-${langCode}`
    const defaultLsKey = `data-ls-${defaultLangCode}`
    const defaultLsAltKey = `data-ls-alt-${defaultLangCode}`

    for (const element of switchingElements) {
        if (element instanceof HTMLElement) {
            element.textContent = element.getAttribute(lsKey) ?? element.getAttribute(defaultLsKey)
        }
    }

    for (const element of altSwitchingElements) {
        if (element instanceof HTMLImageElement) {
            element.alt = element.getAttribute(lsAltKey) ?? element.getAttribute(defaultLsAltKey)
        }
    }
}

function loadLanguages() {
    switchingElements = document.querySelectorAll("[data-ls-en]")
    altSwitchingElements = document.querySelectorAll("[data-ls-alt-en]")
    defaultLangCode = document.documentElement.lang
    const lsKey = `data-ls-${defaultLangCode}`
    const lsAltKey = `data-ls-alt-${defaultLangCode}`

    for (const element of switchingElements) {
        if (element instanceof HTMLElement) {
            element.setAttribute(lsKey, element.textContent)
        }
    }

    for (const element of altSwitchingElements) {
        if (element instanceof HTMLImageElement) {
            element.setAttribute(lsAltKey, element.alt)
        }
    }

    const languageSwitchers = [...document.querySelectorAll("input[name='language']")]
    // ユーザーの言語をブラウザから読み取り、デフォルトに設定する
    for (const userLang of window.navigator.languages) {
        for (const switcher of languageSwitchers) {
            const langCode = switcher.value
            if (userLang.startsWith(langCode)) {
                if (langCode !== defaultLangCode) {
                    switcher.checked = true
                    switchLanguage(switcher)
                }
                return
            }
        }
    }
}


window.addEventListener("load", loadLanguages)
