# Soulforger: effect automation

A custom ability for Foundry VTT 14 / Pathfinder 2e 8.6.1, with English and Russian localization.

## Update 1.3.1

The module supports English and Russian through Foundry’s native localization system. Dialogs, buttons, accessibility labels, all 13 essence powers and 13 corruption flaws, notifications, chat cards, action/effect names and descriptions, and temporary spell names are translated. English is the fallback for unsupported languages.

To select a language, change Foundry’s Language setting and reload the world. Existing generated actions and effects are updated on world load. The migration preserves daily uses, item IDs and links, effect timing, shield HP and its spent bonus, and custom names/descriptions. It also keeps Deep-Seated Fear’s language-penalty suppression matched to PF2e’s current localized modifier label.

Generated item names and descriptions are shared world data: they use the language of the user creating or updating them. Dialogs and new messages use the current client’s language. Existing chat messages retain the language in which they were created. Native PF2e spell descriptions follow the system’s own translations.

The dictionaries are `lang/en.json` and `lang/ru.json`. Run `npm run build` after editing them; it regenerates the runtime fallback dictionaries and the four importable action/helper JSON files. The bundled imports use English; normal world provisioning uses the active language.

To update, replace `Data/modules/soulforger-essence` with the folder from this archive and reload the world. Existing characters do not need their actions reimported.

## Update 1.2.2

Resolute Defiance increases the selected shield’s current and maximum HP by the character’s level + 2, in addition to its +2 Hardness. At level 8, a 20/20 HP shield becomes 30/30 HP. PF2e recalculates the Broken Threshold from the increased maximum. Damage consumes the added HP first. Ending the essence removes only unused bonus HP; damage to the original HP is preserved. Native damage undo restores shield HP and the unused bonus.

The corruption flaw rolls one native DC 5 flat check before Shield Block is applied. On a 1–4, remove Raise a Shield, drop the blocking shield, and apply damage without Shield Block reduction. On a 5–20, block normally. Resistances, weaknesses, immunities, and actor Hardness remain handled by PF2e. This works even without an active essence and when Hardness would absorb the whole hit. The essence stays attached to a dropped shield until it ends.

## Update 1.2.1

The Manifest Essence Form action and its `(manifest)` helper effect use `systems/pf2e/icons/spells/positive-luminance.webp`. The Apply Corruption Flaw action and its `(corruption)` helper effect use `systems/pf2e/icons/spells/eradicate-undeath.webp`.

After replacing the module folder and reloading the world, icons on existing actions and helper effects are updated automatically.

## Update 1.2.0

Essence powers and corruption flaws are once again selected using a **dropdown**, like subclass selection. The currently selected option's icon appears on the left, with a separate information button to the right of the dropdown. Select an option, then click the button on the right to open its description. Opening a description does not confirm activation or expend a use.

Equipment is selected in a separate dropdown. Weapons, armor, and shields retain their own icons both in the expanded list and in the field after selection. Custom item images are also preserved.

Images from the standard **PF2e** package have been selected for all 13 essence forms and all 13 corruption flaws. The paths are listed in `ICONS.md`. Icons on the module's existing actions and effects are updated automatically when the world loads.

To update, replace the `soulforger-essence` folder in `Data/modules` and reload the world. You do not need to reimport the JSON files or remove the ability from the character.

## Update 1.1.0

Version 1.1.0 added descriptions of essence forms and corruption flaws in separate windows. Numerical formulas in the descriptions are calculated for the character's current level. In version 1.2.0, these descriptions are opened using the button to the right of the dropdown.

To update an existing installation, replace the `soulforger-essence` module folder with the new one and reload the world. You do not need to add the ability to the sheet again or reimport the JSON files.

## Installation

1. Close Foundry or stop the server.
2. Extract the `soulforger-essence` folder from the archive into your user data folder's `Data/modules` directory. After extraction, the file must be located at `Data/modules/soulforger-essence/module.json`, without an additional nested folder.
3. Start Foundry, open a PF2e world, and enable **Soulforger: effect automation** in Manage Modules. Confirm the world reload.
4. Log in as a GM. A folder named **Soulforger — Essence Form** will appear automatically in the Items directory.
5. Drag **Manifest Essence Form** from that folder onto the character sheet. Two free actions will appear in the Actions section:
   - **Manifest Essence Form** — once per day;
   - **Apply Corruption Flaw** — no daily limit.

The other two items in the folder are helper effects referenced by `selfEffect`. Keep these items. Individual item JSON files are available in `items/` for inspection or reimport while the module is enabled. A normal installation does not require importing the JSON files separately.

## Usage

Click the standard **Use** button next to the action. When manifesting, first select one of the 13 powers. If the effect applies to specific equipment, the next window offers eligible items from the inventory:

| Power | Eligible Items | Additional Selection |
| --- | --- | --- |
| Adaptable Persona | Armor | Climb / swim; flight is also available from level 8 |
| Bounding Spirit | Melee weapons only | — |
| Deep-Seated Fear | No item required | Select the Demoralize target as usual |
| Determined Toughness | No item required | — |
| Harmful Malice | No item required: enhances all Strikes | — |
| Heroic Heart | No item required | — |
| Healing Grace | No item required | — |
| Magical Resilience | Armor and shields | — |
| Planar Bond | Armor and shields | One of eight damage types |
| Planar Pain | Weapons | One of eight damage types |
| Pull of Stasis | Weapons | — |
| Reflecting Spirit | Armor and shields | When reflecting: a shield for the calculation and the projectile type |
| Resolute Defiance | Shields only | — |

You can cancel any window without expending a use. Clicking again while a selection window is open does not create a second activation. Once confirmed, the effect appears in the character's effects list and lasts for 1 minute of game time. The chat card includes a button to end it early. Outside combat, Foundry's game time must advance for the minute to elapse.

The daily use is stored in the native `system.frequency` field and is restored by PF2e's normal daily preparation/rest process. To test the ability again, the GM can manually restore the counter on the sheet.

**Apply Corruption Flaw** opens the list of flaws. The selected flaw is added as a separate effect with unlimited duration. Selecting a flaw that is already active does not create a duplicate. Remove the effect normally or use the button in chat. Multiple different flaws can coexist; the action does not enforce curse stages.

## Effect Implementation

- Numerical bonuses, penalties, resistances, weaknesses, Speeds, additional dice, and damage type changes use native PF2e Rule Elements. Weapon effects are bound to the specific item's ID, so items with identical names are not confused with one another.
- Harmful Malice enhances all Strikes. Planar Pain and Pull of Stasis apply only to the selected weapon. Planar Pain changes physical damage components while preserving additional components of other damage types.
- Healing Grace uses native FastHealing: PF2e creates a healing card at the start of the turn. HP are restored using PF2e's standard healing application buttons.
- Harm, Heal, and Dispel Magic are added as temporary divine innate spells with one use. They use Charisma; the system calculates proficiency and DCs. The spells appear in the **Spells** section and are removed along with the essence that granted them. Their normal spellcasting action costs still apply.
- Deep-Seated Fear grants +2 to all Intimidation checks. The check dialog includes a **Target perceives the essence form** toggle that controls removal of the language penalty. The manifestation card includes a one-use Demoralize button. Range, the ability to perceive the effect, and temporary immunity to Demoralize are checked under the normal game rules.
- Determined Toughness reduces six status penalties through AdjustModifier. Condition values, HP loss from drained, and the spell-disruption DC from stupefied remain unchanged.
- Pull of Stasis automatically processes a Strike against a targeted creature if PF2e has determined the degree of success. A connected GM handles requests to modify another actor. On a critical hit, immobilized is tied to the temporary effect and ends when that effect ends. Automatic application requires a targeted creature and a determined result.
- Reflecting Spirit provides its conditional defense automatically. After a qualifying miss, the player clicks the reaction button on the effect's chat card. This creates a normal PF2e damage roll; damage to the attacker is applied with the standard button. The player/GM tracks the reaction cost and checks the trigger. For the armor option without a shield, the module does not invent a formula: it reports that the GM must determine the value.
- Resolute Defiance increases the selected shield’s current and maximum HP by level + 2, grants +2 Hardness, and temporarily grants Shield Block if needed. PF2e recalculates the Broken Threshold from the increased maximum. Damage consumes the added HP first; expiry removes only the unused bonus while preserving damage. Native damage undo restores the corresponding HP and unused bonus. Character HP are not increased.

## Corruption Flaw Triggers

| Flaw | Handling |
| --- | --- |
| Adaptable Persona / Pull of Stasis | Persistent penalty to all Speeds |
| Bounding Spirit | After a missed ranged/thrown weapon attack, repeat the Strike against the ally on the scene nearest to the original target; use the previous MAP, with no second ammunition expenditure and no chain of repeated rerolls |
| Deep-Seated Fear | An additional Demoralize attempt against the nearest ally on the scene, without a recursive chain |
| Determined Toughness | Existing listed conditions increase by 1 when the flaw is applied. New conditions and increases to their values are also increased by 1. Normal decreases to a condition do not trigger another increase |
| Harmful Malice | Damage dealt is reduced by half the character's level, rounded down |
| Heroic Heart | A −1 status penalty to attack rolls |
| Healing Grace | All healing received and healing provided by spells is reduced by half the character's level, rounded down |
| Magical Resilience | A conditional −1 status penalty to AC and saving throws against spells |
| Planar Bond | Weakness 1 to all damage |
| Planar Pain | After weapon/unarmed attack damage is actually applied to a target, the character takes 2 damage of the last selected type; innate immunity to vitality/void does not prevent this damage. PF2e handles resistances and weaknesses |
| Reflecting Spirit | A conditional weakness 5 to physical ranged attacks |
| Resolute Defiance | One automatic DC 5 flat check before Shield Block. Failure removes Raise a Shield, drops the blocking shield, and applies damage without the block’s reduction. Success allows normal Shield Block. Taking damage with a raised shield without blocking also triggers a check |

For the Planar Pain flaw, the ability remembers the last damage type selected. If no previous selection exists, you can specify it in a separate window. Changing it during a later manifestation also updates the active flaw.

Removing the Determined Toughness flaw does not automatically reduce condition values that have already been increased: those conditions end or change under the normal rules. This preserves changes to conditions that occurred after the flaw was applied.

Automatically selecting the nearest ally requires tokens on the active scene with their alliances configured. If the ally is outside the scene, the GM determines the target. Automated effects do not control manually entered damage or rolls made by arbitrary third-party macros. The GM must remain connected when working with other actors.

Applying an essence does not change the character's equipped items or remove inventory items: it creates an enhancement for the selected item as requested. Normal manifestation/storage of Soulforger armaments, free-hand requirements, and Soulforged Corruption stages are outside the scope of these two actions.

## Differences from the Published Archetype

As requested by the user, manifestation here is a **free action**, allows a new power to be selected each time, and has **one shared daily limit**. These settings intentionally differ from the standard Manifest Soulforged Armament / Soul Arsenal rules. Resolute Defiance also uses an increase to current/maximum shield HP and a pre-block corruption check that drops the shield on failure, as requested for this module.

## Validation and Source Versions

Reference item: a Bespell Strikes export from Foundry 14.369, PF2e 8.6.1. The `selfEffect` mechanism, granting the second action through GrantItem, and native Rule Elements were checked against PF2e's open-source code. Additional triggers are implemented in the module's code. For custom sheets provided by other modules, the API `game.modules.get("soulforger-essence").api.use(actor, item)` is also available.

Local JavaScript syntax checks and automated tests cover effect construction, item filtering, selection cancellation, the daily use counter, rollback on error, all 26 effect variants, and protection against double-click activation. Workflow tests use mocked Foundry APIs. The module has not been run inside a live Foundry client; interaction with the modules used in a particular world requires testing in that world.

Version 1.2.0 checks cover image dropdowns, all 26 descriptions, changing the selected option, previewing descriptions without expending a use, keyboard controls, closing the dropdown, rebinding event handlers, and updating icons on existing effects. DOM checks use LinkeDOM; the remaining checks use mocked Foundry APIs. The original 92-test suite covered those changes. The current 139-test suite also covers the shield changes, both languages, translation completeness and placeholders, all English activations, localized generated-item migration, preservation of custom text and resources, and native localization integration. All 139 local tests pass.

To run the local checks, install the development dependencies with `npm install --ignore-scripts`, run `npm run build`, then run `npm test`. These dependencies are not required to use the module in Foundry.

Rules: https://2e.aonprd.com/Archetypes.aspx?ID=393 and https://2e.aonprd.com/Rules.aspx?ID=3689. System source code: https://github.com/foundryvtt/pf2e. The game mechanics described belong to Pathfinder and Paizo; the module is a separate custom software implementation, implemented by daion_anri.
