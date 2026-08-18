import { indexableRecords } from "../src/lib/marketing/intent-map";
const rs = indexableRecords();
console.log("count", rs.length);
const by: Record<string, any> = {};
for (const r of rs) {
  by[r.pageType] ??= { n:0, guide:0, assess:0, intents:new Set(), stages:new Set(), sample:"" };
  const b = by[r.pageType]; b.n++; if(r.guideSlug)b.guide++; if(r.assessmentSlug)b.assess++;
  b.intents.add(r.intent); b.stages.add(r.funnelStage); b.sample=r.path;
}
for (const [k,v] of Object.entries(by)) console.log(k, v.n, "guide",v.guide,"assess",v.assess,[...v.intents].join("/"),[...v.stages].join("/"), v.sample);
