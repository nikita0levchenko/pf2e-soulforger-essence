import {test, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseHTML} from "linkedom";
import {TRANSLATIONS} from "../scripts/translations.mjs";
import {t, translate, language, withLanguage} from "../scripts/i18n.mjs";
import {MODULE, IDS, POWERS, DAMAGE_TYPES, itemTemplates, makeEffect, stasisEffect, essenceRules, corruptionRules} from "../scripts/core.mjs";
import {describePower, powerChoices, renderChoiceContent, bindChoiceDescriptions} from "../scripts/choice-ui.mjs";
import {moduleTextPatch, migrateActorTexts, provision} from "../scripts/main.mjs";

const readJSON = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const set = (object, path, value) => {
  const parts = path.split("."), key = parts.pop();
  const parent = parts.reduce((value, key) => value[key] ??= {}, object);
  parent[key] = structuredClone(value);
};
beforeEach(() => {
  globalThis.game = {i18n: {lang: "en", localize: (key) => key}};
  globalThis.foundry = {utils: {getProperty: get, setProperty: set}};
});

test("both catalogs contain all 150 keys, matching placeholders, and the built bundle", () => {
  const en = readJSON("../lang/en.json"), ru = readJSON("../lang/ru.json");
  assert.equal(Object.keys(en).length, 150);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ru).sort());
  assert.deepEqual(TRANSLATIONS, {en, ru});
  for (const key of Object.keys(en)) {
    assert.equal(typeof en[key], "string"); assert.equal(typeof ru[key], "string");
    assert(en[key].length && ru[key].length);
    const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(placeholders(en[key]), placeholders(ru[key]), key);
    assert(!/\p{Script=Cyrillic}/u.test(en[key]), key);
  }
});

test("the manifest registers English and Russian and all bundled imports are English", () => {
  const manifest = readJSON("../module.json");
  assert.deepEqual(manifest.languages.map((l) => l.lang), ["en", "ru"]);
  for (const item of ["essence-selection-effect", "corruption-selection-effect", "apply-corruption-flaw", "manifest-essence-form"]) {
    const source = readJSON(`../items/fvtt-Item-${item}.json`);
    assert.equal(source.flags[MODULE].language, "en");
    assert(!/\p{Script=Cyrillic}/u.test(source.name + source.system.description.value));
  }
});

test("English is the fallback without Foundry and for an unsupported language", () => {
  delete globalThis.game;
  assert.equal(language(), "en"); assert.equal(t("Button.Choose"), "Choose");
  globalThis.game = {i18n: {lang: "de", localize: (key) => key}};
  assert.equal(t("Action.Manifest"), "Manifest Essence Form");
  game.i18n.lang = "ru-RU";
  assert.equal(t("Button.Choose"), "Выбрать");
});

test("Foundry 14 receives namespaced keys and data without formatting user text twice", () => {
  const calls = [];
  game.i18n.localize = (key, data) => {
    calls.push({key, data});
    return key === "SOULFORGER.Effect.Item" ? `Item: ${data.name}` : key;
  };
  assert.equal(t("Effect.Item", {name: "Sword {name}"}), "Item: Sword {name}");
  assert.equal(calls[0].key, "SOULFORGER.Effect.Item");
  assert.equal(t("Button.Choose"), "Choose");
});

test("a synchronous language override restores the previous locale even on failure", () => {
  assert.equal(withLanguage("ru", () => t("Button.Choose")), "Выбрать");
  assert.equal(t("Button.Choose"), "Choose");
  assert.throws(() => withLanguage("ru", () => {throw Error("test");}), /test/);
  assert.equal(language(), "en");
});

for (const locale of ["en", "ru"]) test(`${locale}: all 26 descriptions, actions, effect names, and damage types are localized`, () => {
  game.i18n.lang = locale;
  for (const corruption of [false, true]) {
    const choices = powerChoices({corruption, level: 8});
    assert.equal(choices.length, 13);
    for (const power of POWERS) {
      const choice = choices.find((c) => c.value === power.id);
      const effect = makeEffect(power, {level: 8, targetId: "test", targetName: "Steel Shield", movement: "fly", damageType: "fire"}, {corruption});
      assert(!choice.description.content.includes("SOULFORGER."));
      assert(!choice.description.content.includes("floor(")); assert(!choice.description.content.includes("ceil("));
      assert.equal(effect.flags[MODULE].language, locale);
      if (locale === "en") {
        assert(!/\p{Script=Cyrillic}/u.test(JSON.stringify([choice, effect])));
        assert(choice.description.title.startsWith(corruption ? "Corruption Flaw:" : "Essence Form:"));
      } else assert(choice.description.title.includes(power.ru));
    }
  }
  assert.equal(itemTemplates().find((i) => i._id === IDS.feat).name, translate(locale, "Action.Manifest"));
  assert.equal(DAMAGE_TYPES.fire, translate(locale, "Damage.fire"));
  assert(describePower(POWERS.find((p) => p.id === "healing-grace"), {level: 8}).content.includes("4"));
});

test("dropdown buttons and accessibility labels follow the language after import", () => {
  for (const locale of ["en", "ru"]) {
    game.i18n.lang = locale;
    const choices = powerChoices({level: 8});
    const {document} = parseHTML(`<html><body><form>${renderChoiceContent("Choices", choices)}</form></body></html>`);
    const root = document.querySelector("form");
    const cleanup = bindChoiceDescriptions(root, choices, () => {});
    const info = root.querySelector("[data-soulforger-description]");
    assert.equal(info.title, translate(locale, "Preview.Open"));
    root.querySelector("[data-soulforger-dropdown]").click();
    document.querySelector('[data-soulforger-option="resolute-defiance"]').click();
    assert.equal(info.getAttribute("aria-label"), translate(locale, "Preview.OpenNamed", {name: choices.at(-1).label}));
    cleanup();
  }
});

test("localizing rules does not change a mechanical field in any of the 26 variants", () => {
  const mechanics = (rules) => rules.map(({text, label, ...rule}) => rule);
  for (const p of POWERS) for (const make of [essenceRules, corruptionRules]) {
    const build = () => make(p, {level: 8, targetId: "same-shield", damageType: "fire", movement: "fly", hasShieldBlock: false});
    assert.deepEqual(withLanguage("en", () => mechanics(build())), withLanguage("ru", () => mechanics(build())));
  }
});

function oldItem(source) {
  const item = structuredClone(source);
  item.id = item._id ?? "effect-id";
  item.flags[MODULE].version = "1.2.2";
  delete item.flags[MODULE].language;
  return item;
}

test("existing actions translate without writing frequency, IDs, rules, or grant links", () => {
  const item = oldItem(withLanguage("ru", () => itemTemplates().find((i) => i._id === IDS.feat)));
  item.system.frequency.value = 0;
  const patch = moduleTextPatch(item);
  assert.equal(patch.name, "Manifest Essence Form");
  assert.equal(patch["system.selfEffect.name"], "Choose an Essence Power");
  assert(patch["system.description.value"].includes("Free action"));
  assert(!Object.keys(patch).some((k) => /frequency|uuid|duration|hp|^_id$/.test(k)));
  assert.equal(patch["system.rules"], undefined);
  assert.equal(item.system.frequency.value, 0);
});

test("existing effects translate their generated text without changing numerical rules or expiry", () => {
  const config = {level: 8, targetId: "shield", targetName: "Steel Shield"};
  for (const p of POWERS) for (const corruption of [false, true]) {
    const item = oldItem(withLanguage("ru", () => makeEffect(p, config, {corruption, worldTime: 777})));
    const snapshot = structuredClone(item);
    const patch = moduleTextPatch(item);
    assert(!/\p{Script=Cyrillic}/u.test(patch.name + patch["system.description.value"]));
    assert(!Object.keys(patch).some((k) => /config|duration|start|expiresAt|frequency|hp/.test(k)));
    if (patch["system.rules"]) {
      const strip = (rules) => rules.map(({text, label, ...r}) => r);
      assert.deepEqual(strip(patch["system.rules"]), strip(item.system.rules));
    }
    assert.deepEqual(item, snapshot);
  }
});

test("custom names, descriptions, and rule-note text are preserved", () => {
  const item = oldItem(withLanguage("ru", () => makeEffect(POWERS.find((p) => p.id === "deep-seated-fear"), {level: 8})));
  item.name = "My renamed power"; item.system.description.value = "<p>My notes</p>";
  item.system.rules.find((r) => r.key === "Note").text = "Custom note";
  const patch = moduleTextPatch(item);
  assert.equal(patch.name, undefined); assert.equal(patch["system.description.value"], undefined);
  assert.equal(patch["system.rules"].find((r) => r.key === "Note").text, "Custom note");
  assert.equal(patch["system.rules"].find((r) => r.toggleable).label, "Target perceives the essence form");
});

test("migration can switch both ways, is idempotent, and ignores ordinary inventory", async () => {
  const item = oldItem(withLanguage("ru", () => itemTemplates().find((i) => i._id === IDS.feat)));
  item.system.frequency.value = 0;
  const inventory = {id: "shield", name: "Мой щит", type: "shield", system: {hp: {value: 17, max: 30}}, flags: {[MODULE]: {shieldHP: {value: 2, max: 10, source: "effect"}}}};
  const calls = [];
  const actor = {items: {contents: [item, inventory]}, async updateEmbeddedDocuments(type, updates, options) {
    calls.push({type, updates, options});
    for (const update of updates) for (const [path, value] of Object.entries(update)) if (path !== "_id") set(item, path, value);
  }};
  await migrateActorTexts(actor);
  assert.equal(item.name, "Manifest Essence Form"); assert.equal(item.system.frequency.value, 0);
  assert.equal(calls[0].updates.length, 1);
  await migrateActorTexts(actor); assert.equal(calls.length, 1);
  game.i18n.lang = "ru";
  await migrateActorTexts(actor);
  assert.equal(item.name, "Проявить форму эссенции"); assert.equal(item.system.frequency.value, 0);
  assert.equal(inventory.system.hp.value, 17); assert.equal(inventory.flags[MODULE].shieldHP.value, 2);
  assert.deepEqual(moduleTextPatch(inventory), {});
});

test("stasis and temporary spell names migrate while native spell descriptions are left alone", () => {
  const stasis = oldItem(withLanguage("ru", () => stasisEffect(true, 0, null)));
  assert.equal(moduleTextPatch(stasis).name, "Pull of Stasis: Immobilized");
  const power = POWERS.find((p) => p.id === "healing-grace");
  const effect = {flags: {[MODULE]: {power: power.id}}};
  const actor = {items: new Map([["origin", effect]])};
  const spell = {actor, name: translate("ru", `Spells.${power.id}`), system: {description: {value: "Native spell description"}},
    flags: {[MODULE]: {kind: "temporary-spell", effectId: "origin"}}};
  const patch = moduleTextPatch(spell);
  assert.equal(patch.name, "Heal"); assert.equal(patch["system.description.value"], undefined);
});

test("world actions and the module folder translate without resetting resources or grants", async () => {
  const main = oldItem(withLanguage("ru", () => itemTemplates().find((i) => i._id === IDS.feat)));
  main.system.frequency.value = 0;
  const assets = withLanguage("ru", itemTemplates).map(oldItem);
  const index = assets.findIndex((i) => i._id === IDS.feat); assets[index] = main;
  for (const item of assets) item.update = async (changes) => {
    for (const [path, value] of Object.entries(changes)) set(item, path, value);
  };
  const folder = {id: "folder", type: "Item", name: translate("ru", "Folder.Name"), getFlag: () => true,
    async update(changes) {Object.assign(this, changes);}};
  game.user = {id: "gm", isGM: true}; game.users = {activeGM: {id: "gm"}};
  game.folders = [folder]; game.items = new Map(assets.map((i) => [i._id, i]));
  globalThis.ui = {notifications: {info() {}}};
  await provision();
  assert.equal(folder.name, "Soulforger — Essence Form");
  assert.equal(main.name, "Manifest Essence Form");
  assert(main.system.description.value.includes("Free action"));
  assert.equal(main.system.frequency.value, 0);
  assert.equal(main.system.rules[0].uuid, `Item.${IDS.flaw}`);
  assert.equal(assets.find((i) => i._id === IDS.flaw).name, "Apply Corruption Flaw");
});

test("Deep-Seated Fear keeps its language-penalty suppression matched to PF2e after switching language", () => {
  const item = oldItem(withLanguage("ru", () => makeEffect(POWERS.find((p) => p.id === "deep-seated-fear"),
    {level: 8, unintelligibleSlug: "непонятная-речь"})));
  game.pf2e = {system: {sluggify: (label) => label.toLowerCase().replaceAll(" ", "-")}};
  game.i18n.localize = (key) => key === "PF2E.Actions.Demoralize.Unintelligible" ? "Unintelligible" : key;
  const patch = moduleTextPatch(item);
  assert.equal(patch[`flags.${MODULE}.config.unintelligibleSlug`], "unintelligible");
  const rule = patch["system.rules"].find((r) => r.key === "AdjustModifier");
  assert.equal(rule.slug, "unintelligible"); assert.equal(rule.suppress, true);
  assert.deepEqual(rule.predicate, ["soulforger:target-perceives-essence"]);
});
