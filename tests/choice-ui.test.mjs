import {test, beforeEach} from "node:test";
beforeEach(() => {globalThis.game = {i18n: {lang: "ru", localize: (key) => key}};});
import assert from "node:assert/strict";
import {parseHTML} from "linkedom";
import {POWERS, MODULE, VERSION, makeEffect} from "../scripts/core.mjs";
import {POWER_ICONS, powerIcon} from "../scripts/icons.mjs";
import {powerChoices, renderChoiceContent, bindChoiceDescriptions, describePower} from "../scripts/choice-ui.mjs";
import {moduleItemIcon, migrateActorIcons} from "../scripts/main.mjs";

function setup(choices = powerChoices({level: 8}), preview = () => {}) {
  const {document, window} = parseHTML(`<html><body><form>${renderChoiceContent("Выбор", choices)}</form><div id="outside"></div></body></html>`);
  const root = document.querySelector("form");
  const trigger = root.querySelector("[data-soulforger-dropdown]");
  const list = root.querySelector(".soulforger-essence-options");
  const field = root.querySelector('[name="choice"]');
  const cleanup = bindChoiceDescriptions(root, choices, preview);
  return {document, window, root, trigger, list, field, cleanup};
}
function key(window, element, name) {
  const event = new window.Event("keydown", {bubbles: true, cancelable: true});
  event.key = name; element.dispatchEvent(event); return event;
}

for (const corruption of [false, true]) test(`${corruption ? "corruption" : "essence"}: a collapsed image dropdown with one info button on the right`, () => {
  const choices = powerChoices({corruption, level: 8});
  const ui = setup(choices);
  assert.equal(ui.root.querySelectorAll('[role="combobox"]').length, 1);
  assert.equal(ui.root.querySelectorAll('[role="option"]').length, 13);
  assert.equal(ui.root.querySelectorAll('[type="radio"]').length, 0);
  assert.equal(ui.root.querySelectorAll('[data-soulforger-description]').length, 1);
  assert.equal(ui.trigger.getAttribute("aria-expanded"), "false");
  assert.equal(ui.list.hidden, true);
  assert(ui.root.querySelector('[data-soulforger-description]').previousElementSibling.classList.contains("soulforger-essence-select"));
  for (const power of POWERS) {
    const choice = choices.find((c) => c.value === power.id);
    assert.equal(choice.img, powerIcon(power.id, corruption));
    assert(choice.description.title.startsWith(corruption ? "Изъян порока:" : "Форма эссенции:"));
    assert(choice.description.title.includes(power.en));
    assert(!choice.description.content.includes("floor("));
    assert(!choice.description.content.includes("ceil("));
  }
  ui.cleanup();
});

for (const corruption of [false, true]) test(`all 13 ${corruption ? "flaw" : "essence"} descriptions follow the current selection`, () => {
  const previews = [];
  const ui = setup(powerChoices({corruption, level: 8}), (description) => previews.push(description));
  let submits = 0; ui.root.addEventListener("submit", () => submits++);
  for (const power of POWERS) {
    ui.trigger.click();
    assert.equal(ui.trigger.getAttribute("aria-expanded"), "true");
    assert.equal(ui.list.hidden, false);
    ui.list.querySelector(`[data-soulforger-option="${power.id}"]`).click();
    assert.equal(ui.field.value, power.id);
    assert.equal(ui.list.hidden, true);
    assert.equal(ui.trigger.querySelector("img").getAttribute("src"), powerIcon(power.id, corruption));
    const button = ui.root.querySelector("[data-soulforger-description]");
    assert.equal(button.getAttribute("type"), "button");
    button.click();
    assert(previews.at(-1).title.includes(power.en));
    const expectedPrefix = (corruption ? power.flaw : power.benefit).split("floor(")[0].split("ceil(")[0];
    assert(previews.at(-1).content.includes(expectedPrefix));
    assert.equal(ui.field.value, power.id);
  }
  assert.equal(previews.length, 13); assert.equal(submits, 0); ui.cleanup();
});

test("inventory images are preserved both in the expanded menu and after selecting an item", () => {
  const choices = [
    {value: "sword", label: "Меч", img: "worlds/custom/images/my-sword.webp"},
    {value: "shield", label: "Щит", img: "systems/pf2e/icons/equipment/shields/steel-shield.webp"}
  ];
  const ui = setup(choices);
  assert.equal(ui.root.querySelector('[data-soulforger-description]'), null);
  assert.equal(ui.trigger.querySelector("img").getAttribute("src"), choices[0].img);
  ui.trigger.click();
  assert.deepEqual([...ui.list.querySelectorAll("img")].map((img) => img.getAttribute("src")), choices.map((c) => c.img));
  ui.list.querySelector('[data-soulforger-option="shield"]').click();
  assert.equal(ui.field.value, "shield");
  assert.equal(ui.trigger.querySelector("img").getAttribute("src"), choices[1].img);
  assert.equal(ui.trigger.querySelector("span").textContent, "Щит");
  ui.cleanup();
});

test("damage and movement lists without images keep a plain dropdown", () => {
  const html = renderChoiceContent("Тип урона", [{value: "fire", label: "Огонь"}, {value: "cold", label: "Холод"}]);
  assert(html.includes('<select name="choice"'));
  assert(!html.includes('type="radio"')); assert(!html.includes("data-soulforger-description"));
});

test("opening info while the menu is expanded closes only that menu and keeps the selection", () => {
  const previews = [];
  const ui = setup(undefined, (description) => previews.push(description));
  ui.trigger.click();
  ui.list.querySelector('[data-soulforger-option="heroic-heart"]').click();
  ui.trigger.click();
  ui.root.querySelector('[data-soulforger-description]').click();
  assert.equal(ui.list.hidden, true); assert.equal(ui.field.value, "heroic-heart");
  assert(previews[0].title.includes("Heroic Heart")); ui.cleanup();
});

test("keyboard selection, escape, and outside clicks control the popup without applying anything", () => {
  const ui = setup();
  assert.equal(key(ui.window, ui.trigger, "ArrowDown").defaultPrevented, true);
  assert.equal(ui.list.hidden, false);
  const option = ui.list.querySelector('[data-soulforger-option="heroic-heart"]');
  assert.equal(key(ui.window, option, "Enter").defaultPrevented, true);
  assert.equal(ui.field.value, "heroic-heart"); assert.equal(ui.list.hidden, true);
  ui.trigger.click(); key(ui.window, ui.trigger, "Escape");
  assert.equal(ui.list.hidden, true); assert.equal(ui.field.value, "heroic-heart");
  ui.trigger.click();
  ui.document.querySelector("#outside").dispatchEvent(new ui.window.Event("pointerdown", {bubbles: true}));
  assert.equal(ui.list.hidden, true); assert.equal(ui.field.value, "heroic-heart"); ui.cleanup();
});

test("the popup uses the browser top layer when available and restores cleanly", () => {
  const ui = setup(); let shown = 0, hidden = 0;
  ui.list.showPopover = () => shown++;
  ui.list.hidePopover = () => hidden++;
  ui.trigger.click(); assert.equal(shown, 1); assert(ui.root.contains(ui.list));
  ui.trigger.click(); assert.equal(hidden, 1); assert.equal(ui.list.hidden, true);
  ui.cleanup();
});

test("the body fallback escapes dialog clipping and cleanup removes the floating popup", () => {
  const ui = setup(); ui.trigger.click();
  assert.equal(ui.list.parentNode, ui.document.body);
  ui.cleanup();
  assert(ui.root.contains(ui.list)); assert.equal(ui.list.hidden, true);
  assert.equal(ui.trigger.getAttribute("aria-expanded"), "false");
});

test("re-rendering does not retain old listeners or duplicate preview windows", () => {
  const ui = setup(); const previews = [];
  const oldCleanup = bindChoiceDescriptions(ui.root, powerChoices({level: 8}), () => assert.fail("stale listener"));
  const cleanup = bindChoiceDescriptions(ui.root, powerChoices({level: 8}), (description) => previews.push(description));
  oldCleanup();
  ui.root.querySelector('[data-soulforger-description]').click();
  assert.equal(previews.length, 1); cleanup();
  ui.root.querySelector('[data-soulforger-description]').click();
  assert.equal(previews.length, 1);
});

test("preview formulas and image use the current level and selected effect", () => {
  const heal = POWERS.find((p) => p.id === "healing-grace");
  const before = JSON.stringify(POWERS);
  const description = describePower(heal, {level: 7});
  assert(description.content.includes("Быстрое исцеление 3")); assert(description.content.includes("Heal ранга 4"));
  assert(description.content.includes(powerIcon(heal.id)));
  assert.equal(JSON.stringify(POWERS), before);
});

test("all 26 effect images are PF2e system references and positive and negative images differ", () => {
  for (const power of POWERS) {
    for (const corruption of [false, true]) {
      const img = powerIcon(power.id, corruption);
      assert.match(img, /^systems\/pf2e\/icons\/.+\.webp$/);
      assert.equal(makeEffect(power, {level: 8, targetId: "weapon", movement: "fly", damageType: "fire"}, {corruption}).img, img);
    }
    assert.notEqual(POWER_ICONS[power.id].essence, POWER_ICONS[power.id].corruption);
  }
});

test("icon migration updates existing module effects and leaves inventory images and rules intact", async () => {
  const items = [
    {id: "buff", type: "effect", img: "old.webp", flags: {[MODULE]: {kind: "essence", power: "heroic-heart"}}, system: {rules: [{key: "FlatModifier"}]}},
    {id: "flaw", type: "effect", img: "old.webp", flags: {[MODULE]: {kind: "corruption", power: "planar-pain"}}},
    {id: "sword", type: "weapon", img: "worlds/my-image.webp", flags: {}}
  ];
  let captured;
  const actor = {items: {contents: items}, updateEmbeddedDocuments: async (_type, updates) => {captured = updates;}};
  const before = JSON.stringify(items);
  await migrateActorIcons(actor);
  assert.equal(captured.length, 2); assert.equal(moduleItemIcon(items[2]), null);
  for (const update of captured) {
    assert.deepEqual(Object.keys(update).sort(), ["_id", "img", `flags.${MODULE}.version`].sort());
    assert.equal(update[`flags.${MODULE}.version`], VERSION);
  }
  assert.equal(captured[0].img, powerIcon("heroic-heart"));
  assert.equal(captured[1].img, powerIcon("planar-pain", true));
  assert.equal(JSON.stringify(items), before);
});

test("labels, values, and description content are HTML escaped", () => {
  const description = describePower({ru: "<bad>", en: "Title", benefit: '<img onerror="bad()">', flaw: "flaw"});
  assert(!description.content.includes('<img onerror='));
  const html = renderChoiceContent("Выбор", [{value: 'x" bad="y', label: "<label>", img: 'x" onerror="bad', description}]);
  assert(html.includes("&lt;label&gt;")); assert(!html.includes('src="x" onerror='));
});

