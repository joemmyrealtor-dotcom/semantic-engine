import "fake-indexeddb/auto";
if (typeof (globalThis as { window?: unknown }).window === "undefined") {
  (globalThis as { window?: unknown }).window = globalThis;
}
import { runValidations } from "../src/lib/data/service.validate";
runValidations().then(n => { console.log("TOTAL", n); }).catch(e => { console.error(e); process.exit(1); });
