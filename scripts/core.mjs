/** Pure data and rule builders. Does not depend on Foundry globals. */
import {t, language, translate} from "./i18n.mjs";
import {ESSENCE_ICON, CORRUPTION_ICON, STASIS_ICON, IMMOBILIZED_ICON, powerIcon} from "./icons.mjs";
export const MODULE = "soulforger-essence";
export const VERSION = "1.3.1";
export const ICON = ESSENCE_ICON;
export const IDS = Object.freeze({
  feat: "SEssenceFeat0001", flaw: "SEssenceFlaw0001",
  essenceCarrier: "SEssenceGate0001", flawCarrier: "SCorruptGate0001"
});
export const DAMAGE_TYPES = Object.freeze({
  get acid() {return t("Damage.acid");},
  get cold() {return t("Damage.cold");},
  get electricity() {return t("Damage.electricity");},
  get fire() {return t("Damage.fire");},
  get sonic() {return t("Damage.sonic");},
  get spirit() {return t("Damage.spirit");},
  get vitality() {return t("Damage.vitality");},
  get void() {return t("Damage.void");}
});
export const CONDITIONS = ["clumsy", "drained", "enfeebled", "frightened", "sickened", "stupefied"];
export const SPELLS = Object.freeze({
  "harmful-malice": {uuid: "Compendium.pf2e.spells-srd.Item.wdA52JJnsuQWeyqz", get name() {return t("Spells.harmful-malice");}},
  "healing-grace": {uuid: "Compendium.pf2e.spells-srd.Item.rfZpqmj0AIIdkVIs", get name() {return t("Spells.healing-grace");}},
  "magical-resilience": {uuid: "Compendium.pf2e.spells-srd.Item.9HpwDN4MYQJnW0LG", get name() {return t("Spells.magical-resilience");}, minLevel: 5}
});
export const POWERS = Object.freeze([
  {id: "adaptable-persona", equipment: "armor",
    get ru() {return translate("ru", "Powers.adaptable-persona.Name");},
    get en() {return translate("en", "Powers.adaptable-persona.Name");},
    get benefit() {return t("Powers.adaptable-persona.Benefit");},
    get flaw() {return t("Powers.adaptable-persona.Flaw");}},
  {id: "bounding-spirit", equipment: "melee",
    get ru() {return translate("ru", "Powers.bounding-spirit.Name");},
    get en() {return translate("en", "Powers.bounding-spirit.Name");},
    get benefit() {return t("Powers.bounding-spirit.Benefit");},
    get flaw() {return t("Powers.bounding-spirit.Flaw");}},
  {id: "deep-seated-fear", equipment: null,
    get ru() {return translate("ru", "Powers.deep-seated-fear.Name");},
    get en() {return translate("en", "Powers.deep-seated-fear.Name");},
    get benefit() {return t("Powers.deep-seated-fear.Benefit");},
    get flaw() {return t("Powers.deep-seated-fear.Flaw");}},
  {id: "determined-toughness", equipment: null,
    get ru() {return translate("ru", "Powers.determined-toughness.Name");},
    get en() {return translate("en", "Powers.determined-toughness.Name");},
    get benefit() {return t("Powers.determined-toughness.Benefit");},
    get flaw() {return t("Powers.determined-toughness.Flaw");}},
  {id: "harmful-malice", equipment: null,
    get ru() {return translate("ru", "Powers.harmful-malice.Name");},
    get en() {return translate("en", "Powers.harmful-malice.Name");},
    get benefit() {return t("Powers.harmful-malice.Benefit");},
    get flaw() {return t("Powers.harmful-malice.Flaw");}},
  {id: "heroic-heart", equipment: null,
    get ru() {return translate("ru", "Powers.heroic-heart.Name");},
    get en() {return translate("en", "Powers.heroic-heart.Name");},
    get benefit() {return t("Powers.heroic-heart.Benefit");},
    get flaw() {return t("Powers.heroic-heart.Flaw");}},
  {id: "healing-grace", equipment: null,
    get ru() {return translate("ru", "Powers.healing-grace.Name");},
    get en() {return translate("en", "Powers.healing-grace.Name");},
    get benefit() {return t("Powers.healing-grace.Benefit");},
    get flaw() {return t("Powers.healing-grace.Flaw");}},
  {id: "magical-resilience", equipment: "armor-shield",
    get ru() {return translate("ru", "Powers.magical-resilience.Name");},
    get en() {return translate("en", "Powers.magical-resilience.Name");},
    get benefit() {return t("Powers.magical-resilience.Benefit");},
    get flaw() {return t("Powers.magical-resilience.Flaw");}},
  {id: "planar-bond", equipment: "armor-shield",
    get ru() {return translate("ru", "Powers.planar-bond.Name");},
    get en() {return translate("en", "Powers.planar-bond.Name");},
    get benefit() {return t("Powers.planar-bond.Benefit");},
    get flaw() {return t("Powers.planar-bond.Flaw");}},
  {id: "planar-pain", equipment: "weapon",
    get ru() {return translate("ru", "Powers.planar-pain.Name");},
    get en() {return translate("en", "Powers.planar-pain.Name");},
    get benefit() {return t("Powers.planar-pain.Benefit");},
    get flaw() {return t("Powers.planar-pain.Flaw");}},
  {id: "pull-of-stasis", equipment: "weapon",
    get ru() {return translate("ru", "Powers.pull-of-stasis.Name");},
    get en() {return translate("en", "Powers.pull-of-stasis.Name");},
    get benefit() {return t("Powers.pull-of-stasis.Benefit");},
    get flaw() {return t("Powers.pull-of-stasis.Flaw");}},
  {id: "reflecting-spirit", equipment: "armor-shield",
    get ru() {return translate("ru", "Powers.reflecting-spirit.Name");},
    get en() {return translate("en", "Powers.reflecting-spirit.Name");},
    get benefit() {return t("Powers.reflecting-spirit.Benefit");},
    get flaw() {return t("Powers.reflecting-spirit.Flaw");}},
  {id: "resolute-defiance", equipment: "shield",
    get ru() {return translate("ru", "Powers.resolute-defiance.Name");},
    get en() {return translate("en", "Powers.resolute-defiance.Name");},
    get benefit() {return t("Powers.resolute-defiance.Benefit");},
    get flaw() {return t("Powers.resolute-defiance.Flaw");}}
]);
export const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g,
  (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
export const powerById = (id) => POWERS.find((p) => p.id === id);
export const powerName = (p) => p.id ? t(`Powers.${p.id}.Name`) : (language() === "ru" ? p.ru ?? p.en : p.en ?? p.ru);
export const powerLabel = (p) => language() === "ru" ? `${powerName(p)} / ${p.en}` : powerName(p);
export const actorLevel = (actor) => Math.max(1, Number(actor.level ?? actor.system?.details?.level?.value) || 1);
export const isShield = (item) => item.type === "shield" || (item.type === "armor" && item.system?.category === "shield");
export function eligibleItems(items, equipment) {
  return [...items].filter((i) => {
    const weapon = i.type === "weapon" && i.system?.category !== "unarmed";
    const armor = i.type === "armor" && !isShield(i);
    const range = i.system?.range;
    const melee = typeof i.isMelee === "boolean" ? i.isMelee : range == null || range === 0;
    switch (equipment) {
      case "melee": return weapon && melee;
      case "weapon": return weapon;
      case "armor": return armor;
      case "shield": return isShield(i);
      case "armor-shield": return armor || isShield(i);
      default: return false;
    }
  });
}
const spellPredicate = [{or: ["item:type:spell", "item:from-spell"]}];
const physicalRanged = ["item:ranged", "item:damage:category:physical"];
const fm = (selector, value, type = "untyped", predicate = []) =>
  ({key: "FlatModifier", selector: Array.isArray(selector) ? selector : [selector], value, type, ...(predicate.length ? {predicate} : {})});
const note = (selector, text) => ({key: "Note", selector, text});
const allSpeeds = (value) => [fm("speed", value)];

export function essenceRules(power, config = {}) {
  const id = config.targetId;
  const definition = [`item:id:${id}`];
  const rules = [{key: "RollOption", domain: "all", option: `soulforger:essence:${power.id}`}];
  switch (power.id) {
    case "adaptable-persona":
      rules.push({key: "BaseSpeed", selector: config.movement, value: config.landSpeedFormula ?? config.landSpeed ?? 25}); break;
    case "bounding-spirit":
      rules.push({key: "AdjustStrike", definition, mode: "add", property: "weapon-traits", value: "thrown-30"},
        {key: "AdjustStrike", definition, mode: "add", property: "property-runes", value: "returning"}); break;
    case "deep-seated-fear":
      rules.push(fm("intimidation", 2, "status"),
        {key: "RollOption", domain: "intimidation", option: "soulforger:target-perceives-essence", toggleable: true,
          value: true, label: t("Rule.TargetPerceives")},
        {key: "AdjustModifier", selectors: ["intimidation"], slug: config.unintelligibleSlug ?? "unintelligible", suppress: true,
          predicate: ["soulforger:target-perceives-essence"]},
        note("intimidation", t("Rule.Language"))); break;
    case "determined-toughness":
      rules.push(...CONDITIONS.map((slug) => ({key: "AdjustModifier", selectors: ["all"], slug, mode: "add", value: 1}))); break;
    case "harmful-malice":
      rules.push({key: "DamageDice", selector: "strike-damage", diceNumber: 1, dieSize: "d4", damageType: "void"}); break;
    case "heroic-heart":
      rules.push(fm(["attack-roll", "perception", "saving-throw", "skill-check"], 1, "status")); break;
    case "healing-grace":
      rules.push({key: "FastHealing", type: "fast-healing", value: "floor(@actor.level/2)"}); break;
    case "magical-resilience":
      rules.push(fm(["ac", "saving-throw"], 2, "status", spellPredicate)); break;
    case "planar-bond":
      rules.push({key: "Resistance", type: [config.damageType], value: "@actor.level + 2"}); break;
    case "planar-pain":
      rules.push({key: "ItemAlteration", itemId: id, mode: "override", property: "damage-type", value: config.damageType},
        {key: "DamageAlteration", selectors: [`${id}-damage`], mode: "override", property: "damage-type",
        predicate: ["damage:category:physical"], value: config.damageType},
        fm(`${id}-damage`, 2, "status")); break;
    case "pull-of-stasis":
      rules.push({key: "Note", selector: `${id}-attack`, outcome: ["success", "criticalSuccess"],
        text: t("Rule.Stasis")}); break;
    case "reflecting-spirit":
      rules.push(fm("ac", 2, "status", physicalRanged), note("ac", power.benefit)); break;
    case "resolute-defiance":
      rules.push({key: "ItemAlteration", itemId: id, mode: "add", property: "hardness", value: 2},
        {key: "ItemAlteration", itemId: id, mode: "add", property: "hp-max", value: (config.level ?? 1) + 2});
      if (!config.hasShieldBlock) rules.push({key: "GrantItem", flag: "soulforgerShieldBlock",
        uuid: "Compendium.pf2e.feats-srd.Item.jM72TjJ965jocBV8", allowDuplicate: false,
        onDeleteActions: {granter: "cascade"}});
      break;
  }
  return rules;
}
export function corruptionRules(power) {
  const rules = [{key: "RollOption", domain: "all", option: `soulforger:corruption:${power.id}`}];
  switch (power.id) {
    case "adaptable-persona": case "pull-of-stasis": rules.push(...allSpeeds(-10)); break;
    case "harmful-malice": rules.push(fm("damage", "-floor(@actor.level/2)")); break;
    case "heroic-heart": rules.push(fm("attack-roll", -1, "status")); break;
    case "healing-grace":
      rules.push(fm("healing-received", "-floor(@actor.level/2)"), fm("healing", "-floor(@actor.level/2)", "untyped", ["item:type:spell"])); break;
    case "magical-resilience": rules.push(fm(["ac", "saving-throw"], -1, "status", spellPredicate)); break;
    case "planar-bond": rules.push({key: "Weakness", type: ["all-damage"], value: 1}); break;
    case "reflecting-spirit":
      rules.push({key: "Weakness", type: ["custom"], value: 5,
        definition: ["damage:category:physical", "item:ranged"], label: t("Rule.PhysicalRanged")}); break;
  }
  rules.push(note(power.id === "deep-seated-fear" ? "intimidation" :
    power.id === "resolute-defiance" ? "damage-received" : "attack-roll", escapeHTML(power.flaw)));
  return rules;
}
export function makeEffect(power, config = {}, {corruption = false, worldTime = 0, initiative = null} = {}) {
  const target = config.targetName ? ` — ${config.targetName}` : "";
  const title = `${corruption ? t("Effect.Corruption") : t("Effect.Essence")}: ${powerLabel(power)}${target}`;
  const text = corruption ? power.flaw : power.benefit;
  const details = [config.targetName && t("Effect.Item", {name: config.targetName}),
    config.damageType && t("Effect.Damage", {type: DAMAGE_TYPES[config.damageType]}),
    config.movement && t("Effect.Speed", {speed: t(`MovementDetail.${config.movement}`)})].filter(Boolean);
  const effect = {
    name: title, type: "effect", img: powerIcon(power.id, corruption),
    system: {
      slug: `soulforger-${corruption ? "corruption" : "essence"}-${power.id}`,
      description: {value: `<p>${escapeHTML(text)}</p>${details.map((s) => `<p>${escapeHTML(s)}</p>`).join("")}`},
      level: {value: config.level ?? 1},
      duration: corruption ? {value: -1, unit: "unlimited", expiry: null, sustained: false}
        : {value: 1, unit: "minutes", expiry: "turn-start", sustained: false},
      start: {value: worldTime, initiative}, tokenIcon: {show: true},
      rules: corruption ? corruptionRules(power) : essenceRules(power, config),
      traits: {value: corruption ? ["curse", "divine"] :
        power.id === "harmful-malice" ? ["divine", "void"] :
        power.id === "healing-grace" ? ["divine", "healing", "vitality"] :
        power.id === "heroic-heart" ? ["divine", "mental"] : ["divine"]}
    },
    flags: {[MODULE]: {kind: corruption ? "corruption" : "essence", power: power.id, config, version: VERSION, language: language(),
      ...(corruption ? {} : {expiresAt: worldTime + 60})}}
  };
  return effect;
}
export function stasisEffect(critical, worldTime, initiative) {
  return {name: t(critical ? "Stasis.ImmobilizedName" : "Stasis.SlowedName"), type: "effect", img: critical ? IMMOBILIZED_ICON : STASIS_ICON,
    system: {slug: "soulforger-stasis-target", description: {value: t(critical ? "Stasis.ImmobilizedDescription" : "Stasis.SlowedDescription")},
      duration: {value: 1, unit: "rounds", expiry: "turn-start", sustained: false}, start: {value: worldTime, initiative},
      rules: critical ? [{key: "GrantItem", uuid: "Compendium.pf2e.conditionitems.Item.eIcWbB5o3pP6OIMe",
        inMemoryOnly: true}] : allSpeeds(-10), traits: {value: ["divine"]}},
    flags: {[MODULE]: {kind: "stasis", critical, version: VERSION, language: language()}}};
}
/** All dialogs complete before mutation. Roll back effects if resource consumption fails. */
export async function activateTransaction({remaining, choose, apply, consume, rollback}) {
  if (remaining !== null && remaining <= 0) return {status: "exhausted"};
  const selection = await choose();
  if (!selection) return {status: "cancelled"};
  let receipt;
  try {
    receipt = await apply(selection);
    if (!receipt) return {status: "unchanged"};
    if (remaining !== null) await consume(remaining - 1);
    return {status: "applied", selection, receipt};
  } catch (error) {
    if (receipt) await rollback(receipt);
    throw error;
  }
}
export function itemTemplates() {
  const common = {img: ICON, ownership: {default: 2}, effects: [], flags: {[MODULE]: {asset: true, version: VERSION, language: language()}}};
  const carrier = (id, route) => ({...structuredClone(common), _id: id, img: route === "corruption" ? CORRUPTION_ICON : ESSENCE_ICON,
    name: t("Item.HelperName", {route}), type: "effect",
    system: {description: {value: t("Item.HelperDescription")},
      duration: {value: -1, unit: "unlimited", expiry: null}, rules: [], traits: {value: []}},
    flags: {[MODULE]: {asset: true, version: VERSION, language: language(), route}}});
  const base = {actionType: {value: "free"}, actions: {value: null}, traits: {value: ["divine"], rarity: "common"},
    description: {value: ""}, rules: []};
  return [carrier(IDS.essenceCarrier, "manifest"), carrier(IDS.flawCarrier, "corruption"),
    {...structuredClone(common), _id: IDS.flaw, img: CORRUPTION_ICON, name: t("Action.Corruption"), type: "action",
      system: {...structuredClone(base), category: null, slug: "soulforger-apply-corruption",
        description: {value: t("Item.CorruptionDescription")},
        selfEffect: {name: t("Action.SelectCorruption"), uuid: `Item.${IDS.flawCarrier}`}},
      flags: {[MODULE]: {asset: true, version: VERSION, language: language(), action: "corruption"}}},
    {...structuredClone(common), _id: IDS.feat, name: t("Action.Manifest"), type: "feat",
      system: {...structuredClone(base), category: "class", level: {value: 2}, slug: "soulforger-manifest-essence",
        frequency: {max: 1, per: "day"}, prerequisites: {value: []}, maxTakable: 1,
        traits: {value: ["concentrate", "divine", "extradimensional"], rarity: "common"},
        description: {value: t("Item.ManifestDescription")},
        rules: [{key: "GrantItem", uuid: `Item.${IDS.flaw}`, flag: "soulforgerCorruption", allowDuplicate: false,
          nestUnderGranter: false, onDeleteActions: {granter: "cascade", grantee: "detach"}}],
        selfEffect: {name: t("Action.SelectEssence"), uuid: `Item.${IDS.essenceCarrier}`}},
      flags: {[MODULE]: {asset: true, version: VERSION, language: language(), action: "manifest"}}}
  ];
}
