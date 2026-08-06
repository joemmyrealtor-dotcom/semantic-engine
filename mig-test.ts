(globalThis as any).window = globalThis;
import "fake-indexeddb/auto";
import { loadSnapshot, getMigrationLog, restoreMigrationBackup, resetSnapshot } from "@/lib/data/db";
import { buildSeedSnapshot } from "@/lib/data/seed";
import { SCHEMA_VERSION } from "@/lib/data/schema";
import { openDB } from "idb";

const fresh = await loadSnapshot();
console.log("fresh version", fresh.schemaVersion, "pubs", fresh.publications.length);

// simulate a v9 snapshot with a stub PL-208 and an extra user publication
const db = await openDB("legacy-platform-v2", SCHEMA_VERSION);
const legacy: any = JSON.parse(JSON.stringify(buildSeedSnapshot()));
legacy.schemaVersion = 9;
legacy.publications = legacy.publications.filter((p: any) => !p.id.startsWith("PL-2"));
legacy.publications.push({ ...legacy.publications[0], id: "PL-999", title: "My Custom Doc" });
await db.put("kv", legacy, "snapshot");
const after = await loadSnapshot();
const log = await getMigrationLog();
console.log("outcome", log.at(-1)!.outcome, "integrity", log.at(-1)!.integrity.ok);
console.log("version", after.schemaVersion, "pubs", after.publications.length,
  "custom kept", after.publications.some(p => p.id === "PL-999"),
  "PL-208", after.publications.find(p => p.id === "PL-208")?.title);
const back = await restoreMigrationBackup(9);
console.log("rollback version", back?.schemaVersion, "pubs", back?.publications.length);
void resetSnapshot;
