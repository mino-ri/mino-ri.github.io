"use strict";
let defaultLangCode = "";
let switchingElements = [];
let altSwitchingElements = [];
function switchLanguage(radioButton) {
    const langCode = radioButton.value;
    if (langCode === document.documentElement.lang) {
        return;
    }
    document.documentElement.lang = langCode;
    const lsKey = `data-ls-${langCode}`;
    const lsAltKey = `data-ls-alt-${langCode}`;
    const defaultLsKey = `data-ls-${defaultLangCode}`;
    const defaultLsAltKey = `data-ls-alt-${defaultLangCode}`;
    for (const element of switchingElements) {
        element.textContent = element.getAttribute(lsKey) ?? element.getAttribute(defaultLsKey);
    }
    for (const element of altSwitchingElements) {
        element.alt = element.getAttribute(lsAltKey) ?? element.getAttribute(defaultLsAltKey) ?? "";
    }
}
function loadLanguages() {
    switchingElements = [...document.querySelectorAll("[data-ls-en]")].filter((e) => e instanceof HTMLElement);
    altSwitchingElements = [...document.querySelectorAll("[data-ls-alt-en]")].filter((e) => e instanceof HTMLImageElement);
    defaultLangCode = document.documentElement.lang;
    const lsKey = `data-ls-${defaultLangCode}`;
    const lsAltKey = `data-ls-alt-${defaultLangCode}`;
    for (const element of switchingElements) {
        element.setAttribute(lsKey, element.textContent ?? "");
    }
    for (const element of altSwitchingElements) {
        element.setAttribute(lsAltKey, element.alt);
    }
    const languageSwitchers = [...document.querySelectorAll("input[name='language']")].filter((e) => e instanceof HTMLInputElement);
    for (const userLang of window.navigator.languages) {
        for (const switcher of languageSwitchers) {
            const langCode = switcher.value;
            if (userLang.startsWith(langCode)) {
                if (langCode !== defaultLangCode) {
                    switcher.checked = true;
                    switchLanguage(switcher);
                }
                return;
            }
        }
    }
}
window.addEventListener("load", loadLanguages);
