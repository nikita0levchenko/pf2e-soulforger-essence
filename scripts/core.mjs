/** Pure data and rule builders. Does not depend on Foundry globals. */
import {ESSENCE_ICON, CORRUPTION_ICON, STASIS_ICON, IMMOBILIZED_ICON, powerIcon} from "./icons.mjs";
export const MODULE = "soulforger-essence";
export const VERSION = "1.2.1";
export const ICON = ESSENCE_ICON;
export const IDS = Object.freeze({
  feat: "SEssenceFeat0001", flaw: "SEssenceFlaw0001",
  essenceCarrier: "SEssenceGate0001", flawCarrier: "SCorruptGate0001"
});
export const DAMAGE_TYPES = Object.freeze({
  acid: "Кислота", cold: "Холод", electricity: "Электричество", fire: "Огонь",
  sonic: "Звук", spirit: "Духовный / Spirit", vitality: "Жизненная сила / Vitality", void: "Пустота / Void"
});
export const CONDITIONS = ["clumsy", "drained", "enfeebled", "frightened", "sickened", "stupefied"];
export const SPELLS = Object.freeze({
  "harmful-malice": {uuid: "Compendium.pf2e.spells-srd.Item.wdA52JJnsuQWeyqz", name: "Нанесение ран / Harm"},
  "healing-grace": {uuid: "Compendium.pf2e.spells-srd.Item.rfZpqmj0AIIdkVIs", name: "Исцеление / Heal"},
  "magical-resilience": {uuid: "Compendium.pf2e.spells-srd.Item.9HpwDN4MYQJnW0LG", name: "Рассеять магию / Dispel Magic", minLevel: 5}
});
export const POWERS = Object.freeze([
  {id: "adaptable-persona", ru: "Адаптирующая личность", en: "Adaptable Persona", equipment: "armor",
    benefit: "Скорость карабканья или плавания равна наземной. С 8-го уровня можно выбрать полёт.",
    flaw: "Штраф −10 футов ко всем Скоростям."},
  {id: "bounding-spirit", ru: "Связывающий дух", en: "Bounding Spirit", equipment: "melee",
    benefit: "Выбранное оружие ближнего боя получает метательное 30 футов и возвращающуюся руну сверх лимита рун.",
    flaw: "Промах дистанционным или метательным оружием требует нового Удара по союзнику, ближайшему к исходной цели. Прежний MAP; этот Удар не увеличивает MAP."},
  {id: "deep-seated-fear", ru: "Укоренившийся страх", en: "Deep-Seated Fear", equipment: null,
    benefit: "Статусный бонус +2 к Запугиванию. Нет языкового штрафа к Demoralize против воспринимающей эссенцию цели. При проявлении можно Деморализовать как часть действия.",
    flaw: "Попытка Деморализовать врага дополнительно затрагивает ближайшего к тебе союзника."},
  {id: "determined-toughness", ru: "Решительная выносливость", en: "Determined Toughness", equipment: null,
    benefit: "Статусные штрафы от clumsy, drained, enfeebled, frightened, sickened и stupefied ослаблены на 1. Значения состояний и прочие последствия сохраняются.",
    flaw: "Значение вызывающего статусный штраф состояния из перечисленных увеличивается на 1."},
  {id: "harmful-malice", ru: "Вредящая злость", en: "Harmful Malice", equipment: null,
    benefit: "Все твои Удары наносят дополнительные 1d4 void. Доступно одно врождённое Harm ранга ceil(уровень / 2).",
    flaw: "Любой наносимый тобой урон уменьшается на floor(уровень / 2)."},
  {id: "heroic-heart", ru: "Героическое сердце", en: "Heroic Heart", equipment: null,
    benefit: "Статусный бонус +1 к атакам, Восприятию, спасброскам и проверкам навыков.",
    flaw: "Статусный штраф −1 к атакам."},
  {id: "healing-grace", ru: "Исцеляющая благодать", en: "Healing Grace", equipment: null,
    benefit: "Быстрое исцеление floor(уровень / 2). Доступно одно врождённое Heal ранга ceil(уровень / 2).",
    flaw: "Получаемое исцеление и исцеление, предоставляемое заклинанием, уменьшаются на floor(уровень / 2)."},
  {id: "magical-resilience", ru: "Магическая стойкость", en: "Magical Resilience", equipment: "armor-shield",
    benefit: "Статусный бонус +2 к КБ и спасброскам против заклинаний. С 5-го уровня — одно врождённое Dispel Magic ранга ceil(уровень / 2) − 1.",
    flaw: "Статусный штраф −1 к КБ и спасброскам против заклинаний."},
  {id: "planar-bond", ru: "Планарная связь", en: "Planar Bond", equipment: "armor-shield",
    benefit: "Сопротивление выбранному типу урона, равное уровню + 2.",
    flaw: "Слабость 1 ко всему урону."},
  {id: "planar-pain", ru: "Планарная боль", en: "Planar Pain", equipment: "weapon",
    benefit: "Физический урон выбранного оружия заменён выбранным типом; статусный бонус +2 к урону этого оружия.",
    flaw: "Нанося урон оружием или безоружной атакой, получаешь 2 урона последнего выбранного типа, даже если он обычно тебе не вредит."},
  {id: "pull-of-stasis", ru: "Притяжение стазиса", en: "Pull of Stasis", equipment: "weapon",
    benefit: "Попадание выбранным оружием: −10 футов ко всем Скоростям цели на 1 раунд. Критическое попадание: immobilized на 1 раунд вместо штрафа.",
    flaw: "Штраф −10 футов ко всем Скоростям."},
  {id: "reflecting-spirit", ru: "Отражающий дух", en: "Reflecting Spirit", equipment: "armor-shield",
    benefit: "Статусный бонус +2 к КБ против физических дистанционных атак. Реакция после промаха: отражённый урон того же типа, равный половине Твёрдости твоего щита.",
    flaw: "Слабость 5 к физическим дистанционным атакам."},
  {id: "resolute-defiance", ru: "Решительное неповиновение", en: "Resolute Defiance", equipment: "shield",
    benefit: "Щит получает +2 к Твёрдости и временные HP, равные уровню + 2. Предоставляется Shield Block, если его нет.",
    flaw: "Получив урон с поднятым щитом или использовав Shield Block, выполни flat check DC 5. При провале связанный щит убирается, другой щит падает."}
]);
export const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g,
  (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
export const powerById = (id) => POWERS.find((p) => p.id === id);
export const powerLabel = (p) => `${p.ru} / ${p.en}`;
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
          value: true, label: "Цель воспринимает форму эссенции"},
        {key: "AdjustModifier", selectors: ["intimidation"], slug: config.unintelligibleSlug ?? "unintelligible", suppress: true,
          predicate: ["soulforger:target-perceives-essence"]},
        note("intimidation", "Нет языкового штрафа, если цель воспринимает эссенцию. Остальные условия Demoralize сохраняются.")); break;
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
        text: "Притяжение стазиса: попадание — −10 футов ко всем Скоростям на 1 раунд; критическое попадание — immobilized на 1 раунд. Применить эффект можно кнопкой в карточке срабатывания."}); break;
    case "reflecting-spirit":
      rules.push(fm("ac", 2, "status", physicalRanged), note("ac", power.benefit)); break;
    case "resolute-defiance":
      rules.push({key: "ItemAlteration", itemId: id, mode: "add", property: "hardness", value: 2});
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
        definition: ["damage:category:physical", "item:ranged"], label: "Физические дистанционные атаки"}); break;
  }
  rules.push(note(power.id === "deep-seated-fear" ? "intimidation" :
    power.id === "resolute-defiance" ? "damage-received" : "attack-roll", escapeHTML(power.flaw)));
  return rules;
}
export function makeEffect(power, config = {}, {corruption = false, worldTime = 0, initiative = null} = {}) {
  const target = config.targetName ? ` — ${config.targetName}` : "";
  const title = `${corruption ? "Изъян порока" : "Форма эссенции"}: ${powerLabel(power)}${target}`;
  const text = corruption ? power.flaw : power.benefit;
  const details = [config.targetName && `Предмет: ${config.targetName}`,
    config.damageType && `Тип урона: ${DAMAGE_TYPES[config.damageType]}`,
    config.movement && `Скорость: ${{climb: "карабканье", swim: "плавание", fly: "полёт"}[config.movement]}`].filter(Boolean);
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
    flags: {[MODULE]: {kind: corruption ? "corruption" : "essence", power: power.id, config, version: VERSION,
      ...(corruption ? {} : {expiresAt: worldTime + 60})}}
  };
  return effect;
}
export function stasisEffect(critical, worldTime, initiative) {
  return {name: critical ? "Притяжение стазиса: обездвижен" : "Притяжение стазиса: замедление", type: "effect", img: critical ? IMMOBILIZED_ICON : STASIS_ICON,
    system: {slug: "soulforger-stasis-target", description: {value: `<p>${critical ? "Обездвижен" : "−10 футов ко всем Скоростям"} на 1 раунд.</p>`},
      duration: {value: 1, unit: "rounds", expiry: "turn-start", sustained: false}, start: {value: worldTime, initiative},
      rules: critical ? [{key: "GrantItem", uuid: "Compendium.pf2e.conditionitems.Item.eIcWbB5o3pP6OIMe",
        inMemoryOnly: true}] : allSpeeds(-10), traits: {value: ["divine"]}},
    flags: {[MODULE]: {kind: "stasis", critical, version: VERSION}}};
}
export function absorbShieldTemp(currentHP, nextHP, temporaryHP) {
  const damage = Math.max(0, currentHP - nextHP);
  const absorbed = Math.min(damage, Math.max(0, temporaryHP));
  return {hp: Math.max(0, Math.min(currentHP, nextHP + absorbed)), temp: Math.max(0, temporaryHP - absorbed), absorbed};
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
  const common = {img: ICON, ownership: {default: 2}, effects: [], flags: {[MODULE]: {asset: true, version: VERSION}}};
  const carrier = (id, route) => ({...structuredClone(common), _id: id, img: route === "corruption" ? CORRUPTION_ICON : ESSENCE_ICON,
    name: `Soulforger: служебный эффект (${route})`, type: "effect",
    system: {description: {value: "<p>Служебный эффект. При его применении модуль открывает выбор эссенции.</p>"},
      duration: {value: -1, unit: "unlimited", expiry: null}, rules: [], traits: {value: []}},
    flags: {[MODULE]: {asset: true, version: VERSION, route}}});
  const base = {actionType: {value: "free"}, actions: {value: null}, traits: {value: ["divine"], rarity: "common"},
    description: {value: ""}, rules: []};
  return [carrier(IDS.essenceCarrier, "manifest"), carrier(IDS.flawCarrier, "corruption"),
    {...structuredClone(common), _id: IDS.flaw, img: CORRUPTION_ICON, name: "Применить изъян порока", type: "action",
      system: {...structuredClone(base), category: null, slug: "soulforger-apply-corruption",
        description: {value: "<p><strong>Свободное действие.</strong> Нажми «Использовать», выбери изъян силы эссенции. Изъян действует без ограничения времени до удаления эффекта. Дневной лимит формы эссенции не расходуется.</p>"},
        selfEffect: {name: "Выбрать изъян порока", uuid: `Item.${IDS.flawCarrier}`}},
      flags: {[MODULE]: {asset: true, version: VERSION, action: "corruption"}}},
    {...structuredClone(common), _id: IDS.feat, name: "Проявить форму эссенции", type: "feat",
      system: {...structuredClone(base), category: "class", level: {value: 2}, slug: "soulforger-manifest-essence",
        frequency: {max: 1, per: "day"}, prerequisites: {value: []}, maxTakable: 1,
        traits: {value: ["concentrate", "divine", "extradimensional"], rarity: "common"},
        description: {value: "<p><strong>Свободное действие. Частота:</strong> 1 раз в день.</p><p>Нажми «Использовать», выбери силу эссенции, затем подходящий предмет, если это нужно. Эффект действует 1 минуту. Отмена любого окна сохраняет использование.</p><p>Эта способность также предоставляет свободное действие <strong>«Применить изъян порока»</strong>.</p><p>В этой пользовательской версии силу можно выбирать при каждом использовании; действие имеет запрошенную свободную стоимость.</p>"},
        rules: [{key: "GrantItem", uuid: `Item.${IDS.flaw}`, flag: "soulforgerCorruption", allowDuplicate: false,
          nestUnderGranter: false, onDeleteActions: {granter: "cascade", grantee: "detach"}}],
        selfEffect: {name: "Выбрать силу эссенции", uuid: `Item.${IDS.essenceCarrier}`}},
      flags: {[MODULE]: {asset: true, version: VERSION, action: "manifest"}}}
  ];
}
