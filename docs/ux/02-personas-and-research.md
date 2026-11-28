# People, jobs and research plan

Status: product hypotheses for discovery, 27 November 2026. The owner selected freelance SEO practitioners and vibe coders first, business owners next, and agencies later. That is a confirmed targeting choice, not validated customer demand. No interviews, market study, analytics or usability sessions were conducted. Needs, behaviours and emotions below remain hypotheses.

## The job to test

> When I have limited time to improve a website, help me choose a worthwhile issue, understand the evidence, prepare an accurate change and confirm what happened after publication, so I can make progress without guessing or breaking the site.

The product should help people finish one traceable change.

## Provisional personas

| Persona | Situation and job | Existing ability / dependency | Biggest uncertainty to investigate | Desired experience | Product priority |
| --- | --- | --- | --- | --- | --- |
| Freelance SEO practitioner | Reviews an owned/client site, chooses fixes and reports what changed | May edit a CMS or need an implementation handoff | Does the evidence and repair plan save enough checking and reporting time to be worth returning? | Capable, focused, accountable; able to explain a recommendation to someone else | Primary segment selected by owner; needs unvalidated |
| Vibe coder / AI-assisted site builder | Builds a website with AI and needs to locate and check an SEO change | Can ask a coding agent for changes, but must not be assumed to understand source architecture or safe deployment | Can they map a finding to an exact page/component/CMS field, apply a scoped instruction and recognise whether the live response changed? | Able to act without blindly trusting generated code | Primary segment selected by owner; distinct implementation path |
| Business owner responsible for a website | Wants a useful next action without learning every SEO term | May lack CMS access, technical knowledge or provider keys | Can they identify a safe action and hand it to the right person without misreading a draft as a live fix? | Reassured and in control; never ashamed for asking what a term means | Secondary; guided handoff first |
| Agency or in-house coordinator | Assigns and follows many page changes across clients or colleagues | Needs durable records, ownership, approvals and client-safe reports | Would a local/private single-owner tool fit any part of the workflow without collaboration and cross-device storage? | Organised, consistent and easy to audit | Future discovery; not current multi-user promise |

Recruit by behaviour; invent no demographics. Both primary segments may need an implementation handoff. Later, test agency trust through provenance, reproducible evidence, before/after records, consent and change history; adoption remains unproven.

## Jobs and boundaries

| Job | Trigger | Smallest meaningful result | Evidence that the job is complete |
| --- | --- | --- | --- |
| Decide what to work on | New scan or confusing findings | A page and a reason chosen for review | Person can explain the evidence, scope and next action |
| Prepare a fix | Missing or weak metadata/content | Accurate current/proposed values with an implementation location | Person approves the draft and knows where to apply it |
| Improve internal navigation | Relevant page needs contextual discovery | One donor → receiver proposal with exact anchor and paragraph | Person can inspect existing links and knows the suggestion is not published |
| Hand off implementation | User cannot edit the site | A self-contained change brief for the editor/developer | Recipient can locate the page, understand the replacement and the check |
| Check implementation | Change has been published outside Workbench | A newer response compared with the saved expectation | Match, mismatch or not checked, with URL/date/coverage |
| Evaluate search effect | Enough comparable GSC periods exist | Carefully scoped before/after performance analysis | Report separates change correlation from causal/ranking claims |

Keep GSC, AI and paid providers optional. Live publishing, customer accounts and collaboration are separate capabilities.

## Human needs to design for

- **Orientation:** Keep website, page, scan date and scope visible.
- **Competence:** Explain observations before proposing edits.
- **Autonomy:** Support manual drafts, declines, intentional choices and exports.
- **Recovery:** Preserve scans/drafts after errors; explain what retry repeats.
- **Ownership:** Explain storage, provider sharing and deletion scope.
- **Momentum:** Celebrate checked work modestly; no shame scores or implied ranking gains.

Enjoyment comes from understanding connections and finishing manageable work. Colour and character support evidence.

## Research programme

### Round 1: understand actual work

Recruit six people: two freelance SEO practitioners, two AI-assisted site builders who changed metadata/content in the past month, one WordPress/Shopify business owner and one coordinator who reviews SEO work. This small discovery sample is not a market estimate. Include keyboard navigation or screen-magnification needs, with consent and accommodation. Use sanitised examples or a controlled fixture; do not request credentials/private exports.

Conduct 30–40 minute interviews with non-leading questions:

1. Tell me about the last SEO change you made or requested. What triggered it?
2. Show or describe how you decided that change mattered. What evidence did you use?
3. What happened between the recommendation and publication? Who was involved?
4. How did you check the change? What did you consider finished?
5. Where did the work stop or become confusing? What did you do next?
6. What information would you remove from your current report? What is missing?

Discuss recent behaviour before willingness to pay/switch. Hypothetical agreement is not demand.

### Round 2: task-based usability

Use a labelled prototype and test site. With consent, record completion, misunderstandings and assistance. Avoid coaching and recording secrets.

| Task | Observable success | Critical misunderstanding |
| --- | --- | --- |
| Scan and choose a useful issue | Finds a page, explains the observation and scan coverage | Treats issue count as a ranking score |
| Draft a title without AI | Compares current/proposed text, saves and locates it again | Says the saved draft is published |
| Review an internal link | Identifies donor, receiver, anchor, paragraph and existing links | Confuses a proposed link with an observed link |
| Hand off a change | Produces a usable brief and names who must implement it | Assumes Workbench edited the CMS |
| Verify a changed title | Reads exact match or mismatch and the newer scan date | Calls an unscanned URL fixed |
| Recover from failed scan/API | Finds retry/fallback while retaining prior work | Believes an API failure means a score of zero |

### Measures and decision rules

No baseline is currently measured. Establish it before committing numeric conversion or time-saving claims.

- **Activation definition:** first saved change that the user publishes through their editor and then verifies against a newer readable page response. A match is implementation evidence, not an SEO outcome.
- **Supporting events:** scan completed/partial/failed; evidence opened; draft saved; export/handoff used; verification matched/mismatched/not checked. Count by unique project/change, not animation or page views.
- **Prototype target to test:** all four primary-segment participants independently choose a supported action and correctly distinguish draft, publication and verification. Any false “published” or “fixed” understanding needs revision before rollout; this small sample does not establish population success rates.
- **Time targets:** measure time from first useful scan result to a chosen action and draft. Measure publishing and verification separately because CMS permissions and crawl duration dominate total time. Set a later target from the observed baseline.
- **Return value:** ask participants to return for a second change; measure actual return completion where possible. Interest statements alone are weak evidence.
- **Guardrails:** lost work, wrong-site actions, unsupported factual edits, inaccessible controls, misunderstood provider sharing and accidental deletion.

Record observation → interpretation → decision → remaining question. Use only collected quotes. Revise personas after both rounds.

## Source basis

Checked `README.md`, `src/types.ts` and `src/verification.ts` in the earlier `outputs/seo-workbench` application. `Repair` persists title, description and alt drafts; verification can return not checked. Capability evidence does not validate personas.
