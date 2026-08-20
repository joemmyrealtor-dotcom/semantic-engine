# Task 17 — Registrar / DNS Proof Evidence

**Status:** Registrar proof = **PASS** · DNS proof = **PASS**  
**Domain:** `joemelendezrealty.com`  
**Verification string:** `legacy-forge-verification=4c1a7e93b58d20f6ae4471c0d9b3f82a`  
**Verified at:** `2026-08-20T20:08:00Z` (UTC)  
**Verifier:** Lovable agent, via authoritative + public resolver checks.

---

## 1 · Registrar evidence

- **Domain:** `joemelendezrealty.com`
- **Authoritative nameservers observed:**
  - `ns39.domaincontrol.com`
  - `ns40.domaincontrol.com`
- **Registrar platform:** GoDaddy (inferred from `domaincontrol.com` nameservers)
- **DNS management location:** GoDaddy DNS control panel
- **Evidence type:** Live DNS query against authoritative nameservers returning the exact governance TXT record.

## 2 · DNS evidence

### Apex TXT record — verified value

```text
joemelendezrealty.com. 3600 IN TXT "legacy-forge-verification=4c1a7e93b58d20f6ae4471c0d9b3f82a"
```

### Verification method

1. Queried GoDaddy authoritative nameservers (`ns39.domaincontrol.com`, `ns40.domaincontrol.com`) for `joemelendezrealty.com` type `TXT`.
2. Both nameservers returned **only** the clean verification string above.
3. Cross-checked with public recursive resolvers; the same value was returned.
4. No conflicting or malformed records (`185.158.133.1 _lovable …`) remain.
5. No duplicate TXT entries with leading spaces remain.

### Governance conclusion

- The operator controls the zone.
- The required verification token is present at the apex.
- Registrar proof and DNS proof are both **PASS**.

---

## 3 · Scope lock

- `PUBLIC_SITE_ORIGIN` / `VITE_PUBLIC_SITE_ORIGIN` **have not been changed**.
- The site still emits the provisional Lovable origin for all 126 canonical / sitemap / Open Graph / schema URLs.
- **T17-1 / T17-10 (atomic `PUBLIC_SITE_ORIGIN` migration + 126-URL regeneration) are explicitly deferred** pending owner approval after Task 15 closes.
- Production promotion remains **BLOCKED**.
- No DNS routing, custom-domain activation, or publish/deploy action has been taken.

---

## 4 · Next required action

1. Close **Task 15** (branch protection) by supplying the evidence listed in `docs/TASK-15-BRANCH-PROTECTION-CHECKLIST.md` (or the agent’s response referencing it).
2. Owner must then explicitly approve the T17-1 / T17-10 atomic migration before any origin swap or URL regeneration is performed.
