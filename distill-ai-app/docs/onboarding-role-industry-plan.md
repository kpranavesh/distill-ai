# Role × Industry Onboarding Redesign

## Goal
Capture nuance like "Software engineer in healthcare" or "Operations director in finance" with **minimal overlap** and **maximum signal** for recommendations.

## Principle
- **Role** = *What you do* (job function — your day-to-day hat)
- **Industry** = *Where you work* (sector/domain — your employer’s space)

No sector names in Role; no job titles in Industry.

---

## Role (job function only)

| Value | Label | Subtitle (for clarity) |
|-------|--------|--------------------------|
| engineering | Engineering / Technical | Software, systems, technical lead |
| product | Product | Roadmap, requirements, prioritization |
| design | Design | UX, UI, brand, creative |
| data | Data / Analytics | Reporting, insights, data science |
| operations | Operations | Processes, supply chain, internal ops |
| sales | Sales / BD | Revenue, partnerships, outreach |
| marketing | Marketing / Growth | Demand, content, campaigns |
| hr | HR / People | Talent, culture, people ops |
| finance | Finance / Accounting | Budget, reporting, controllership |
| legal | Legal / Compliance | Contracts, risk, regulatory |
| executive | Executive / Leadership | C-suite, VP, Director — strategy, teams |
| founder | Founder / Solo | Run the business, wear many hats |
| clinical | Clinical / Care delivery | Patient-facing: clinicians, care managers |
| educator | Educator / Teaching | Teaching, curriculum, training |
| other | Other | |

**Examples:** "Software engineer in healthcare" → role=engineering, industry=healthcare. "Ops director in finance" → role=operations, industry=financial-services. "Exec in retail" → role=executive, industry=retail.

---

## Industry (sector only)

| Value | Label | Subtitle |
|-------|--------|----------|
| technology | Technology / Software | SaaS, infra, dev tools |
| healthcare | Healthcare / Life sciences | Providers, payers, pharma, health tech |
| financial-services | Financial services | Banking, insurance, asset management |
| retail | Retail / Consumer / E‑commerce | D2C, marketplaces, consumer brands |
| manufacturing | Manufacturing / Industrial | Production, logistics, industrial |
| government | Government / Public sector | Gov, public admin, defense |
| nonprofit | Nonprofit / Social impact | NGOs, foundations, social enterprises |
| education | Education | K–12, higher ed, edtech, training |
| professional-services | Professional services / Consulting | Consulting, advisory, legal firms |
| media | Media / Entertainment | Publishing, entertainment, agencies |
| other | Other | |

---

## UI changes
1. **Step 0 copy:** "What do you do?" → helper: "Your primary job function — what you spend most of your time on." Same row: "What industry are you in?" → helper: "The sector or domain you work in."
2. **Preview line** when both selected: "We'll personalize for a [Role label] in [Industry label]."
3. **Options:** Use `value` for storage (API/backend unchanged); show `label` in UI. Optional: show `subtitle` under each dropdown or in a tooltip.
4. **Backend:** No API contract change; continue sending `role` and `industry` as strings (use the new values above).

---

## Recommendation impact
- Briefing API can map (role, industry) to relevance (e.g. "clinical + healthcare" → care delivery content; "engineering + technology" → dev tools; "executive + retail" → strategy/retail trends).
- Tool recommender can weight by function (e.g. data → spreadsheets/BI; marketing → creative tools; clinical → compliance-friendly tools) and by sector (e.g. healthcare → privacy-first; finance → audit trail).
