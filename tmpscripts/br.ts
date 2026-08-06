import { buildSeedSnapshot } from "../src/lib/data/seed";
import { detectBrokenReferences } from "../src/lib/data/service";
const s = buildSeedSnapshot();
console.log(JSON.stringify(detectBrokenReferences(s), null, 1));
const p = s.publications.find(x=>x.id==="PL-101")!;
const ch = p.chapters.find(c=>c.id==="CH-007")!;
console.log("CH-007:", JSON.stringify(ch,null,1));
const r = s.releases.find(x=>x.id==="LKR-1.0.001")!;
console.log("REL:", JSON.stringify(r,null,1));
