import { buildCannibalizationReport } from "@/lib/marketing/cannibalization";
const r = buildCannibalizationReport();
console.log(r.counts);
console.log(r.findings.filter(f=>f.verdict!=="KEEP"&&f.verdict!=="DIFFERENTIATE"));
console.log(r.pairs.filter(p=>p.verdict==="CONSOLIDATE"||p.verdict==="REDIRECT"));
