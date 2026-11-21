import {
  MODULE, VERSION, IDS, POWERS, SPELLS, CONDITIONS, DAMAGE_TYPES, ICON,
  escapeHTML, powerLabel, powerById, actorLevel, eligibleItems, isShield,
  makeEffect, itemTemplates, stasisEffect, activateTransaction
} from "./core.mjs";
import {powerChoices, renderChoiceContent, bindChoiceDescriptions} from "./choice-ui.mjs";
import {ESSENCE_ICON, CORRUPTION_ICON, STASIS_ICON, IMMOBILIZED_ICON, DEFAULT_ITEM_ICONS, powerIcon} from "./icons.mjs";

const busy = new Set();
const installedRoots = new WeakSet();
const secondaryDemoralize = new Set();
const nativeReservations = new Map();
const shieldDamageContexts = new Map();
const shieldDamageQueue = new Map();
const stasisRequests = new Set();
const painRequests = new Set();
let sweeping = false;
const fu = () => foundry.utils;
const flag = (item) => item?.flags?.[MODULE] ?? {};
const itemsOf = (actor) => actor?.items?.contents ?? [...(actor?.items ?? [])];
const effectActive = (item) => item.type === "effect" && !item.isExpired && !item.system?.expired;
const effectsOf = (actor, kind, power) => itemsOf(actor).filter((i) =>
  effectActive(i) && flag(i).kind === kind && (!power || flag(i).power === power));
const fail = (error) => { console.error(`${MODULE} |`, error); ui.notifications.error(`Soulforger: ${error.message ?? error}`); };
const run = (promise) => Promise.resolve(promise).catch(fail);

async function select(title, choices, message = "") {
  if (!choices.length) { ui.notifications.warn("Нет подходящих вариантов."); return null; }
  const enhanced = choices.some((choice) => choice.description || choice.img);
  const content = renderChoiceContent(title, choices, message);
  let cleanup = () => {};
  return foundry.applications.api.DialogV2.wait({
    window: {title}, content, rejectClose: false,
    ...(enhanced ? {position: {width: 640}, modal: false,
      render: (_event, dialog) => {
        cleanup();
        cleanup = bindChoiceDescriptions(dialog.element, choices, (description) => run(showDescription(description)));
      }} : {}),
    buttons: [
      {action: "choose", label: "Выбрать", default: true,
        callback: (_event, button) => button.form?.elements.namedItem("choice")?.value ?? null},
      {action: "cancel", label: "Отмена", callback: () => null}
    ], close: () => {cleanup(); return null;}
  });
}

function showDescription(description) {
  return new foundry.applications.api.DialogV2({
    window: {title: description.title, icon: "fa-solid fa-circle-info"},
    position: {width: 560}, modal: false, content: description.content,
    buttons: [{action: "close", label: "Закрыть", default: true}]
  }).render({force: true});
}

async function collect(actor, corruption) {
  const choice = await select(corruption ? "Применить изъян порока" : "Проявить форму эссенции",
    powerChoices({corruption, level: actorLevel(actor)}));
  const power = powerById(choice);
  if (!power) return null;
  if (effectsOf(actor, corruption ? "corruption" : "essence", power.id).length) {
    ui.notifications.info("Этот эффект уже действует. Второй экземпляр не добавлен."); return null;
  }
  const config = {level: actorLevel(actor)};
  if (!corruption && power.id === "deep-seated-fear") config.unintelligibleSlug =
    game.pf2e.system.sluggify(game.i18n.localize("PF2E.Actions.Demoralize.Unintelligible"));
  if (!corruption && power.id === "resolute-defiance") config.hasShieldBlock =
    itemsOf(actor).some((i) => i.type === "feat" && (i.slug ?? i.system.slug) === "shield-block");
  if (!corruption && power.equipment) {
    const candidates = eligibleItems(itemsOf(actor), power.equipment);
    if (!candidates.length) {
      ui.notifications.warn(`Для силы «${power.ru}» в инвентаре нет подходящего предмета.`); return null;
    }
    const id = await select("Выбери предмет для силы эссенции", candidates.map((i) =>
      ({value: i.id, label: i.name, img: i.img || DEFAULT_ITEM_ICONS[i.type] || ICON})), power.benefit);
    if (!id) return null;
    const target = actor.items.get(id);
    if (!target || !eligibleItems([target], power.equipment).length) throw Error("Выбранный предмет больше недоступен.");
    Object.assign(config, {targetId: target.id, targetName: target.name});
  }
  if (!corruption && power.id === "adaptable-persona") {
    config.movement = await select("Выбери способ передвижения", [
      {value: "climb", label: "Карабканье"}, {value: "swim", label: "Плавание"},
      ...(config.level >= 8 ? [{value: "fly", label: "Полёт"}] : [])
    ]);
    if (!config.movement) return null;
    config.landSpeedFormula = actor.system?.movement?.speeds?.land
      ? "@actor.system.movement.speeds.land.value" : "@actor.system.attributes.speed.total";
  }
  if ((!corruption && ["planar-pain", "planar-bond"].includes(power.id)) || (corruption && power.id === "planar-pain")) {
    config.damageType = corruption ? actor.getFlag(MODULE, "lastPlanarPain") : null;
    if (!config.damageType || !(config.damageType in DAMAGE_TYPES)) {
      config.damageType = await select(corruption ? "Последний тип урона Планарной боли" : "Выбери тип урона",
        Object.entries(DAMAGE_TYPES).map(([value, label]) => ({value, label})));
    }
    if (!config.damageType) return null;
  }
  return {power, config};
}

function effectExpiration(actor) {
  return {worldTime: game.time.worldTime, initiative: actor.combatant?.initiative ?? null};
}
async function addInnate(actor, effect, power, level) {
  const definition = SPELLS[power.id];
  if (!definition || level < (definition.minLevel ?? 1)) return;
  const template = await fromUuid(definition.uuid);
  if (!template || template.type !== "spell") throw Error(`Не найдено системное заклинание ${definition.name}.`);
  const rank = Math.ceil(level / 2) - (power.id === "magical-resilience" ? 1 : 0);
  const [entry] = await actor.createEmbeddedDocuments("Item", [{
    name: `Эссенция: ${power.ru}`, type: "spellcastingEntry", img: ICON,
    system: {ability: {value: "cha"}, tradition: {value: "divine"}, prepared: {value: "innate"},
      proficiency: {value: 1}, showSlotlessLevels: {value: true}, autoHeightenLevel: {value: rank}},
    flags: {[MODULE]: {kind: "temporary-spellcasting", effectId: effect.id}}
  }]);
  if (!entry) throw Error("Не удалось добавить временное врождённое заклинание.");
  const spell = template.toObject();
  delete spell._id; delete spell.folder; delete spell.ownership;
  spell.name = definition.name;
  spell.system.location = {value: entry.id, heightenedLevel: rank, uses: {value: 1, max: 1}};
  spell.flags ??= {}; spell.flags[MODULE] = {kind: "temporary-spell", effectId: effect.id};
  await actor.createEmbeddedDocuments("Item", [spell]);
}

const rawShieldHP = (shield) => Number(shield._source?.system?.hp?.value ?? shield.system.hp.value);

/** The effect owns max HP; current HP must also exist in the shield's persisted source for native Shield Block. */
export async function grantShieldHP(shield, effect, {max = flag(effect).config.level + 2, value = max} = {}) {
  if (shield.getFlag(MODULE, "shieldHP")?.source === effect.id) return;
  await shield.update({
    "system.hp.value": rawShieldHP(shield) + value,
    [`flags.${MODULE}.shieldHP`]: {source: effect.id, max, value},
    [`flags.${MODULE}.-=tempHP`]: null
  }, {soulforger: true, checkHP: false});
}

async function removeShieldHP(shield) {
  const bonus = shield.getFlag(MODULE, "shieldHP");
  if (!bonus) return;
  const effect = shield.actor.items.get(bonus.source);
  const maxRuleStillActive = effectActive(effect ?? {}) && effect.system.rules.some((r) =>
    r.key === "ItemAlteration" && r.property === "hp-max" && r.itemId === shield.id);
  const max = Math.max(0, shield.system.hp.max - (maxRuleStillActive ? bonus.max : 0));
  await shield.update({
    "system.hp.value": Math.max(0, Math.min(max, rawShieldHP(shield) - bonus.value)),
    [`flags.${MODULE}.-=shieldHP`]: null
  }, {soulforger: true, checkHP: false});
}

export async function cleanup(actor, effectId) {
  const children = itemsOf(actor).filter((i) => flag(i).effectId === effectId).map((i) => i.id);
  if (children.length) await actor.deleteEmbeddedDocuments("Item", children);
  for (const shield of itemsOf(actor).filter(isShield)) {
    if (shield.getFlag(MODULE, "shieldHP")?.source === effectId) await removeShieldHP(shield);
    if (shield.getFlag(MODULE, "tempHP")?.source === effectId) await shield.unsetFlag(MODULE, "tempHP");
  }
}

async function applySelection(actor, {power, config}, corruption) {
  const source = makeEffect(power, config, {...effectExpiration(actor), corruption});
  const [effect] = await actor.createEmbeddedDocuments("Item", [source]);
  if (!effect) throw Error("Эффект не создан. Дневное использование сохранено.");
  try {
    if (effect.rules?.some((rule) => rule.invalid)) throw Error("Версия PF2e отклонила правило эффекта. Изменения отменены.");
    if (!corruption) {
      await addInnate(actor, effect, power, config.level);
      if (power.id === "resolute-defiance") {
        const shield = actor.items.get(config.targetId);
        if (!shield) throw Error("Выбранный щит больше недоступен.");
        await grantShieldHP(shield, effect);
      }
    }
    return {effect, actor};
  } catch (error) {
    await cleanup(actor, effect.id);
    if (actor.items.has(effect.id)) await effect.delete();
    throw error;
  }
}

export async function use(actor, item, {reserved = false} = {}) {
  if (!actor?.isOwner) throw Error("Нужны права владельца персонажа.");
  const route = flag(item).action;
  if (!["manifest", "corruption"].includes(route)) return;
  if (busy.has(actor.uuid)) { ui.notifications.info("Выбор эссенции уже открыт."); return; }
  const corruption = route === "corruption";
  const remaining = corruption ? null : (item.system.frequency?.value ?? 1) + (reserved ? 1 : 0);
  busy.add(actor.uuid);
  try {
    const result = await activateTransaction({remaining,
      choose: () => collect(actor, corruption),
      apply: (selection) => applySelection(actor, selection, corruption),
      consume: (value) => item.update({"system.frequency.value": value}, {soulforger: true}),
      rollback: async ({effect}) => {await cleanup(actor, effect.id); if (actor.items.has(effect.id)) await effect.delete();}
    });
    if (result.status === "exhausted") ui.notifications.warn("Форма эссенции уже использована. Лимит восстановится при ежедневной подготовке.");
    if (reserved && result.status !== "applied") await item.update({"system.frequency.value": remaining}, {soulforger: true});
    if (result.status !== "applied") return;
    const {power, config} = result.selection;
    if (!corruption && power.id === "planar-pain") await actor.setFlag(MODULE, "lastPlanarPain", config.damageType);
    if (corruption && power.id === "determined-toughness") await increaseExistingConditions(actor);
    await reportEffect(actor, result.receipt.effect);
  } catch (error) {
    if (reserved) await item.update({"system.frequency.value": remaining}, {soulforger: true});
    throw error;
  } finally { busy.delete(actor.uuid); }
}

function cardButton(action, text, attrs = {}) {
  return `<button type="button" data-soulforger-action="${escapeHTML(action)}" ${Object.entries(attrs).map(([k, v]) =>
    `data-${escapeHTML(k)}="${escapeHTML(v)}"`).join(" ")}>${escapeHTML(text)}</button>`;
}
async function card(actor, text, buttons = [], extraFlags = {}) {
  return ChatMessage.create({speaker: ChatMessage.getSpeaker({actor}),
    content: `<div class="soulforger-essence-card">${text}${buttons.join("")}</div>`,
    flags: {[MODULE]: {actorUuid: actor.uuid, ...extraFlags}}});
}
async function reportEffect(actor, effect) {
  const data = flag(effect), power = powerById(data.power);
  const buttons = [cardButton("dismiss", data.kind === "corruption" ? "Убрать изъян" : "Завершить форму эссенции", {effect: effect.uuid})];
  if (data.kind === "essence" && power.id === "deep-seated-fear") buttons.push(cardButton("demoralize", "Деморализовать при проявлении", {effect: effect.uuid}));
  if (data.kind === "essence" && power.id === "reflecting-spirit") buttons.push(cardButton("reflect", "Реакция: отразить промахнувшийся снаряд", {effect: effect.uuid}));
  if (data.kind === "corruption" && power.id === "resolute-defiance") buttons.push(cardButton("shield-check", "Проверка изъяна щита — КС 5", {effect: effect.uuid}));
  let text = `<p><strong>${escapeHTML(effect.name)}</strong></p>${effect.system.description.value}`;
  if (data.kind === "essence") text += "<p><small>Длительность: 1 минута. Эффект можно завершить кнопкой ниже.</small></p>";
  if (data.kind === "essence" && SPELLS[power.id] && actorLevel(actor) >= (SPELLS[power.id].minLevel ?? 1)) {
    text += "<p>Временное врождённое заклинание с одним использованием добавлено в раздел «Заклинания».</p>";
  }
  if (data.kind === "essence" && power.id === "resolute-defiance") text += `<p>Текущие и максимальные ОЗ выбранного щита увеличены на ${data.config.level + 2} на время эссенции.</p>`;
  await card(actor, text, buttons);
}

function installSheet(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] ?? app.element;
  if (!app.actor || !(root instanceof HTMLElement) || installedRoots.has(root)) return;
  installedRoots.add(root);
  root.addEventListener("click", (event) => {
    const element = event.target.closest?.('[data-action="use-action"]');
    if (!element || !root.contains(element)) return;
    const id = element.closest("[data-item-id]")?.dataset.itemId;
    const item = app.actor.items.get(id);
    if (!flag(item).action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    run(use(app.actor, item));
  }, true);
}

async function provision() {
  if (!game.user.isGM) return;
  const activeGM = game.users.activeGM ?? game.users.find((u) => u.active && u.isGM);
  if (activeGM?.id !== game.user.id) return;
  let folder = game.folders.find((f) => f.type === "Item" && f.getFlag(MODULE, "assets"));
  if (!folder) folder = await Folder.create({name: "Soulforger — форма эссенции", type: "Item", color: "#684a91", flags: {[MODULE]: {assets: true}}});
  for (const source of itemTemplates()) {
    const existing = game.items.get(source._id);
    if (existing && !flag(existing).asset) throw Error(`ID ${source._id} уже занят чужим предметом. Установка остановлена без перезаписи.`);
    if (!existing) await Item.create({...source, folder: folder.id}, {keepId: true});
    else if (flag(existing).version !== VERSION) await existing.update({img: source.img, [`flags.${MODULE}.version`]: VERSION});
  }
  ui.notifications.info("Soulforger: способность «Проявить форму эссенции» доступна в папке предметов «Soulforger — форма эссенции».");
}

function allActors() {
  const list = [...game.actors.contents, ...(canvas?.tokens?.placeables ?? []).map((t) => t.actor).filter(Boolean)];
  return [...new Map(list.map((a) => [a.uuid, a])).values()];
}
function updater(actor) {
  if (actor.primaryUpdater) return actor.primaryUpdater.id === game.user.id;
  const activeGM = game.users.activeGM ?? game.users.find((u) => u.active && u.isGM);
  return activeGM ? activeGM.id === game.user.id : actor.isOwner;
}
export function moduleItemIcon(item) {
  const data = flag(item);
  if (["essence", "corruption"].includes(data.kind) && powerById(data.power)) return powerIcon(data.power, data.kind === "corruption");
  if (data.action === "manifest" || data.route === "manifest") return ESSENCE_ICON;
  if (data.action === "corruption" || data.route === "corruption") return CORRUPTION_ICON;
  if (data.kind === "stasis") {
    const critical = data.critical ?? item.system?.rules?.some((r) => r.key === "GrantItem" && r.uuid?.endsWith("eIcWbB5o3pP6OIMe"));
    return critical ? IMMOBILIZED_ICON : STASIS_ICON;
  }
  return null;
}
export async function migrateActorIcons(actor) {
  const updates = itemsOf(actor).flatMap((item) => {
    const img = moduleItemIcon(item);
    return img && flag(item).version !== VERSION ? [{_id: item.id, img, [`flags.${MODULE}.version`]: VERSION}] : [];
  });
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}
async function migrateIcons() {
  for (const actor of allActors().filter(updater)) await migrateActorIcons(actor);
}

export async function migrateShieldHP(actor) {
  for (const effect of effectsOf(actor, "essence", "resolute-defiance")) {
    const config = flag(effect).config;
    const shield = actor.items.get(config?.targetId);
    if (!shield || !isShield(shield)) continue;
    const legacy = shield.getFlag(MODULE, "tempHP");
    const max = legacy?.source === effect.id ? legacy.max : config.level + 2;
    const rules = effect.system.rules;
    if (!rules.some((r) => r.key === "ItemAlteration" && r.property === "hp-max" && r.itemId === shield.id)) {
      await effect.update({"system.rules": [...rules,
        {key: "ItemAlteration", itemId: shield.id, mode: "add", property: "hp-max", value: max}],
        "system.description.value": makeEffect(powerById("resolute-defiance"), config).system.description.value});
    }
    await grantShieldHP(shield, effect, {max, value: legacy?.source === effect.id ? legacy.value : max});
  }
  for (const effect of effectsOf(actor, "corruption", "resolute-defiance")) {
    const power = powerById("resolute-defiance");
    const description = makeEffect(power, flag(effect).config, {corruption: true}).system.description.value;
    if (effect.system.description.value !== description) await effect.update({"system.description.value": description,
      "system.rules": effect.system.rules.map((r) => r.key === "Note" && r.selector === "damage-received"
        ? {...r, text: escapeHTML(power.flaw)} : r)});
  }
}

async function migrateShields() {
  for (const actor of allActors().filter(updater)) await migrateShieldHP(actor);
}

async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    for (const actor of allActors().filter(updater)) {
      for (const effect of itemsOf(actor).filter((i) => i.type === "effect" && flag(i).kind === "essence")) {
        if (effect.isExpired || effect.system.expired || Number(flag(effect).expiresAt) <= game.time.worldTime) {
          await cleanup(actor, effect.id); await effect.delete();
        }
      }
      const expiredStasis = itemsOf(actor).filter((i) => flag(i).kind === "stasis" && (i.isExpired || i.system.expired)).map((i) => i.id);
      if (expiredStasis.length) await actor.deleteEmbeddedDocuments("Item", expiredStasis);
      const orphanIds = itemsOf(actor).filter((i) => flag(i).effectId && !actor.items.has(flag(i).effectId)).map((i) => i.id);
      if (orphanIds.length) await actor.deleteEmbeddedDocuments("Item", orphanIds);
      for (const shield of itemsOf(actor).filter(isShield)) {
        const bonus = shield.getFlag(MODULE, "shieldHP");
        if (bonus && !effectActive(actor.items.get(bonus.source) ?? {})) await removeShieldHP(shield);
        const temp = shield.getFlag(MODULE, "tempHP");
        if (temp && !actor.items.has(temp.source)) await shield.unsetFlag(MODULE, "tempHP");
      }
    }
  } finally {sweeping = false;}
}

async function increaseExistingConditions(actor) {
  const updates = itemsOf(actor).filter((i) => i.type === "condition" && CONDITIONS.includes(i.slug ?? i.system.slug) &&
    i.system.value?.value > 0).map((i) => ({_id: i.id, "system.value.value": i.system.value.value + 1}));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, {soulforger: true});
}
function preCreateCondition(item) {
  const actor = item.actor ?? item.parent;
  if (item.type !== "condition" || !actor || !effectsOf(actor, "corruption", "determined-toughness").length) return;
  if (!CONDITIONS.includes(item.slug ?? item.system.slug)) return;
  const value = Number(item.system.value?.value);
  if (value > 0) item.updateSource({"system.value.value": value + 1});
}
export function preUpdateItem(item, changes, options) {
  if (options.soulforger) return;
  const actor = item.actor;
  if (!actor) return;
  if (flag(item).action === "manifest") {
    const next = fu().getProperty(changes, "system.frequency.value") ?? changes["system.frequency.value"];
    if (typeof next === "number" && next < item.system.frequency.value) nativeReservations.set(item.uuid, item.system.frequency.value);
  }
  if (item.type === "condition" && effectsOf(actor, "corruption", "determined-toughness").length && CONDITIONS.includes(item.slug ?? item.system.slug)) {
    const next = changes["system.value.value"] ?? fu().getProperty(changes, "system.value.value");
    if (typeof next === "number" && next > item.system.value.value) {
      if ("system.value.value" in changes) changes["system.value.value"] = next + 1;
      else fu().setProperty(changes, "system.value.value", next + 1);
    }
  }
  if (!isShield(item)) return;
  const next = changes["system.hp.value"] ?? fu().getProperty(changes, "system.hp.value");
  const bonus = item.getFlag(MODULE, "shieldHP");
  const effect = bonus && actor.items.get(bonus.source);
  const current = rawShieldHP(item);
  if (typeof next !== "number" || next >= current || !bonus || !effectActive(effect ?? {}) || !bonus.value) return;
  const absorbed = Math.min(bonus.value, current - Math.max(0, next));
  fu().setProperty(changes, `flags.${MODULE}.shieldHP`, {...bonus, value: bonus.value - absorbed});
  const context = shieldDamageContexts.get(actor.uuid);
  if (context?.shieldId === item.id) context.adjustment = {shieldId: item.id, source: bonus.source, absorbed, realHP: true};
}

function currentShield(actor) {
  const id = actor.system?.attributes?.shield?.itemId;
  if (id) {
    const item = actor.items.get(id);
    return item && isShield(item) ? item : null;
  }
  return actor.heldShield ?? itemsOf(actor).find((i) => isShield(i) && i.isEquipped) ?? null;
}

/** Resolve the flaw before PF2e calculates hardness or updates either HP pool. */
export function installDamageCapture(ActorClass) {
  const proto = ActorClass?.prototype;
  if (!proto?.applyDamage || proto[`${MODULE}-capture`]) return false;
  Object.defineProperty(proto, `${MODULE}-capture`, {value: true});
  const apply = proto.applyDamage;
  proto.applyDamage = async function (args) {
    const tokenActor = args.token?.actor;
    const actor = tokenActor && tokenActor.uuid === this.uuid ? tokenActor : this;
    if (!effectsOf(actor, "corruption", "resolute-defiance").length && !currentShield(actor)?.getFlag(MODULE, "shieldHP"))
      return apply.call(this, args);
    const previous = shieldDamageQueue.get(this.uuid) ?? Promise.resolve();
    const task = previous.catch(() => {}).then(async () => {
      const shield = currentShield(actor), data = actor.system?.attributes?.shield;
      const canBlock = shield && data?.raised && !data.broken && !data.destroyed &&
        (!shield.system.equipped || shield.system.equipped.carryType === "held");
      let checked = false, request = args;
      if (args.shieldBlockRequest && !args.final && Number(args.damage?.total ?? args.damage) > 0 &&
          effectsOf(actor, "corruption", "resolute-defiance").length) {
        if (canBlock) {
          checked = true;
          if (!await shieldCheck(actor, shield)) request = {...args, shieldBlockRequest: false};
        } else request = {...args, shieldBlockRequest: false};
      }
      shieldDamageContexts.set(this.uuid, {shieldId: shield?.id, checked});
      try {return await apply.call(this, request);} finally {shieldDamageContexts.delete(this.uuid);}
    });
    shieldDamageQueue.set(this.uuid, task);
    try {return await task;} finally {if (shieldDamageQueue.get(this.uuid) === task) shieldDamageQueue.delete(this.uuid);}
  };
  return true;
}

async function resolveToken(reference) {
  if (!reference) return null;
  if (typeof reference === "string") {
    const doc = await fromUuid(reference);
    return doc?.object ?? (doc?.documentName === "Token" ? doc : null);
  }
  return reference.object ?? reference;
}
function actorToken(actor) {return actor.token?.object ?? actor.getActiveTokens?.(true, true)?.[0]?.object ?? actor.getActiveTokens?.()?.[0] ?? null;}
function nearestAlly(actor, reference) {
  if (!reference || !canvas?.tokens) return null;
  const own = actorToken(actor);
  const allies = canvas.tokens.placeables.filter((t) => t.actor && t.actor.uuid !== actor.uuid &&
    (actor.alliance ? t.actor.alliance === actor.alliance : own && t.document.disposition !== 0 && t.document.disposition === own.document.disposition));
  const distance = (t) => reference.distanceTo?.(t) ?? canvas.grid.measurePath([reference.center, t.center]).distance;
  return allies.sort((a, b) => distance(a) - distance(b))[0] ?? null;
}
function contextOf(message) {return message.flags?.pf2e?.context ?? {};}
function isDemoralize(context) {return context.action === "demoralize" || context.options?.includes("action:demoralize");}

async function rollDemoralize(actor, target = null) {
  if (!target) {
    const targets = [...game.user.targets];
    if (!targets.length) {ui.notifications.warn("Выдели цель, которую персонаж может Деморализовать."); return;}
    target = targets[0];
  }
  const action = game.pf2e.actions.get("demoralize");
  if (!action) throw Error("Не найдено системное действие Demoralize.");
  return action.use({actors: [actor], target});
}
async function forcedStrike(actor, message, target) {
  const context = contextOf(message), weapon = message.item;
  let strike = actor.system.actions?.find((s) => s.item?.id === weapon?.id);
  if (context.altUsage === "thrown") strike = strike?.altUsages?.find((s) => s.item?.isThrown) ?? strike;
  if (!strike) throw Error("Не найден Удар для перенаправления промаха.");
  const map = Math.clamp(Number(context.mapIncreases) || 0, 0, 2);
  await strike.variants[map].roll({target, consumeAmmo: false, options: ["soulforger:bounding-reroll"]});
}
async function pain(actor, type) {
  const token = actorToken(actor)?.document;
  if (!token) {ui.notifications.warn("Для применения изъяна Планарной боли размести токен персонажа на сцене."); return;}
  if (!(type in DAMAGE_TYPES)) throw Error("Для изъяна Планарной боли не выбран корректный тип урона.");
  const DamageRoll = CONFIG.Dice.rolls.find((R) => R.name === "DamageRoll");
  if (!DamageRoll) throw Error("Не найден класс DamageRoll PF2e.");
  const roll = await new DamageRoll(`{2[${type}]}`).evaluate();
  const context = actor.getContextualClone([]);
  const isAffectedBy = context.isAffectedBy.bind(context);
  context.isAffectedBy = (damageType) => damageType === type || isAffectedBy(damageType);
  const flaw = effectsOf(actor, "corruption", "planar-pain")[0];
  await context.applyDamage({damage: roll, token, item: flaw});
  await card(actor, `<p>Изъян Планарной боли: базовые <strong>2 ${escapeHTML(DAMAGE_TYPES[type])}</strong>. Совместимость типа с живым/неживым существом обойдена; сопротивления и слабости обрабатывает PF2e.</p>`);
}
export async function shieldCheck(actor, shield = currentShield(actor)) {
  if (!shield) return true;
  const label = "Изъян Решительного неповиновения — чистая проверка КС 5";
  const roll = await game.pf2e.Check.roll(new game.pf2e.CheckModifier(label, {modifiers: []}), {
    actor, item: effectsOf(actor, "corruption", "resolute-defiance")[0] ?? null,
    type: "flat-check", dc: {value: 5}, skipDialog: true
  });
  if (!roll) throw Error("Проверка изъяна щита отменена. Урон ещё не применён.");
  if (roll.total >= 5) return true;
  const raisedEffects = itemsOf(actor).filter((i) => i.type === "effect" &&
    (["effect-raise-a-shield", "raise-a-shield"].includes(i.slug ?? i.system.slug) ||
      i.system.rules?.some((r) => r.key === "ActiveEffectLike" && r.path === "system.attributes.shield.raised" && r.value === true) ||
      ((i.slug ?? i.system.slug) === "effect-cover" && i.system.traits?.otherTags?.includes("tower-shield"))));
  if (raisedEffects.length) await actor.deleteEmbeddedDocuments("Item", raisedEffects.map((i) => i.id));
  await shield.update({"system.equipped.carryType": "dropped", "system.equipped.handsHeld": 0});
  await card(actor, `<p>Проверка провалена: ${escapeHTML(shield.name)} выпал из рук. Щит больше не поднят; блок не снижает урон.</p>`);
  return false;
}

async function applyStasis(message) {
  if (stasisRequests.has(message.id)) return;
  stasisRequests.add(message.id);
  try {await applyStasisInner(message);} finally {stasisRequests.delete(message.id);}
}
async function applyStasisInner(message) {
  const actor = message.actor, context = contextOf(message), weapon = message.item;
  const essence = effectsOf(actor, "essence", "pull-of-stasis").find((e) => flag(e).config?.targetId === weapon?.id);
  if (!essence || !["success", "criticalSuccess"].includes(context.outcome) || context.type !== "attack-roll") return;
  const target = await resolveToken(context.target?.token);
  if (!target?.actor) return;
  if (!target.actor.isOwner) {
    if (game.users.activeGM) {game.socket.emit(`module.${MODULE}`, {type: "stasis", messageId: message.id}); return;}
    await card(actor, "<p>Притяжение стазиса: урон/состояние цели ожидает применения владельцем цели или мастером.</p>",
      [cardButton("stasis", "Применить Притяжение стазиса к цели", {message: message.id})]);
    return;
  }
  if (itemsOf(target.actor).some((i) => flag(i).sourceMessage === message.id)) return;
  const source = stasisEffect(context.outcome === "criticalSuccess", game.time.worldTime, actor.combatant?.initiative ?? null);
  source.flags[MODULE].sourceMessage = message.id;
  await target.actor.createEmbeddedDocuments("Item", [source]);
}

export async function onChat(message, _options, userId) {
  if (userId !== game.user.id || flag(message).ownMessage) return;
  const actor = message.actor, context = contextOf(message);
  if (!actor) return;
  if (context.type === "attack-roll") {
    const weapon = message.item;
    const ranged = context.altUsage === "thrown" || context.options?.includes("item:ranged") || weapon?.isRanged;
    if (weapon?.type === "weapon" && ranged && ["failure", "criticalFailure"].includes(context.outcome) &&
        effectsOf(actor, "corruption", "bounding-spirit").length && !context.options?.includes("soulforger:bounding-reroll")) {
      const target = await resolveToken(context.target?.token);
      const ally = nearestAlly(actor, target);
      if (ally) await forcedStrike(actor, message, ally);
      else await card(actor, "<p>Изъян Связывающего духа: на текущей сцене не найден ближайший союзник. Мастер определяет цель, если она вне сцены.</p>");
    }
    if (weapon && effectsOf(actor, "essence", "pull-of-stasis").length) await applyStasis(message);
  }
  if (isDemoralize(context) && effectsOf(actor, "corruption", "deep-seated-fear").length && !secondaryDemoralize.has(actor.uuid)) {
    const original = await resolveToken(context.target?.token);
    if (actor.alliance && original?.actor && original.actor.alliance === actor.alliance) return;
    const ally = nearestAlly(actor, actorToken(actor));
    if (ally) {
      secondaryDemoralize.add(actor.uuid);
      try {await rollDemoralize(actor, ally);} finally {secondaryDemoralize.delete(actor.uuid);}
    }
  }
  if (context.type === "damage-taken") {
    const applied = message.flags.pf2e.appliedDamage;
    const dealt = !applied?.isHealing && ((applied?.updates ?? []).some((u) => u.value > 0) || (applied?.shield?.damage ?? 0) > 0);
    if (dealt) await applyPainForMessage(message);
    if (!flag(message).shieldCheckHandled && dealt && actor.isOwner &&
      effectsOf(actor, "corruption", "resolute-defiance").length && actor.system.attributes?.shield?.raised) await shieldCheck(actor);
  }
}

async function applyPainForMessage(message) {
  if (painRequests.has(message.id)) return;
  const applied = message.flags.pf2e?.appliedDamage;
  if (contextOf(message).type !== "damage-taken" || applied?.isHealing ||
      !((applied?.updates ?? []).some((u) => u.value > 0) || applied?.shield?.damage > 0)) return;
  const item = message.item, actor = item?.actor;
  if (!actor || !["weapon", "melee"].includes(item.type)) return;
  const flaws = effectsOf(actor, "corruption", "planar-pain");
  if (!flaws.length) return;
  if (!actor.isOwner) {
    if (game.users.activeGM) game.socket.emit(`module.${MODULE}`, {type: "pain", messageId: message.id});
    return;
  }
  painRequests.add(message.id);
  for (const flaw of flaws) await pain(actor, actor.getFlag(MODULE, "lastPlanarPain") ?? flag(flaw).config.damageType);
}

async function reflect(actor, effect) {
  const config = flag(effect).config;
  const selected = actor.items.get(config.targetId);
  const shields = eligibleItems(itemsOf(actor), "shield");
  let shield = isShield(selected ?? {}) ? selected : null;
  if (!shield && shields.length) {
    const id = await select("Щит для расчёта отражения", shields.map((s) => ({value: s.id, label: s.name})));
    if (!id) return; shield = actor.items.get(id);
  }
  if (!shield) {ui.notifications.warn("В правилах отражение рассчитывается от Твёрдости щита. Без щита величину должен определить мастер."); return;}
  const type = await select("Тип урона промахнувшегося снаряда", ["bludgeoning", "piercing", "slashing"].map((value, i) =>
    ({value, label: ["Дробящий", "Колющий", "Рубящий"][i]})));
  if (!type) return;
  const value = Math.floor(Number(shield.system.hardness) / 2);
  const DamageRoll = CONFIG.Dice.rolls.find((R) => R.name === "DamageRoll");
  if (!DamageRoll) throw Error("Не найден класс DamageRoll PF2e.");
  const roll = await new DamageRoll(`{${value}[${type}]}`).evaluate();
  await roll.toMessage({speaker: ChatMessage.getSpeaker({actor}), flavor: "Отражающий дух — реакция: отражённый снаряд"});
}
async function clickCard(event) {
  const button = event.target.closest?.("[data-soulforger-action]");
  if (!button) return;
  event.preventDefault();
  button.disabled = true;
  try {
    const action = button.dataset.soulforgerAction;
    if (action === "stasis") {
      const message = game.messages.get(button.dataset.message);
      if (message) await applyStasis(message);
      return;
    }
    const effect = await fromUuid(button.dataset.effect);
    const actor = effect?.actor;
    if (!actor?.isOwner || !effectActive(effect)) {ui.notifications.warn("Эффект завершён или нет прав владельца."); return;}
    if (action === "dismiss") {await cleanup(actor, effect.id); await effect.delete();}
    else if (action === "demoralize") {
      if (flag(effect).demoralizeUsed) return;
      const result = await rollDemoralize(actor);
      if (Array.isArray(result) && result.some((r) => r.roll)) await effect.setFlag(MODULE, "demoralizeUsed", true);
    } else if (action === "reflect") await reflect(actor, effect);
    else if (action === "shield-check") await shieldCheck(actor);
  } finally {button.disabled = false;}
}

export function preCreateChat(message) {
  if (contextOf(message).type !== "damage-taken") return;
  const context = shieldDamageContexts.get(message.actor?.uuid);
  if (!context) return;
  if (context.checked) message.updateSource({[`flags.${MODULE}.shieldCheckHandled`]: true});
  const adjust = context.adjustment;
  const applied = message.flags.pf2e?.appliedDamage;
  if (adjust && applied?.shield?.id === adjust.shieldId) message.updateSource({[`flags.${MODULE}.shieldUndo`]: adjust});
}
export async function onUpdateChat(message, changes, _options, userId) {
  if (userId !== game.user.id) return;
  const reverted = changes["flags.pf2e.appliedDamage.isReverted"] ?? fu().getProperty(changes, "flags.pf2e.appliedDamage.isReverted");
  const adjustment = flag(message).shieldUndo;
  if (!reverted || !adjustment) return;
  const actor = message.actor, shield = actor?.items.get(adjustment.shieldId);
  const bonus = shield?.getFlag(MODULE, "shieldHP");
  if (bonus?.source === adjustment.source && actor.isOwner) {
    const update = {[`flags.${MODULE}.shieldHP`]: {...bonus, value: Math.min(bonus.max, bonus.value + adjustment.absorbed)}};
    // Older messages undid only real HP, excluding the previous invisible pool.
    if (!adjustment.realHP) update["system.hp.value"] = Math.min(shield.system.hp.max, rawShieldHP(shield) + adjustment.absorbed);
    await shield.update(update, {soulforger: true, checkHP: false});
  }
}

if (typeof Hooks !== "undefined") {
  Hooks.once("init", () => {
    if (game.system.id !== "pf2e") return;
    installDamageCapture(CONFIG.Actor.documentClass);
    game.modules.get(MODULE).api = {use, provision, powers: POWERS};
  });
  Hooks.once("ready", () => {
    if (game.system.id !== "pf2e") return;
    installDamageCapture(CONFIG.Actor.documentClass);
    run(provision().then(migrateIcons).then(sweep).then(migrateShields));
    document.addEventListener("click", (event) => run(clickCard(event)));
    game.socket.on(`module.${MODULE}`, (data) => {
      if (!["stasis", "pain"].includes(data?.type) || !game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
      const message = game.messages.get(data.messageId);
      if (message) run(data.type === "stasis" ? applyStasis(message) : applyPainForMessage(message));
    });
  });
  for (const hook of ["renderActorSheet", "renderActorSheetV2", "renderCharacterSheetPF2e", "renderNPCSheetPF2e", "renderApplicationV2"])
    Hooks.on(hook, installSheet);
  Hooks.on("preCreateItem", preCreateCondition);
  Hooks.on("preUpdateItem", preUpdateItem);
  Hooks.on("preCreateChatMessage", preCreateChat);
  Hooks.on("createChatMessage", (...args) => run(onChat(...args)));
  Hooks.on("updateChatMessage", (...args) => run(onUpdateChat(...args)));
  Hooks.on("createItem", (item, _options, userId) => {
    if (userId !== game.user.id || !item.actor || !flag(item).route) return;
    run((async () => {
      const actor = item.actor, route = flag(item).route;
      const ability = itemsOf(actor).find((i) => flag(i).action === route);
      await item.delete();
      if (!ability) return;
      const reservation = nativeReservations.get(ability.uuid);
      nativeReservations.delete(ability.uuid);
      await use(actor, ability, {reserved: reservation > 0});
    })());
  });
  Hooks.on("deleteItem", (item, _options, userId) => {
    if (item.actor && flag(item).kind === "essence" && userId === game.user.id) run(cleanup(item.actor, item.id));
  });
  Hooks.on("updateWorldTime", () => run(sweep()));
  Hooks.on("updateCombat", () => run(sweep()));
}
