import { runValidations } from "../src/lib/data/service.validate";
runValidations().catch(e => { console.error(e); process.exit(1); });
