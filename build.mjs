import {writeFile, mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {itemTemplates, IDS} from "./scripts/core.mjs";

const destination = new URL("./items/", import.meta.url);
await mkdir(destination, {recursive: true});
const filenames = {
  [IDS.feat]: "fvtt-Item-manifest-essence-form.json",
  [IDS.flaw]: "fvtt-Item-apply-corruption-flaw.json",
  [IDS.essenceCarrier]: "fvtt-Item-essence-selection-effect.json",
  [IDS.flawCarrier]: "fvtt-Item-corruption-selection-effect.json"
};
for (const item of itemTemplates()) {
  item._stats = {systemId: "pf2e", systemVersion: "8.6.1", coreVersion: "14.369"};
  const target = new URL(filenames[item._id], destination);
  await writeFile(target, JSON.stringify(item, null, 2) + "\n");
  console.log(fileURLToPath(target));
}
