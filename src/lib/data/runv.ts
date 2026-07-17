import { runValidations } from "./service.validate";
runValidations().then(n => console.log("TOTAL", n)).catch(e => { console.error(e); process.exit(1); });
