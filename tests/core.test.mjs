import {test, beforeEach} from "node:test";
beforeEach(() => {globalThis.game = {i18n: {lang: "ru", localize: (key) => key}};});
import assert from "node:assert/strict";
import {
  MODULE, IDS, POWERS, DAMAGE_TYPES, eligibleItems, essenceRules, corruptionRules,
  makeEffect, itemTemplates, stasisEffect, activateTransaction, escapeHTML
} from "../scripts/core.mjs";

const power = (id) => POWERS.find((p) => p.id === id);
const inventory = [
  {id: "sword", type: "weapon", name: "Sword", isMelee: true, system: {range: null, category: "martial"}},
  {id: "spear", type: "weapon", name: "Spear", isMelee: true, system: {range: null, category: "simple", traits: {value: ["thrown-20"]}}},
  {id: "bow", type: "weapon", name: "Bow", isMelee: false, system: {range: 60, category: "martial"}},
  {id: "fist", type: "weapon", name: "Fist", isMelee: true, system: {category: "unarmed"}},
  {id: "armor", type: "armor", name: "Armor", system: {category: "heavy"}},
  {id: "shield", type: "shield", name: "Shield", system: {}},
  {id: "oldshield", type: "armor", name: "Old shield", system: {category: "shield"}},
  {id: "potion", type: "consumable", name: "Potion", system: {}}
];
const ids = (items) => items.map((i) => i.id);
test("13 distinct powers and the remaster's 8 damage types", () => {
  assert.equal(POWERS.length, 13); assert.equal(new Set(POWERS.map((p) => p.id)).size, 13);
  assert.equal(Object.keys(DAMAGE_TYPES).length, 8);
  assert(!("good" in DAMAGE_TYPES)); assert(!("negative" in DAMAGE_TYPES));
});
test("Bounding Spirit offers only melee weapons, including a throwable spear", () => {
  assert.deepEqual(ids(eligibleItems(inventory, "melee")), ["sword", "spear"]);
});
test("weapon powers exclude unarmed attacks and consumables", () => {
  assert.deepEqual(ids(eligibleItems(inventory, "weapon")), ["sword", "spear", "bow"]);
});
test("armor and shield filters distinguish modern and older shield item data", () => {
  assert.deepEqual(ids(eligibleItems(inventory, "armor")), ["armor"]);
  assert.deepEqual(ids(eligibleItems(inventory, "shield")), ["shield", "oldshield"]);
  assert.deepEqual(ids(eligibleItems(inventory, "armor-shield")), ["armor", "shield", "oldshield"]);
});
test("inventory data is never modified by filtering", () => {
  const before = JSON.stringify(inventory);
  for (const p of POWERS) eligibleItems(inventory, p.equipment);
  assert.equal(JSON.stringify(inventory), before);
});
test("all generated assets have valid unique Foundry IDs and resolvable local links", () => {
  const templates = itemTemplates(), known = new Set(templates.map((i) => `Item.${i._id}`));
  assert.equal(templates.length, 4); assert.equal(known.size, 4);
  for (const id of Object.values(IDS)) assert.match(id, /^[A-Za-z0-9]{16}$/);
  for (const item of templates) {
    if (item.system.selfEffect) assert(known.has(item.system.selfEffect.uuid));
    for (const rule of item.system.rules) if (rule.key === "GrantItem") assert(known.has(rule.uuid));
  }
});
test("main feat grants exactly one additional free action and only manifest has daily frequency", () => {
  const templates = itemTemplates();
  const feat = templates.find((t) => t.type === "feat"), flaw = templates.find((t) => t.type === "action");
  assert.equal(feat.name, "Проявить форму эссенции"); assert.equal(feat.system.actionType.value, "free");
  assert.deepEqual(feat.system.frequency, {max: 1, per: "day"});
  assert.equal(flaw.name, "Применить изъян порока"); assert.equal(flaw.system.actionType.value, "free");
  assert.equal(flaw.system.frequency, undefined); assert.equal(feat.system.rules.filter((r) => r.key === "GrantItem").length, 1);
});
for (const p of POWERS) test(`${p.en}: a timed benefit and an unlimited independent corruption effect`, () => {
  const config = {level: 7, targetId: "Sword00000000001", targetName: "<unsafe>", movement: "climb", damageType: "electricity"};
  const benefit = makeEffect(p, config, {worldTime: 100, initiative: 17});
  const flaw = makeEffect(p, config, {corruption: true, worldTime: 100});
  assert.equal(benefit.system.duration.value, 1); assert.equal(benefit.system.duration.unit, "minutes");
  assert.equal(benefit.flags[MODULE].expiresAt, 160); assert.equal(benefit.system.start.initiative, 17);
  assert.equal(flaw.system.duration.unit, "unlimited"); assert(!("expiresAt" in flaw.flags[MODULE]));
  assert.equal(benefit.flags[MODULE].power, p.id); assert.equal(flaw.flags[MODULE].kind, "corruption");
  assert(!benefit.system.description.value.includes("<unsafe>"));
  assert(benefit.system.rules.length > 0); assert(flaw.system.rules.length > 0);
  for (const rule of [...benefit.system.rules, ...flaw.system.rules]) {
    if (rule.key === "FlatModifier") assert(Array.isArray(rule.selector));
    if (["Resistance", "Weakness"].includes(rule.key)) assert(Array.isArray(rule.type));
  }
});
test("Harmful Malice affects all Strikes and no spell damage", () => {
  const rule = essenceRules(power("harmful-malice")).find((r) => r.key === "DamageDice");
  assert.equal(rule.selector, "strike-damage"); assert.equal(rule.damageType, "void");
  assert.equal(rule.diceNumber, 1); assert.equal(rule.dieSize, "d4");
});
test("Planar Pain changes only physical components of the exact selected item", () => {
  const rules = essenceRules(power("planar-pain"), {targetId: "one-of-two-identical-swords", damageType: "sonic"});
  const alteration = rules.find((r) => r.key === "DamageAlteration");
  assert.deepEqual(alteration.selectors, ["one-of-two-identical-swords-damage"]);
  assert.deepEqual(alteration.predicate, ["damage:category:physical"]);
  assert.equal(alteration.value, "sonic");
  assert.deepEqual(rules.find((r) => r.key === "FlatModifier").selector, ["one-of-two-identical-swords-damage"]);
});
test("Determined Toughness adjusts status modifiers without lowering real conditions", () => {
  const rules = essenceRules(power("determined-toughness"));
  assert.equal(rules.filter((r) => r.key === "AdjustModifier").length, 6);
  assert(!rules.some((r) => ["ActiveEffectLike", "ItemAlteration", "LoseHitPoints"].includes(r.key)));
});
test("language suppression uses the localized PF2e modifier slug and a perception toggle", () => {
  const rules = essenceRules(power("deep-seated-fear"), {unintelligibleSlug: "непонятная-речь"});
  const adjustment = rules.find((r) => r.key === "AdjustModifier");
  assert.equal(adjustment.slug, "непонятная-речь");
  assert.deepEqual(adjustment.predicate, ["soulforger:target-perceives-essence"]);
});
test("shield benefit targets its HP and hardness and preserves an existing Shield Block", () => {
  const missing = essenceRules(power("resolute-defiance"), {targetId: "shield", level: 8, hasShieldBlock: false});
  const present = essenceRules(power("resolute-defiance"), {targetId: "shield", hasShieldBlock: true});
  assert(missing.some((r) => r.key === "GrantItem")); assert(!present.some((r) => r.key === "GrantItem"));
  assert(!missing.some((r) => r.key === "TempHP"));
  assert.deepEqual(missing.filter((r) => r.key === "ItemAlteration"), [
    {key: "ItemAlteration", itemId: "shield", mode: "add", property: "hardness", value: 2},
    {key: "ItemAlteration", itemId: "shield", mode: "add", property: "hp-max", value: 10}
  ]);
});
test("magical defense is conditional and all-damage weakness is not physical-only", () => {
  const rules = essenceRules(power("magical-resilience"));
  const bonus = rules.find((r) => r.key === "FlatModifier");
  assert.equal(bonus.value, 2); assert.equal(bonus.type, "status"); assert(bonus.predicate.length);
  assert.deepEqual(corruptionRules(power("planar-bond")).find((r) => r.key === "Weakness").type, ["all-damage"]);
});
test("stasis duration follows its origin and the critical condition is transient", () => {
  const normal = stasisEffect(false, 600, 18), critical = stasisEffect(true, 600, 18);
  assert.equal(normal.system.duration.value, 1); assert.equal(normal.system.duration.unit, "rounds");
  assert.equal(normal.system.start.initiative, 18);
  assert.equal(critical.system.rules[0].inMemoryOnly, true);
});
test("escaping rejects HTML injection in names and dialog labels", () => {
  assert.equal(escapeHTML('<img src="x" onerror=\'evil()\'>&'), "&lt;img src=&quot;x&quot; onerror=&#39;evil()&#39;&gt;&amp;");
});
test("cancel never creates an effect or consumes a use", async () => {
  let mutations = 0;
  const result = await activateTransaction({remaining: 1, choose: async () => null,
    apply: async () => {mutations++;}, consume: async () => {mutations++;}, rollback: async () => {mutations++;}});
  assert.equal(result.status, "cancelled"); assert.equal(mutations, 0);
});
test("an exhausted action never opens any dialog", async () => {
  const result = await activateTransaction({remaining: 0, choose: async () => assert.fail("dialog"),
    apply: async () => assert.fail("apply"), consume: async () => assert.fail("consume")});
  assert.equal(result.status, "exhausted");
});
test("all prompts precede effect application and daily consumption", async () => {
  const calls = [];
  const result = await activateTransaction({remaining: 1,
    choose: async () => {calls.push("power", "weapon", "damage-type"); return {power: "chosen"};},
    apply: async () => {calls.push("effect"); return {id: "effect"};},
    consume: async (value) => {assert.equal(value, 0); calls.push("consume");}, rollback: async () => assert.fail("rollback")});
  assert.equal(result.status, "applied"); assert.deepEqual(calls, ["power", "weapon", "damage-type", "effect", "consume"]);
});
test("a resource update failure rolls back already created effects", async () => {
  let rolledBack = false;
  await assert.rejects(activateTransaction({remaining: 1, choose: async () => ({}), apply: async () => ({id: "effect"}),
    consume: async () => {throw Error("write failed");}, rollback: async (receipt) => {assert.equal(receipt.id, "effect"); rolledBack = true;}}), /write failed/);
  assert(rolledBack);
});
test("corruption application does not consume manifestation frequency", async () => {
  const result = await activateTransaction({remaining: null, choose: async () => ({}), apply: async () => ({id: "flaw"}),
    consume: async () => assert.fail("consume"), rollback: async () => assert.fail("rollback")});
  assert.equal(result.status, "applied");
});

