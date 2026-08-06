import { buildSeedSnapshot } from "../src/lib/data/seed";
const s:any = buildSeedSnapshot();
console.log("keys:", Object.keys(s));
console.log("toolkits:", (s.clientToolkits??[]).map((x:any)=>x.id));
console.log("aiPacks:", (s.aiPacks??[]).map((x:any)=>x.id));
