import {test, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {MODULE} from "../scripts/core.mjs";
import {onChat} from "../scripts/main.mjs";

let documents, applications, cards, sockets, serial = 0;
beforeEach(() => {
  documents = new Map(); applications = []; cards = []; sockets = [];
  globalThis.game = {user: {id: "user"}, users: {activeGM: {id: "gm"}},
    i18n: {lang: "en", localize: (key) => key},
    socket: {emit: (...args) => sockets.push(args)}};
  globalThis.fromUuid = async (uuid) => documents.get(uuid) ?? null;
  globalThis.CONFIG = {Dice: {rolls: [class DamageRoll {
    constructor(formula) {this.formula = formula; this.total = 2;}
    async evaluate() {return this;}
  }]}};
  globalThis.ChatMessage = {getSpeaker: ({actor}) => ({actor: actor.id}),
    create: async (data) => {cards.push(data); return data;}};
  globalThis.ui = {notifications: {warn: (text) => assert.fail(text)}};
});

function actor({flaw = true, owner = true, uuid, lastType, type = "electricity"} = {}) {
  const id = `actor${++serial}`, items = new Map();
  Object.defineProperty(items, "contents", {get: () => [...items.values()]});
  const source = {id, uuid: uuid ?? `Actor.${id}`, documentName: "Actor", isOwner: owner, items,
    system: {attributes: {hp: {value: 100}}},
    getFlag: (scope, key) => scope === MODULE && key === "lastPlanarPain" ? lastType : undefined,
    getContextualClone: (options) => {
      assert.deepEqual(options, []);
      const clone = Object.create(source);
      clone.isAffectedBy = (type) => !["vitality", "void"].includes(type);
      clone.applyDamage = async (request) => {
        applications.push({actor: source, context: clone, ...request});
        source.system.attributes.hp.value -= request.damage.total;
      };
      return clone;
    }};
  source.token = {object: {document: {actor: source, uuid: `Scene.scene.Token.${id}`}}};
  if (flaw) items.set("flaw", {id: "flaw", type: "effect", actor: source,
    system: {}, flags: {[MODULE]: {kind: "corruption", power: "planar-pain", config: {damageType: type}}}});
  documents.set(source.uuid, source);
  return source;
}

// PF2e 8.6.1 ItemPF2e.getOriginData() identifies a synthetic unarmed Strike as
// a weapon even when its UUID is missing from actor.items or belongs to a feat.
// ActorPF2e.applyDamage() keeps this origin but makes the defender the speaker.
function damageTaken(attacker, {target = actor({flaw: false}), item = null,
  itemId = "xxPF2ExUNARMEDxx", type = "weapon", origin = true} = {}) {
  return {id: `message${++serial}`, actor: target, item, flags: {pf2e: {
    context: {type: "damage-taken", domains: ["damage-received"],
      options: ["item:category:unarmed", "item:trait:unarmed"]},
    origin: origin ? {actor: attacker.uuid, uuid: `${attacker.uuid}.Item.${itemId}`, type,
      rollOptions: ["origin:item:category:unarmed", "origin:item:trait:unarmed"]} : undefined,
    appliedDamage: {uuid: target.uuid, isHealing: false, shield: null,
      updates: [{path: "system.attributes.hp.value", value: 9}]}
  }}};
}
const apply = (message) => onChat(message, {}, game.user.id);

for (const itemId of ["xxPF2ExUNARMEDxx", "xxxxxxFISTxxxxxx"])
  test(`Planar Pain triggers after synthetic unarmed damage (${itemId})`, async () => {
    const attacker = actor(), message = damageTaken(attacker, {itemId});
    await apply(message);
    assert.equal(attacker.system.attributes.hp.value, 98);
    assert.equal(message.actor.system.attributes.hp.value, 100);
    assert.equal(applications.length, 1);
    assert.equal(applications[0].damage.formula, "{2[electricity]}");
    assert.equal(applications[0].token.actor, attacker);
    assert.equal(applications[0].item, attacker.items.get("flaw"));
    assert.equal(cards.length, 1);
  });

test("Planar Pain uses the attack origin when an unarmed UUID resolves to its granting feat", async () => {
  const attacker = actor(), feat = {id: "claws", type: "feat", actor: attacker};
  await apply(damageTaken(attacker, {itemId: feat.id, item: feat}));
  assert.equal(applications.length, 1);
  assert.equal(applications[0].actor, attacker);
});

test("Planar Pain never mistakes the defender's synthetic Fist for the attacker", async () => {
  const attacker = actor(), defender = actor();
  const defenderFist = {id: "xxxxxxFISTxxxxxx", type: "weapon", actor: defender};
  await apply(damageTaken(attacker, {target: defender, itemId: defenderFist.id, item: defenderFist}));
  assert.equal(attacker.system.attributes.hp.value, 98);
  assert.equal(defender.system.attributes.hp.value, 100);
});

test("Planar Pain still triggers after damage with an ordinary weapon", async () => {
  const attacker = actor(), sword = {id: "sword", type: "weapon", actor: attacker};
  await apply(damageTaken(attacker, {itemId: sword.id, item: sword}));
  assert.equal(applications.length, 1);
  assert.equal(applications[0].actor, attacker);
});

test("Planar Pain supports NPC melee attacks on an unlinked token actor", async () => {
  const attacker = actor({uuid: "Scene.scene.Token.npcToken.Actor.npc"});
  await apply(damageTaken(attacker, {type: "melee", itemId: "jaws"}));
  assert.equal(applications.length, 1);
  assert.equal(applications[0].actor, attacker);
});

test("Planar Pain preserves item-based handling for messages without an origin", async () => {
  const attacker = actor(), item = {id: "sword", type: "weapon", actor: attacker};
  await apply(damageTaken(attacker, {item, origin: false}));
  assert.equal(applications.length, 1);
  assert.equal(applications[0].actor, attacker);
});

test("Planar Pain does not fall back to the defender when the source actor is unavailable", async () => {
  const attacker = actor(), defender = actor();
  const message = damageTaken(attacker, {target: defender, item: {type: "weapon", actor: defender}});
  documents.delete(attacker.uuid);
  await apply(message);
  assert.equal(applications.length, 0);
});

for (const [label, alter] of [
  ["an unapplied damage roll", (m) => m.flags.pf2e.context.type = "damage-roll"],
  ["healing", (m) => m.flags.pf2e.appliedDamage.isHealing = true],
  ["fully prevented damage", (m) => m.flags.pf2e.appliedDamage.updates = []],
  ["spell damage", (m) => m.flags.pf2e.origin.type = "spell"],
  ["persistent condition damage", (m) => m.flags.pf2e.origin.type = "condition"],
  ["the flaw's own damage", (m) => m.flags.pf2e.origin.type = "effect"]
]) test(`Planar Pain does not trigger for ${label}`, async () => {
  const attacker = actor(), message = damageTaken(attacker, {item: {type: "weapon", actor: attacker}});
  alter(message);
  await apply(message);
  assert.equal(applications.length, 0);
});

test("Planar Pain triggers if only the blocking shield takes damage", async () => {
  const attacker = actor(), message = damageTaken(attacker);
  message.flags.pf2e.appliedDamage.updates = [];
  message.flags.pf2e.appliedDamage.shield = {id: "shield", damage: 3};
  await apply(message);
  assert.equal(applications.length, 1);
});

test("Planar Pain requires an active flaw on the attacker", async () => {
  for (const expired of ["missing", "isExpired", "system.expired"]) {
    const attacker = actor({flaw: expired !== "missing"});
    if (expired === "isExpired") attacker.items.get("flaw").isExpired = true;
    if (expired === "system.expired") attacker.items.get("flaw").system.expired = true;
    await apply(damageTaken(attacker, {target: actor()}));
  }
  assert.equal(applications.length, 0);
});

for (const lastType of ["vitality", "void"])
  test(`Planar Pain keeps the last selected type (${lastType}) and overrides innate non-applicability`, async () => {
    const attacker = actor({lastType});
    await apply(damageTaken(attacker));
    assert.equal(applications.length, 1);
    assert.equal(applications[0].damage.formula, `{2[${lastType}]}`);
    assert.equal(applications[0].context.isAffectedBy(lastType), true);
    assert.equal(applications[0].context.isAffectedBy("fire"), true);
    assert.equal(applications[0].context.isAffectedBy(lastType === "void" ? "vitality" : "void"), false);
    assert.equal(applications[0].skipIWR, undefined);
  });

test("Planar Pain applies once per damage application, including concurrent duplicate hooks", async () => {
  const attacker = actor(), message = damageTaken(attacker);
  await Promise.all([apply(message), apply(message)]);
  await apply(message);
  assert.equal(applications.length, 1);
});

test("Planar Pain processes separate damage applications to different targets", async () => {
  const attacker = actor();
  await apply(damageTaken(attacker));
  await apply(damageTaken(attacker));
  assert.equal(applications.length, 2);
  assert.equal(attacker.system.attributes.hp.value, 96);
});

test("Planar Pain forwards an unowned unarmed attacker to the active GM", async () => {
  const attacker = actor({owner: false}), message = damageTaken(attacker);
  await apply(message);
  assert.equal(applications.length, 0);
  assert.deepEqual(sockets, [[`module.${MODULE}`, {type: "pain", messageId: message.id}]]);
  // Ownership changes on the GM client; forwarding must not mark the request handled.
  attacker.isOwner = true;
  await apply(message);
  assert.equal(applications.length, 1);
});
