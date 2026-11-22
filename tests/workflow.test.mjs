import {test, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {parseHTML} from "linkedom";
import {POWERS, MODULE, SPELLS} from "../scripts/core.mjs";
import {use, installDamageCapture} from "../scripts/main.mjs";

let dialogs, updates, cards, notices, serial;
beforeEach(() => {
  dialogs = []; updates = []; cards = []; notices = []; serial = 0;
  globalThis.ui = {notifications: Object.fromEntries(["info", "warn", "error"].map((kind) => [kind, (text) => notices.push({kind, text})]))};
  globalThis.game = {time: {worldTime: 700}, user: {id: "user", targets: new Set()},
    pf2e: {system: {sluggify: (s) => s.toLowerCase().replaceAll(" ", "-")}}, i18n: {lang: "ru", localize: (key) => key === "PF2E.Actions.Demoralize.Unintelligible" ? "Непонятная речь" : key}};
  globalThis.foundry = {utils: {
    getProperty: (object, path) => path.split(".").reduce((o, k) => o?.[k], object),
    setProperty: (object, path, value) => {const parts = path.split("."); const last = parts.pop();
      const target = parts.reduce((o, k) => o[k] ??= {}, object); target[last] = value; return true;}
  }, applications: {api: {DialogV2: {wait: async () => {
    assert(dialogs.length, "unexpected dialog"); const answer = dialogs.shift();
    return typeof answer === "function" ? answer() : answer;
  }}}}};
  globalThis.ChatMessage = {getSpeaker: ({actor}) => ({actor: actor.id}), create: async (data) => {cards.push(data); return data;}};
  globalThis.fromUuid = async (uuid) => {
    assert(Object.values(SPELLS).some((s) => s.uuid === uuid));
    return {type: "spell", toObject: () => ({type: "spell", name: "Original spell", system: {}, flags: {}})};
  };
});
function mockActor({remaining = 1, failConsume = false, level = 8} = {}) {
  const map = new Map();
  Object.defineProperty(map, "contents", {get: () => [...map.values()]});
  const actor = {id: `actor${Math.random()}`, level, isOwner: true, system: {details: {level: {value: level}}, movement: {speeds: {land: {value: 25}}}},
    items: map, flags: {}, getFlag: (scope, key) => actor.flags[scope]?.[key],
    setFlag: async (scope, key, value) => ((actor.flags[scope] ??= {})[key] = value),
    deleteEmbeddedDocuments: async (_type, ids) => {for (const id of ids) map.delete(id);},
    updateEmbeddedDocuments: async () => [],
    createEmbeddedDocuments: async (_type, sources) => sources.map((data) => {
      const item = makeItem(data); map.set(item.id, item); return item;
    })};
  actor.uuid = `Actor.${actor.id}`;
  function makeItem(data) {
    const id = data._id ?? `generated${++serial}`;
    const item = {...structuredClone(data), id, actor, uuid: `${actor.uuid}.Item.${id}`, rules: [],
      delete: async () => map.delete(id), getFlag: (scope, key) => item.flags?.[scope]?.[key],
      setFlag: async (scope, key, value) => ((item.flags ??= {})[scope] ??= {})[key] = value,
      unsetFlag: async (scope, key) => {if (item.flags?.[scope]) delete item.flags[scope][key];},
      update: async (changes) => {
        updates.push(changes);
        if (failConsume && "system.frequency.value" in changes) throw Error("resource update failed");
        for (const [path, value] of Object.entries(changes)) {
          const parts = path.split(".");
          if (parts.at(-1).startsWith("-=")) {
            const parent = foundry.utils.getProperty(item, parts.slice(0, -1).join("."));
            if (parent) delete parent[parts.at(-1).slice(2)];
          } else foundry.utils.setProperty(item, path, value);
        }
      }};
    return item;
  }
  for (const data of [
    {_id: "manifest", type: "feat", system: {frequency: {value: remaining, max: 1, per: "day"}}, flags: {[MODULE]: {action: "manifest"}}},
    {_id: "corruption", type: "action", system: {}, flags: {[MODULE]: {action: "corruption"}}},
    {_id: "sword", name: "Меч", type: "weapon", isMelee: true, system: {category: "martial"}},
    {_id: "bow", name: "Лук", type: "weapon", isMelee: false, system: {category: "martial", range: 60}},
    {_id: "armor", name: "Доспех", type: "armor", system: {category: "heavy"}},
    {_id: "shield", name: "Щит", type: "shield", system: {hp: {value: 20}, hardness: 5}}
  ]) {const item = makeItem(data); map.set(item.id, item);}
  return actor;
}

for (const power of POWERS) test(`Use: ${power.en} prompts, applies, and spends exactly one use`, async () => {
  const actor = mockActor();
  dialogs.push(power.id);
  if (power.equipment) dialogs.push(({melee: "sword", weapon: "sword", armor: "armor", shield: "shield", "armor-shield": "shield"})[power.equipment]);
  if (power.id === "adaptable-persona") dialogs.push("fly");
  if (["planar-bond", "planar-pain"].includes(power.id)) dialogs.push("electricity");
  await use(actor, actor.items.get("manifest"));
  const applied = actor.items.contents.filter((i) => i.flags?.[MODULE]?.kind === "essence");
  assert.equal(applied.length, 1); assert.equal(applied[0].flags[MODULE].power, power.id);
  assert.equal(actor.items.get("manifest").system.frequency.value, 0);
  assert.equal(updates.filter((u) => "system.frequency.value" in u).length, 1);
  assert.equal(dialogs.length, 0); assert.equal(cards.length, 1);
  if (SPELLS[power.id]) {
    const spell = actor.items.contents.find((i) => i.type === "spell");
    assert(spell); assert.equal(spell.system.location.uses.value, 1);
    assert.equal(spell.system.location.heightenedLevel, power.id === "magical-resilience" ? 3 : 4);
    assert.equal(spell.flags[MODULE].effectId, applied[0].id);
  }
  if (power.id === "resolute-defiance") {
    assert.equal(actor.items.get("shield").getFlag(MODULE, "shieldHP").value, 10);
    assert.equal(actor.items.get("shield").system.hp.value, 30);
    assert.equal(actor.system.attributes?.hp?.temp, undefined);
  }
});
for (const power of POWERS) test(`Use: corruption ${power.en} leaves the daily use intact`, async () => {
  const actor = mockActor(); dialogs.push(power.id);
  if (power.id === "planar-pain") dialogs.push("fire");
  await use(actor, actor.items.get("corruption"));
  const effects = actor.items.contents.filter((i) => i.flags?.[MODULE]?.kind === "corruption");
  assert.equal(effects.length, 1); assert.equal(effects[0].system.duration.unit, "unlimited");
  assert.equal(actor.items.get("manifest").system.frequency.value, 1); assert.equal(dialogs.length, 0);
});
for (const choices of [[null], ["bounding-spirit", null], ["planar-pain", "sword", null]])
  test(`cancel at step ${choices.length} has no side effects`, async () => {
    const actor = mockActor(); const before = actor.items.size; dialogs.push(...choices);
    await use(actor, actor.items.get("manifest"));
    assert.equal(actor.items.size, before); assert.equal(actor.items.get("manifest").system.frequency.value, 1);
    assert.equal(cards.length, 0);
  });
test("a bow cannot be injected as Bounding Spirit's melee weapon", async () => {
  const actor = mockActor(); dialogs.push("bounding-spirit", "bow");
  await assert.rejects(use(actor, actor.items.get("manifest")), /больше недоступен/);
  assert.equal(actor.items.get("manifest").system.frequency.value, 1);
});
test("failure to consume resources removes both the new essence and its temporary spell", async () => {
  const actor = mockActor({failConsume: true}); dialogs.push("healing-grace");
  await assert.rejects(use(actor, actor.items.get("manifest")), /resource update failed/);
  assert(!actor.items.contents.some((i) => i.flags?.[MODULE]?.kind === "essence"));
  assert(!actor.items.contents.some((i) => ["spell", "spellcastingEntry"].includes(i.type)));
});
test("missing applicable equipment does not spend a use", async () => {
  const actor = mockActor(); actor.items.delete("shield"); dialogs.push("resolute-defiance");
  await use(actor, actor.items.get("manifest"));
  assert.equal(actor.items.get("manifest").system.frequency.value, 1);
  assert(notices.some((n) => n.text.includes("нет подходящего предмета")));
});
test("repeated clicks while a dialog is open cannot spend twice", async () => {
  const actor = mockActor(); let resolve;
  dialogs.push(() => new Promise((r) => {resolve = r;}));
  const first = use(actor, actor.items.get("manifest"));
  await use(actor, actor.items.get("manifest"));
  resolve("heroic-heart"); await first;
  assert.equal(actor.items.get("manifest").system.frequency.value, 0);
  assert.equal(actor.items.contents.filter((i) => i.flags?.[MODULE]?.kind === "essence").length, 1);
});
test("an exhausted daily action never prompts", async () => {
  const actor = mockActor({remaining: 0}); await use(actor, actor.items.get("manifest"));
  assert.equal(cards.length, 0); assert(notices.some((n) => n.kind === "warn"));
});
test("reserved native use is restored if the user cancels", async () => {
  const actor = mockActor({remaining: 0}); dialogs.push(null);
  await use(actor, actor.items.get("manifest"), {reserved: true});
  assert.equal(actor.items.get("manifest").system.frequency.value, 1);
});
test("level 4 Magical Resilience does not grant Dispel Magic", async () => {
  const actor = mockActor({level: 4}); dialogs.push("magical-resilience", "armor");
  await use(actor, actor.items.get("manifest"));
  assert(!actor.items.contents.some((i) => i.type === "spell"));
});
for (const corruption of [false, true]) test(`opening all ${corruption ? "flaw" : "essence"} previews never applies an effect or spends a use`, async () => {
  const actor = mockActor();
  const initialSize = actor.items.size;
  const previews = [];
  class PreviewDialog {
    constructor(options) {this.options = options; previews.push(options);}
    render() {return Promise.resolve(this);}
    static async wait(options) {
      assert.equal(options.rejectClose, false);
      assert.equal(options.position.width, 640);
      assert.equal(options.modal, false);
      const {document, window} = parseHTML(`<html><body><form>${options.content}</form></body></html>`);
      const root = document.querySelector("form");
      options.render(new window.Event("render"), {element: root});
      for (const power of POWERS) {
        root.querySelector('[data-soulforger-dropdown]').click();
        document.querySelector(`[data-soulforger-option="${power.id}"]`).click();
        root.querySelector('[data-soulforger-description]').click();
        assert.equal(root.querySelector('[name="choice"]').value, power.id);
        assert.equal(actor.items.size, initialSize);
        assert.equal(actor.items.get("manifest").system.frequency.value, 1);
        assert(previews.at(-1).window.title.includes(power.en));
        assert(previews.at(-1).window.title.startsWith(corruption ? "Изъян порока:" : "Форма эссенции:"));
        assert.deepEqual(previews.at(-1).buttons.map((b) => b.action), ["close"]);
      }
      options.close();
      return null;
    }
  }
  foundry.applications.api.DialogV2 = PreviewDialog;
  await use(actor, actor.items.get(corruption ? "corruption" : "manifest"));
  assert.equal(previews.length, 13);
  assert.equal(updates.length, 0);
  assert.equal(cards.length, 0);
});
test("wrapping the shield damage pipeline delegates unchanged and is idempotent", async () => {
  class FakeActor {
    calculateHealthDelta(args) {return {delta: args.delta};}
    async applyDamage(args) {return {actor: this, args};}
  }
  assert.equal(installDamageCapture(FakeActor), true); assert.equal(installDamageCapture(FakeActor), false);
  const actor = new FakeActor(); const result = await actor.applyDamage({damage: 7});
  assert.equal(result.actor, actor); assert.equal(result.args.damage, 7);
  assert.deepEqual(actor.calculateHealthDelta({delta: 12}), {delta: 12});
});

for (const power of POWERS) test(`English activation and corruption: ${power.en}`, async () => {
  game.i18n.lang = "en";
  const actor = mockActor();
  const dialogOptions = [];
  const wait = foundry.applications.api.DialogV2.wait;
  foundry.applications.api.DialogV2.wait = async (options) => {dialogOptions.push(options); return wait(options);};
  dialogs.push(power.id);
  if (power.equipment) dialogs.push(({melee: "sword", weapon: "sword", armor: "armor", shield: "shield", "armor-shield": "shield"})[power.equipment]);
  if (power.id === "adaptable-persona") dialogs.push("fly");
  if (["planar-bond", "planar-pain"].includes(power.id)) dialogs.push("fire");
  await use(actor, actor.items.get("manifest"));
  dialogs.push(power.id);
  await use(actor, actor.items.get("corruption"));
  const essence = actor.items.contents.find((i) => i.flags?.[MODULE]?.kind === "essence");
  const flaw = actor.items.contents.find((i) => i.flags?.[MODULE]?.kind === "corruption");
  assert(essence.name.startsWith(`Essence Form: ${power.en}`));
  assert.equal(flaw.name, `Corruption Flaw: ${power.en}`);
  assert.equal(actor.items.get("manifest").system.frequency.value, 0);
  assert.equal(cards.length, 2); assert.equal(dialogs.length, 0);
  for (const options of dialogOptions) {
    assert.deepEqual(options.buttons.map((b) => b.label), ["Choose", "Cancel"]);
    assert(!/\p{Script=Cyrillic}/u.test(options.window.title));
  }
  assert.equal(actor.items.get("shield").name, "Щит", "the user's inventory names must remain intact");
  if (SPELLS[power.id]) {
    const entry = actor.items.contents.find((i) => i.type === "spellcastingEntry");
    assert.equal(entry.name, `Essence: ${power.en}`);
    assert.equal(actor.items.contents.find((i) => i.type === "spell").name, SPELLS[power.id].name);
  }
});

