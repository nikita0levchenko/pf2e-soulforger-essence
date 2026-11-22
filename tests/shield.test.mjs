import {test, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {MODULE, makeEffect, powerById} from "../scripts/core.mjs";
import {grantShieldHP, cleanup, migrateShieldHP, migrateActorTexts, installDamageCapture,
  preUpdateItem, preCreateChat, onUpdateChat, onChat} from "../scripts/main.mjs";

let totals, checks, events;
const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
function set(object, path, value) {
  const parts = path.split("."), key = parts.pop();
  const parent = parts.reduce((value, part) => value[part] ??= {}, object);
  if (key.startsWith("-=")) delete parent[key.slice(2)];
  else parent[key] = structuredClone(value);
}
function merge(object, changes, prefix = "") {
  for (const [key, value] of Object.entries(changes)) {
    const path = prefix + key;
    if (value && typeof value === "object" && !Array.isArray(value)) merge(object, value, path + ".");
    else set(object, path, value);
  }
}
beforeEach(() => {
  totals = []; checks = []; events = [];
  globalThis.foundry = {utils: {getProperty: get, setProperty: set}};
  globalThis.ui = {notifications: {warn() {}, error() {}, info() {}}};
  globalThis.game = {i18n: {lang: "ru", localize: (key) => key}, user: {id: "user"}, time: {worldTime: 700}, pf2e: {
    CheckModifier: class {constructor(label, statistic) {
      this.label = label; this.modifiers = statistic.modifiers.map((m) => m.clone());
      assert.equal(this.modifiers.length, 0, "flat checks must not inherit any statistic modifiers");
    }},
    Check: {async roll(check, context) {
      checks.push({check, context}); events.push("check");
      const total = totals.length ? await totals.shift() : 17;
      return total === null ? null : {total};
    }}
  }};
  globalThis.ChatMessage = {getSpeaker: ({actor}) => ({actor: actor.id}), create: async (data) => data};
});

/** The native PF2e HP/Hardness stages, with document preparation and chat hooks.
 *  In particular, native shield damage reads _source.hp.value and caps at that value.
 *  Reference: pf2e-8.6.1/src/module/actor/base.ts (applyDamage/undoDamage).
 */
class ShieldActor {
  constructor({hp = 20, max = 20, hardness = 5, raised = true, resistance = 0, actorHardness = 0} = {}) {
    this.id = `shield-test-${Math.random()}`; this.uuid = `Actor.${this.id}`;
    this.level = 8; this.isOwner = true; this.resistance = resistance; this.hardness = actorHardness;
    this.system = {attributes: {hp: {value: 100, max: 100, temp: 0}}};
    this.items = new Map();
    Object.defineProperty(this.items, "contents", {get: () => [...this.items.values()]});
    this.calls = []; this.messages = []; this.sequence = 0;
    this.addItem({_id: "shield", type: "shield", name: "Щит", system: {
      hp: {value: hp, max}, hardness, equipped: {carryType: "held", handsHeld: 1}
    }});
    if (raised) this.addItem({_id: "raised", type: "effect", system: {slug: "effect-raise-a-shield", rules: []}});
  }
  get shield() {return this.items.get("shield");}
  get heldShield() {return this.shield?.isEquipped ? this.shield : null;}
  prepare() {
    for (const item of this.items.values()) {
      item.system = structuredClone(item._source.system);
      item.name = item._source.name ?? item.id;
    }
    for (const effect of this.items.values()) {
      if (effect.type !== "effect" || effect.isExpired || effect.system.expired) continue;
      for (const rule of effect.system.rules ?? []) {
        const item = this.items.get(rule.itemId);
        if (rule.key !== "ItemAlteration" || !item) continue;
        if (rule.property === "hp-max") item.system.hp.max += rule.value;
        if (rule.property === "hardness") item.system.hardness += rule.value;
      }
    }
    for (const item of this.items.values()) if (item.type === "shield") {
      item.system.hp.value = Math.max(0, Math.min(item.system.hp.max, item.system.hp.value));
      item.system.hp.brokenThreshold = Math.floor(item.system.hp.max / 2);
    }
    const shield = this.heldShield;
    this.system.attributes.shield = {itemId: shield?.id ?? null,
      raised: !!shield && this.items.has("raised"), hardness: shield?.system.hardness ?? 0,
      broken: !!shield && shield.system.hp.value <= shield.system.hp.brokenThreshold,
      destroyed: !!shield && shield.system.hp.value === 0};
  }
  addItem(data) {
    const actor = this, source = structuredClone(data);
    source.flags ??= {};
    const id = source._id ?? `effect${++this.sequence}`;
    const item = {id, actor, type: source.type, name: source.name ?? id, _source: source,
      flags: source.flags, system: structuredClone(source.system),
      get slug() {return this.system.slug;},
      get isEquipped() {return this.system.equipped?.carryType === "held";},
      getFlag(scope, key) {return this.flags[scope]?.[key];},
      async setFlag(scope, key, value) {return this.update({[`flags.${scope}.${key}`]: value});},
      async unsetFlag(scope, key) {return this.update({[`flags.${scope}.-=${key}`]: null});},
      async delete() {await actor.deleteEmbeddedDocuments("Item", [id]);},
      async update(changes, options = {}) {
        events.push(`update:${id}`);
        preUpdateItem(item, changes, options);
        // Normal PF2e updates clamp current HP. The module explicitly opts out only
        // while adding/removing its visible HP pool (checkHP: false).
        const next = changes["system.hp.value"] ?? get(changes, "system.hp.value");
        if (typeof next === "number" && options.checkHP !== false)
          changes["system.hp.value"] = Math.max(0, Math.min(item.system.hp.max, next));
        merge(source, changes); actor.prepare(); return item;
      }};
    this.items.set(id, item); this.prepare(); return item;
  }
  async deleteEmbeddedDocuments(_type, ids) {
    events.push(`delete:${ids.join(",")}`);
    for (const id of ids) this.items.delete(id);
    this.prepare();
  }
  async applyDamage(args) {
    events.push("native-damage"); this.calls.push(args);
    const total = Number(args.damage?.total ?? args.damage);
    const finalDamage = total > 0 && typeof args.damage !== "number" && !args.skipIWR && !args.final
      ? Math.max(0, total - this.resistance) : total;
    const data = this.system.attributes.shield;
    const block = !args.final && args.shieldBlockRequest && finalDamage >= 0 && data.raised && !data.broken && !data.destroyed;
    const absorbed = block ? Math.min(data.hardness, finalDamage) : 0;
    const shieldDamage = block ? Math.min(this.shield._source.system.hp.value, finalDamage - absorbed) : 0;
    if (shieldDamage > 0) await this.shield.update({"system.hp.value": this.shield._source.system.hp.value - shieldDamage});
    const actorDamage = finalDamage > 0 ? Math.max(0, finalDamage - absorbed - (args.final ? 0 : this.hardness)) : finalDamage;
    this.system.attributes.hp.value = Math.max(0, Math.min(100, this.system.attributes.hp.value - actorDamage));
    const message = {id: `message-${this.messages.length}`, actor: args.token?.actor ?? this,
      flags: {pf2e: {context: {type: "damage-taken"}, appliedDamage: {
        isHealing: actorDamage < 0, shield: shieldDamage ? {id: "shield", damage: shieldDamage} : null,
        updates: actorDamage ? [{path: "system.attributes.hp.value", value: actorDamage}] : []
      }}}, updateSource(changes) {merge(this, changes);}};
    preCreateChat(message); this.messages.push(message);
    await onChat(message, {}, "user");
    return message;
  }
  async undo(message) {
    const applied = message.flags.pf2e.appliedDamage;
    if (applied.shield) await this.shield.update({"system.hp.value": this.shield.system.hp.value + applied.shield.damage});
    for (const update of applied.updates) this.system.attributes.hp.value += update.value;
    await onUpdateChat(message, {"flags.pf2e.appliedDamage.isReverted": true}, {}, "user");
  }
}
installDamageCapture(ShieldActor);

const power = powerById("resolute-defiance");
function flaw(actor) {
  return actor.addItem(makeEffect(power, {level: 8}, {corruption: true}));
}
async function manifest(actor) {
  const effect = actor.addItem(makeEffect(power, {level: 8, targetId: "shield", targetName: "Щит", hasShieldBlock: true}));
  await grantShieldHP(actor.shield, effect);
  return effect;
}

test("essence increases the selected shield's visible current/max HP and hardness", async () => {
  const actor = new ShieldActor();
  const other = actor.addItem({_id: "other", type: "shield", name: "Щит", system: {hp: {value: 20, max: 20}, hardness: 5}});
  await manifest(actor);
  assert.equal(actor.shield._source.system.hp.value, 30);
  assert.equal(actor.shield.system.hp.value, 30); assert.equal(actor.shield.system.hp.max, 30);
  assert.equal(actor.shield.system.hardness, 7); assert.equal(actor.shield.system.hp.brokenThreshold, 15);
  assert.equal(actor.shield._source.system.hp.max, 20);
  assert.equal(other.system.hp.value, 20); assert.equal(other.system.hp.max, 20);
  assert.equal(actor.system.attributes.hp.value, 100); assert.equal(actor.system.attributes.hp.temp, 0);
});

for (const total of [1, 4]) test(`failed DC 5 check (${total}) drops an ordinary shield before unblocked damage`, async () => {
  const actor = new ShieldActor(); flaw(actor); totals.push(total);
  const request = {damage: 12, shieldBlockRequest: true};
  const message = await actor.applyDamage(request);
  assert.equal(checks.length, 1); assert.equal(checks[0].context.type, "flat-check");
  assert.equal(checks[0].context.dc.value, 5); assert.equal(checks[0].context.skipDialog, true);
  assert.equal(actor.system.attributes.hp.value, 88); assert.equal(actor.shield.system.hp.value, 20);
  assert.equal(actor.shield.system.equipped.carryType, "dropped"); assert.equal(actor.shield.system.equipped.handsHeld, 0);
  assert(!actor.items.has("raised")); assert.equal(actor.system.attributes.shield.raised, false);
  assert.equal(actor.calls[0].shieldBlockRequest, false); assert.equal(request.shieldBlockRequest, true);
  assert.equal(message.flags.pf2e.appliedDamage.shield, null);
  assert(events.indexOf("check") < events.indexOf("delete:raised"));
  assert(events.indexOf("update:shield") < events.indexOf("native-damage"));
});

test("failed block keeps PF2e resistance processing and the essence attached to the dropped shield", async () => {
  const actor = new ShieldActor({resistance: 3}); flaw(actor); const effect = await manifest(actor); totals.push(2);
  await actor.applyDamage({damage: {total: 12}, shieldBlockRequest: true, token: {actor}});
  assert.equal(actor.system.attributes.hp.value, 91);
  assert.equal(actor.shield.system.hp.value, 30); assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 10);
  assert(actor.items.has(effect.id)); assert.equal(actor.shield.system.equipped.carryType, "dropped");
});

for (const total of [5, 20]) test(`successful DC 5 check (${total}) uses native block once`, async () => {
  const actor = new ShieldActor(); flaw(actor); await manifest(actor); totals.push(total);
  const message = await actor.applyDamage({damage: 12, shieldBlockRequest: true});
  assert.equal(checks.length, 1); assert.equal(actor.system.attributes.hp.value, 95);
  assert.equal(actor.shield.system.hp.value, 25); assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 5);
  assert(actor.items.has("raised")); assert.equal(actor.shield.system.equipped.carryType, "held");
  assert.equal(message.flags[MODULE].shieldCheckHandled, true);
  assert.equal(message.flags.pf2e.appliedDamage.shield.damage, 5);
});

test("hardness absorbing all damage still requires one check before block", async () => {
  const success = new ShieldActor(); flaw(success); totals.push(5);
  await success.applyDamage({damage: 4, shieldBlockRequest: true});
  assert.equal(checks.length, 1); assert.equal(success.system.attributes.hp.value, 100);
  const failure = new ShieldActor(); flaw(failure); totals.push(4);
  await failure.applyDamage({damage: 4, shieldBlockRequest: true});
  assert.equal(checks.length, 2); assert.equal(failure.system.attributes.hp.value, 96);
});

test("without corruption, blocking damages the expanded HP pool without a check", async () => {
  const actor = new ShieldActor(); await manifest(actor);
  await actor.applyDamage({damage: 15, shieldBlockRequest: true});
  assert.equal(checks.length, 0); assert.equal(actor.system.attributes.hp.value, 92);
  assert.equal(actor.shield.system.hp.value, 22); assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 2);
});

test("unraised shields, zero damage and healing never cause a block check", async () => {
  const unraised = new ShieldActor({raised: false}); flaw(unraised);
  await unraised.applyDamage({damage: 12, shieldBlockRequest: true});
  const actor = new ShieldActor(); flaw(actor);
  await actor.applyDamage({damage: 0, shieldBlockRequest: true});
  await actor.applyDamage({damage: -5, shieldBlockRequest: true});
  assert.equal(checks.length, 0); assert.equal(unraised.system.attributes.hp.value, 88);
});

test("damage received with a raised shield also checks once without changing the damage twice", async () => {
  const actor = new ShieldActor(); flaw(actor); totals.push(1);
  await actor.applyDamage({damage: 12});
  assert.equal(checks.length, 1); assert.equal(actor.system.attributes.hp.value, 88);
  assert.equal(actor.shield.system.equipped.carryType, "dropped");
});

test("a cancelled native check leaves damage and equipment unapplied", async () => {
  const actor = new ShieldActor(); flaw(actor); totals.push(null);
  await assert.rejects(actor.applyDamage({damage: 12, shieldBlockRequest: true}), /Урон ещё не применён/);
  assert.equal(actor.calls.length, 0); assert.equal(actor.system.attributes.hp.value, 100);
  assert(actor.items.has("raised"));
});

test("queued applications recheck the held shield after the first check drops it", async () => {
  const actor = new ShieldActor(); flaw(actor);
  let resolve;
  totals.push(new Promise((r) => {resolve = r;}));
  const first = actor.applyDamage({damage: 12, shieldBlockRequest: true});
  const second = actor.applyDamage({damage: 12, shieldBlockRequest: true});
  resolve(1); await Promise.all([first, second]);
  assert.equal(checks.length, 1); assert.equal(actor.system.attributes.hp.value, 76);
  assert.equal(actor.shield.system.hp.value, 20); assert.equal(actor.calls.length, 2);
});

test("a contextual actor uses its live token actor for the check and equipment updates", async () => {
  const actor = new ShieldActor(); flaw(actor); totals.push(1);
  const contextual = Object.create(actor);
  await contextual.applyDamage({damage: 12, shieldBlockRequest: true, token: {actor}});
  assert.equal(checks[0].context.actor, actor); assert(!actor.items.has("raised"));
  assert.equal(actor.shield.system.equipped.carryType, "dropped");
});

test("overwhelming damage uses native expanded shield HP and undo restores HP and the unused bonus", async () => {
  const actor = new ShieldActor(); const effect = await manifest(actor);
  const message = await actor.applyDamage({damage: 60, shieldBlockRequest: true});
  assert.equal(actor.shield.system.hp.value, 0); assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 0);
  assert.equal(message.flags.pf2e.appliedDamage.shield.damage, 30);
  await actor.undo(message);
  assert.equal(actor.shield.system.hp.value, 30); assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 10);
  await cleanup(actor, effect.id); await effect.delete();
  assert.equal(actor.shield.system.hp.value, 20); assert.equal(actor.shield.system.hp.max, 20);
});

test("actor hardness does not reduce damage applied to the shield's added HP", async () => {
  const actor = new ShieldActor({actorHardness: 5}); await manifest(actor);
  await actor.applyDamage({damage: 25, shieldBlockRequest: true});
  assert.equal(actor.system.attributes.hp.value, 87); assert.equal(actor.shield.system.hp.value, 12);
  assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 0);
});

test("ending essence removes only unspent bonus HP and preserves damage across successive blocks", async () => {
  const actor = new ShieldActor(); const effect = await manifest(actor);
  await actor.applyDamage({damage: 15, shieldBlockRequest: true});
  assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 2);
  await actor.applyDamage({damage: 12, shieldBlockRequest: true});
  assert.equal(actor.shield.system.hp.value, 17); assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 0);
  await cleanup(actor, effect.id); await effect.delete();
  assert.equal(actor.shield.system.hp.value, 17); assert.equal(actor.shield.system.hp.max, 20);
  assert.equal(actor.shield.getFlag(MODULE, "shieldHP"), undefined);
});

test("deleting an essence before cleanup uses source HP instead of its already clamped display", async () => {
  const actor = new ShieldActor(); const effect = await manifest(actor);
  await actor.applyDamage({damage: 15, shieldBlockRequest: true});
  await effect.delete();
  assert.equal(actor.shield.system.hp.value, 20); assert.equal(actor.shield._source.system.hp.value, 22);
  await cleanup(actor, effect.id);
  assert.equal(actor.shield.system.hp.value, 20); assert.equal(actor.shield._source.system.hp.value, 20);
});

test("manifestation on a damaged shield does not repair its preexisting damage", async () => {
  const actor = new ShieldActor({hp: 14}); const effect = await manifest(actor);
  assert.equal(actor.shield.system.hp.value, 24); assert.equal(actor.shield.system.hp.max, 30);
  await cleanup(actor, effect.id); await effect.delete();
  assert.equal(actor.shield.system.hp.value, 14); assert.equal(actor.shield.system.hp.max, 20);
});

test("legacy migration carries over only the unused bonus and never refills on reload", async () => {
  const actor = new ShieldActor();
  const data = makeEffect(power, {level: 8, targetId: "shield"});
  data.system.rules = data.system.rules.filter((r) => r.property !== "hp-max");
  const effect = actor.addItem(data);
  await actor.shield.setFlag(MODULE, "tempHP", {source: effect.id, max: 10, value: 3});
  await migrateShieldHP(actor);
  assert.equal(actor.shield.system.hp.value, 23); assert.equal(actor.shield.system.hp.max, 30);
  assert.equal(actor.shield.getFlag(MODULE, "tempHP"), undefined);
  assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 3);
  await migrateShieldHP(actor);
  assert.equal(actor.shield.system.hp.value, 23); assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 3);
  await cleanup(actor, effect.id); await effect.delete();
  assert.equal(actor.shield.system.hp.value, 20);
});

test("undo from before the update restores migrated shield HP", async () => {
  const actor = new ShieldActor(); const effect = await manifest(actor);
  await actor.shield.update({"system.hp.value": 23});
  const message = {actor, flags: {[MODULE]: {shieldUndo: {shieldId: "shield", source: effect.id, absorbed: 7}}}};
  await onUpdateChat(message, {flags: {pf2e: {appliedDamage: {isReverted: true}}}}, {}, "user");
  assert.equal(actor.shield.system.hp.value, 30); assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 10);
});

for (const total of [4, 5]) test(`English shield check (${total}) preserves block success/failure mechanics`, async () => {
  game.i18n.lang = "en";
  const actor = new ShieldActor(); flaw(actor); const effect = await manifest(actor); totals.push(total);
  await actor.applyDamage({damage: 12, shieldBlockRequest: true});
  assert(effect.name.startsWith("Essence Form: Resolute Defiance"));
  assert.equal(checks.length, 1);
  assert.equal(checks[0].check.label, "Resolute Defiance flaw — DC 5 flat check");
  assert.equal(actor.system.attributes.hp.value, total < 5 ? 88 : 95);
  assert.equal(actor.shield.system.hp.value, total < 5 ? 30 : 25);
  assert.equal(actor.shield.system.equipped.carryType, total < 5 ? "dropped" : "held");
});

test("changing generated text to English and rerunning shield migration never refills spent bonus HP", async () => {
  const actor = new ShieldActor(); const effect = await manifest(actor);
  await actor.applyDamage({damage: 15, shieldBlockRequest: true});
  actor.updateEmbeddedDocuments = async (_type, updates, options) => {
    for (const {_id, ...changes} of updates) await actor.items.get(_id).update(changes, options);
  };
  game.i18n.lang = "en";
  await migrateActorTexts(actor); await migrateShieldHP(actor);
  assert(effect.name.startsWith("Essence Form: Resolute Defiance"));
  assert.equal(actor.shield.system.hp.value, 22); assert.equal(actor.shield.system.hp.max, 30);
  assert.equal(actor.shield.getFlag(MODULE, "shieldHP").value, 2);
  assert.equal(actor.system.attributes.hp.value, 92);
});
