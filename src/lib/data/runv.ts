import "fake-indexeddb/auto";
// Provide a minimal `window` shim so db.ts's SSR guard treats us as a browser.
if (typeof (globalThis as { window?: unknown }).window === "undefined") {
  (globalThis as { window?: unknown }).window = globalThis;
}
import { runValidations } from "./service.validate";
runValidations().then(n => console.log("TOTAL", n)).catch(e => { console.error(e); process.exit(1); });
