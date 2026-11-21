import {POWERS, DAMAGE_TYPES, escapeHTML, powerLabel} from "./core.mjs";
import {powerIcon} from "./icons.mjs";

const equipmentLabels = {
  armor: "Только доспехи", melee: "Только оружие ближнего боя", weapon: "Оружие",
  shield: "Только щиты", "armor-shield": "Доспехи или щиты"
};
const boundRoots = new WeakMap();
let controlSerial = 0;

/** Preview text is computed without creating or applying any Item documents. */
export function describePower(power, {corruption = false, level = 1} = {}) {
  const currentLevel = Math.max(1, Math.trunc(Number(level)) || 1);
  const text = (corruption ? power.flaw : power.benefit)
    .replaceAll("ceil(уровень / 2) − 1", String(Math.max(2, Math.ceil(currentLevel / 2) - 1)))
    .replaceAll("ceil(уровень / 2)", String(Math.ceil(currentLevel / 2)))
    .replaceAll("floor(уровень / 2)", String(Math.floor(currentLevel / 2)));
  const title = `${corruption ? "Изъян порока" : "Форма эссенции"}: ${powerLabel(power)}`;
  const details = [
    ["Длительность", corruption ? "Без ограничения, до удаления эффекта" : "1 минута"],
    ["Применяется", corruption ? "К персонажу, независимо от проявления снаряжения"
      : equipmentLabels[power.equipment] ?? "К персонажу"],
    ["Уровень персонажа", currentLevel]
  ];
  let extra = "";
  if (!corruption && ["planar-bond", "planar-pain"].includes(power.id)) {
    extra += `<p><strong>Доступные типы урона:</strong> ${Object.values(DAMAGE_TYPES).map(escapeHTML).join(", ")}.</p>`;
  }
  if (!corruption && power.id === "planar-bond") extra += `<p><strong>Сопротивление на этом уровне:</strong> ${currentLevel + 2}.</p>`;
  if (!corruption && power.id === "resolute-defiance") extra += `<p><strong>Прибавка к текущим и максимальным ОЗ выбранного щита:</strong> ${currentLevel + 2}.</p>`;
  const img = powerIcon(power.id, corruption);
  return {title, img, content: `<article class="soulforger-essence-description">
    <img class="soulforger-essence-description-image" src="${escapeHTML(img)}" alt="">
    <dl>${details.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>
    <p>${escapeHTML(text)}</p>${extra}</article>`};
}

export function powerChoices({corruption = false, level = 1} = {}) {
  return POWERS.map((power) => ({
    value: power.id,
    label: corruption ? `Изъян: ${powerLabel(power)}` : powerLabel(power),
    img: powerIcon(power.id, corruption),
    description: describePower(power, {corruption, level})
  }));
}

export function renderChoiceContent(title, choices, message = "") {
  const intro = message ? `<p>${escapeHTML(message)}</p>` : "";
  if (!choices.some((choice) => choice.description || choice.img)) {
    return `<div class="soulforger-essence-dialog">${intro}
      <select name="choice" aria-label="${escapeHTML(title)}">${choices.map((choice) =>
        `<option value="${escapeHTML(choice.value)}">${escapeHTML(choice.label)}</option>`).join("")}</select></div>`;
  }
  const first = choices[0];
  const listId = `soulforger-essence-options-${++controlSerial}`;
  const thumbnail = (choice, extraClass = "") => `<img class="soulforger-essence-choice-image ${extraClass}"
    src="${escapeHTML(choice.img ?? "")}" alt=""${choice.img ? "" : " hidden"}>`;
  return `<div class="soulforger-essence-dialog soulforger-essence-picker">${intro}
    <input type="hidden" name="choice" value="${escapeHTML(first?.value ?? "")}">
    <div class="soulforger-essence-control">
      <div class="soulforger-essence-select">
        <button type="button" class="soulforger-essence-select-trigger" role="combobox"
          aria-haspopup="listbox" aria-expanded="false" aria-controls="${listId}" aria-label="${escapeHTML(title)}"
          title="${escapeHTML(first?.label ?? "")}" data-soulforger-dropdown>
          ${thumbnail(first ?? {}, "soulforger-essence-selected-image")}
          <span class="soulforger-essence-selected-label">${escapeHTML(first?.label ?? "")}</span>
          <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </button>
        <div id="${listId}" class="soulforger-essence-options" role="listbox" aria-label="${escapeHTML(title)}" hidden>
          ${choices.map((choice, index) => `<button type="button" class="soulforger-essence-option"
            role="option" tabindex="-1" aria-selected="${index === 0}" data-soulforger-option="${escapeHTML(choice.value)}">
            ${thumbnail(choice)}<span>${escapeHTML(choice.label)}</span>
          </button>`).join("")}
        </div>
      </div>
      ${choices.some((choice) => choice.description) ? `<button type="button" class="soulforger-essence-info"
        data-soulforger-description="selected" aria-haspopup="dialog" title="Открыть описание"
        aria-label="${escapeHTML(`Открыть описание: ${first?.label ?? ""}`)}">
        <i class="fa-solid fa-info-circle" aria-hidden="true"></i>
      </button>` : ""}
    </div></div>`;
}

/** Image dropdown with an independent info button, matching PF2e's choice-control layout. */
export function bindChoiceDescriptions(root, choices, openDescription) {
  if (!root?.querySelector || !root.addEventListener) return () => {};
  const previous = boundRoots.get(root);
  if (previous) previous();
  const field = root.querySelector('[name="choice"]');
  const trigger = root.querySelector("[data-soulforger-dropdown]");
  const list = root.querySelector(".soulforger-essence-options");
  if (!field || !trigger || !list) return () => {};
  const info = root.querySelector("[data-soulforger-description]");
  const label = trigger.querySelector(".soulforger-essence-selected-label");
  const image = trigger.querySelector(".soulforger-essence-selected-image");
  const optionButtons = [...list.querySelectorAll("[data-soulforger-option]")];
  const choiceMap = new Map(choices.map((choice) => [String(choice.value), choice]));
  const parent = list.parentNode;
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const capture = {capture: true};
  let opened = false, usingPopover = false, cleaned = false;
  const cancel = (event) => {event.preventDefault(); event.stopImmediatePropagation();};

  function syncSelection() {
    const selected = choiceMap.get(field.value) ?? choices[0];
    if (!selected) return;
    field.value = String(selected.value);
    label.textContent = selected.label;
    image.hidden = !selected.img;
    if (selected.img) image.src = selected.img;
    else image.removeAttribute("src");
    trigger.title = selected.label;
    for (const option of optionButtons) option.setAttribute("aria-selected", String(option.dataset.soulforgerOption === field.value));
    if (info) {
      info.disabled = !selected.description;
      info.setAttribute("aria-label", `Открыть описание: ${selected.label}`);
    }
  }
  function positionList() {
    if (!opened) return;
    const rect = trigger.getBoundingClientRect?.() ?? {left: 8, top: 8, bottom: 44, width: 480};
    const viewportWidth = view.innerWidth || 1024, viewportHeight = view.innerHeight || 768;
    const below = viewportHeight - rect.bottom - 8, above = rect.top - 8;
    const useAbove = below < 160 && above > below;
    const maxHeight = Math.max(80, Math.min(320, useAbove ? above : below));
    const width = Math.max(120, Math.min(rect.width, viewportWidth - 16));
    list.style.width = `${width}px`;
    list.style.maxHeight = `${maxHeight}px`;
    const height = Math.min(list.scrollHeight || choices.length * 42 + 8, maxHeight);
    list.style.left = `${Math.max(8, Math.min(rect.left, viewportWidth - width - 8))}px`;
    list.style.top = `${Math.max(8, useAbove ? rect.top - height - 4 : rect.bottom + 4)}px`;
  }
  function closeList(focus = false) {
    if (!opened) return;
    opened = false;
    if (usingPopover) {try {list.hidePopover();} catch { /* Already closed by the browser. */ }}
    usingPopover = false;
    list.hidden = true;
    if (list.parentNode !== parent) parent.append(list);
    trigger.setAttribute("aria-expanded", "false");
    if (focus) trigger.focus();
  }
  function openList() {
    if (opened) return;
    opened = true;
    trigger.setAttribute("aria-expanded", "true");
    list.hidden = false;
    if (typeof list.showPopover === "function") {
      try {list.popover = "manual"; list.showPopover(); usingPopover = true;} catch {usingPopover = false;}
    }
    if (!usingPopover) {
      list.removeAttribute("popover");
      doc.body.append(list);
    }
    positionList();
    const selected = optionButtons.find((option) => option.getAttribute("aria-selected") === "true");
    selected?.scrollIntoView?.({block: "nearest"});
  }
  function choose(value) {
    if (!choiceMap.has(value)) return;
    field.value = value;
    syncSelection();
    closeList(true);
    field.dispatchEvent(new view.Event("change", {bubbles: true}));
  }
  const click = (event) => {
    const descriptionButton = event.target?.closest?.("[data-soulforger-description]");
    if (descriptionButton && root.contains(descriptionButton)) {
      cancel(event);
      closeList();
      const description = choiceMap.get(field.value)?.description;
      if (description) openDescription(description);
      return;
    }
    const dropdown = event.target?.closest?.("[data-soulforger-dropdown]");
    if (dropdown === trigger) {cancel(event); opened ? closeList() : openList(); return;}
    const option = event.target?.closest?.("[data-soulforger-option]");
    if (option && list.contains(option)) {cancel(event); choose(option.dataset.soulforgerOption);}
  };
  const keydown = (event) => {
    const option = event.target?.closest?.("[data-soulforger-option]");
    const onTrigger = event.target === trigger || trigger.contains(event.target);
    if (!onTrigger && !(option && list.contains(option))) return;
    if (event.key === "Escape" && opened) {cancel(event); closeList(true); return;}
    if (event.key === "Tab" && opened) {closeList(true); return;}
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      cancel(event); openList();
      let index = optionButtons.indexOf(option);
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = optionButtons.length - 1;
      else if (index < 0) index = Math.max(0, optionButtons.findIndex((button) => button.getAttribute("aria-selected") === "true"));
      else index = (index + (event.key === "ArrowDown" ? 1 : -1) + optionButtons.length) % optionButtons.length;
      optionButtons[index]?.focus();
      return;
    }
    if (option && ["Enter", " "].includes(event.key)) {cancel(event); choose(option.dataset.soulforgerOption);}
  };
  const outside = (event) => {if (opened && !root.contains(event.target) && !list.contains(event.target)) closeList();};
  const changed = (event) => {if (event.target === field) syncSelection();};
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    closeList();
    root.removeEventListener("click", click, capture);
    list.removeEventListener("click", click, capture);
    root.removeEventListener("keydown", keydown, capture);
    list.removeEventListener("keydown", keydown, capture);
    root.removeEventListener("change", changed);
    doc.removeEventListener("pointerdown", outside, capture);
    doc.removeEventListener("scroll", positionList, capture);
    view.removeEventListener("resize", positionList);
    if (boundRoots.get(root) === cleanup) boundRoots.delete(root);
  };
  root.addEventListener("click", click, capture);
  list.addEventListener("click", click, capture);
  root.addEventListener("keydown", keydown, capture);
  list.addEventListener("keydown", keydown, capture);
  root.addEventListener("change", changed);
  doc.addEventListener("pointerdown", outside, capture);
  doc.addEventListener("scroll", positionList, capture);
  view.addEventListener("resize", positionList);
  boundRoots.set(root, cleanup);
  syncSelection();
  return cleanup;
}
