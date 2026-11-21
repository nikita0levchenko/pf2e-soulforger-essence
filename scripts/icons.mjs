/** All effect artwork is referenced from the PF2e system's bundled icon directory. */
const path = (relative) => `systems/pf2e/icons/${relative}`;
export const ESSENCE_ICON = path("spells/positive-luminance.webp");
export const CORRUPTION_ICON = path("spells/eradicate-undeath.webp");
export const STASIS_ICON = path("spells/stasis.webp");
export const IMMOBILIZED_ICON = path("conditions/immobilized.webp");
export const DEFAULT_ITEM_ICONS = Object.freeze({
  weapon: path("default-icons/weapon.svg"), armor: path("default-icons/armor.svg"), shield: path("default-icons/shield.svg")
});
export const POWER_ICONS = Object.freeze({
  "adaptable-persona": {essence: path("spells/fly.webp"), corruption: path("spells/slow.webp")},
  "bounding-spirit": {essence: path("spells/telekinetic-projectile.webp"), corruption: path("spells/mirrors-misfortune.webp")},
  "deep-seated-fear": {essence: path("spells/fear.webp"), corruption: path("conditions/frightened.webp")},
  "determined-toughness": {essence: path("spells/endure.webp"), corruption: path("conditions/drained.webp")},
  "harmful-malice": {essence: path("spells/harm.webp"), corruption: path("conditions/enfeebled.webp")},
  "heroic-heart": {essence: path("spells/heroism.webp"), corruption: path("spells/warriors-regret.webp")},
  "healing-grace": {essence: path("spells/heal.webp"), corruption: path("spells/touch-of-corruption.webp")},
  "magical-resilience": {essence: path("spells/spell-immunity.webp"), corruption: path("spells/spellwrack.webp")},
  "planar-bond": {essence: path("spells/resist-energy.webp"), corruption: path("spells/vision-of-weakness.webp")},
  "planar-pain": {essence: path("spells/weapon-surge.webp"), corruption: path("spells/blood-vendetta.webp")},
  "pull-of-stasis": {essence: STASIS_ICON, corruption: path("spells/slow.webp")},
  "reflecting-spirit": {essence: path("equipment/shields/specific-shields/reflecting-shield.webp"), corruption: path("conditions/off-guard.webp")},
  "resolute-defiance": {essence: path("features/classes/shield-block.webp"), corruption: path("conditions/broken.webp")}
});
export function powerIcon(powerId, corruption = false) {
  return POWER_ICONS[powerId]?.[corruption ? "corruption" : "essence"] ?? (corruption ? CORRUPTION_ICON : ESSENCE_ICON);
}
