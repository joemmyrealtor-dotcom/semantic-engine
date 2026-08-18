import { buildConversionAudit } from "../src/lib/marketing/conversion-audit";
const r = buildConversionAudit();
console.log(r.total, r.ready, r.review, r.blocked, JSON.stringify(r.findingCounts));
for (const p of r.pages.filter(p=>p.status!=="READY").slice(0,15)) console.log(p.status, p.path, p.issues.map(i=>i.finding).join(","));
console.log("mobile", r.mobileCtaPaths.length, "directContact", r.directContactCoverage.exposedOn);
