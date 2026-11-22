import {TRANSLATIONS} from "./translations.mjs";

let explicitLanguage = null;
export const language = () => String(explicitLanguage ?? globalThis.game?.i18n?.lang ?? "en").toLowerCase().startsWith("ru") ? "ru" : "en";
const qualify = (key) => key.startsWith("SOULFORGER.") ? key : `SOULFORGER.${key}`;
const format = (template, data) => template.replace(/\{(\w+)\}/g, (match, key) =>
  Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : match);

export function translate(locale, key, data = {}) {
  key = qualify(key);
  return format(TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en[key] ?? key, data);
}

/** Foundry 14 supports format variables directly in i18n.localize. */
export function t(key, data = {}) {
  const qualified = qualify(key);
  if (!explicitLanguage && typeof globalThis.game?.i18n?.localize === "function") {
    const localized = game.i18n.localize(qualified, data);
    if (typeof localized === "string" && localized !== qualified) return localized;
  }
  return translate(language(), key, data);
}

/** Synchronous only: never change Foundry's language or span an asynchronous update. */
export function withLanguage(locale, build) {
  const previous = explicitLanguage;
  explicitLanguage = locale;
  try {return build();} finally {explicitLanguage = previous;}
}
