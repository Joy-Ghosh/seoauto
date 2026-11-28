# Brand, design and motion system

Status: proposed working system, to validate in the phased prototype. Preserve the product name SEO Workbench. A character concept is not a committed brand identity or a substitute for user testing.

## Personality and promise

Role: a thoughtful workshop partner. Curious about evidence, clear about uncertainty, practical about the next step. Warm without being childish; precise without blaming the user. Brand value: you can inspect how a recommendation was reached, change your mind and verify delivery.

Voice: “Here is what we found. Here is what it means. Here is the next thing you can do.” Use “your page” rather than “your SEO is bad”. Avoid “AI magic”, “crush competitors”, “boost guaranteed”, “perfect SEO” and celebratory traffic promises. Use the user's terminology where possible; explain “donor” as “page where you add the link”.

Design metaphor: a small working bench with evidence cards, proposed changes and a return path to verification. The branching mark expresses page connections; it is not a ranking arrow. Dark frame and pastel cards retain the owner's preferred reference character. Avoid reproducing another product's exact layout, logo or decorative assets.

## Visual roles and tokens

| Token | Draft value | Role |
|---|---|---|
| ink | #171B18 | Strong text/frame, primary action |
| paper | #FFFEFA | Reading and editing surface |
| canvas | #F4F3EE | Quiet page ground |
| mint | #D9EEDB | Plan/workflow surface; never sufficient to mean verified |
| cyan | #DFF1F4 | Observations/data context |
| lilac | #E9E1F6 | Editable proposal and research context |
| lime | #E1F58B | Selected/current action accents; not “healthy SEO” |
| sand | #F5E9B9 | Attention/instruction surface |
| muted ink | #4C5747 | Secondary text on light surfaces |
| danger | #9E2830 | Destructive/error text, paired with a label |

These are draft brand choices from the owner's approved direction, not a database-validated palette. Measure every actual text/background/state pair before release (normal text ≥4.5:1; meaningful boundaries/icons ≥3:1). Pastel colours must never encode severity without labels and icons. Preserve red for errors and destructive actions, with stable confirmations.

Typography: one readable sans family with system fallback for MVP; evaluate Plus Jakarta Sans as a self-hosted optional family from the design search, not an external-font dependency required to use the app. Numeric data uses tabular figures. Base reading copy 16px with 1.5 line height; dense labels ≥12px and secondary descriptions generally 14px. Headings are short and bounded, not oversized banners on every tool. URLs and identifiers use a readable code style and wrap or reveal full text on focus; no essential content only in hover tooltips.

Spacing: 4/8px scale; cards 20–24px desktop padding, 16–20px phone. Radius: controls 12px, pills full, work cards 20–24px, frame 28–32px. Large radii should not erase grouping. Shadows only distinguish overlays/selected objects, not every row. Warm paper texture is optional and restricted to non-data regions; tables and charts remain clean.

## Information hierarchy before ornament

The page must answer: which site/task, what changed, why it matters, what can I do. The project shell gives stable navigation. The content area owns the task. A secondary rail appears only when it adds relevant evidence or an action; do not repeat the same counts, three-step journey and AI CTA on every screen. Prefer a single primary action; research/provider settings are secondary or disclosed in context.

Use a table for inventory and repeated comparisons, a connected pair for one link insertion, a side-by-side diff for a replacement, a timeline for change history, and a small trend chart only for real dated measurements. No arbitrary graph networks in place of a clear linking task. No numeric count-up that implies an improvement occurred.

## Component contract catalogue

| Component | Required content and states | Acceptance |
|---|---|---|
| Website context | Host, actual icon/fallback, selected project; loading/error | Stable identity; no third-party tracking for icons |
| Scope summary | Read/discovered/skipped, cap, method, timestamp | Never says “all pages” from bounded discovery |
| Opportunity card | Problem/outcome, page, evidence badge, reason, one action | Can explain why it appears without opening AI |
| Evidence passport | Source/value/time/coverage/unknowns | Original evidence one action away |
| Proposal editor | Original, draft, rationale, target, validation, save status | Editable, source conflict visible, no automatic publish |
| Link pair | Donor paragraph, anchor, receiver and existing-link evidence | Both pages inspectable; unknown destination explicit |
| Plan item | State/owner/target, expected value, next action | Saved/applied/checked distinct |
| Verification result | Baseline/current, expected/actual, scope, date | Partial and failed checks cannot look successful |
| Measured card/chart | Unit, date/filter, source, sample coverage | No fake numbers, duplicate totals or mixed lab/field metrics |
| Empty state | Why empty, available value, next step | No forced AI/GSC setup before a manual fix |
| Error state | What failed, retained work, retry/recovery | No shame; no mascot over critical text |

All components need static, loading, populated, empty, partial, error, disabled, keyboard focus and selected states where relevant. A loading skeleton reserves geometry and never stands in for a result. Data tables need headers, non-colour selection, clear sort state and narrow-screen containment. Dialogs need named titles, focus entry/trap/return, Escape for reversible exits, explicit deletion scope.

## Icon and illustration system

Use the existing Lucide family for functional controls; 16/20/24px size tokens, consistent stroke. Decorative icons beside text use aria-hidden. Standalone icon controls have visible or programmatic names and ≥44px targets. Product mark remains a native SVG shared by navigation, tab and exports; no generated raster logo replaces it.

Illustrations are justified in onboarding, first-scan education, empty plans or a learning guide. They must help a user understand the next step. They do not occupy audit tables, alter metrics, replace a status message, or appear in deletion/serious-error dialogs.

Optional character direction: a small tactile paper-and-ink workshop guide, derived from the branching/link motif, with one restrained personality. Use it to point to evidence, hold a draft or explain the recheck loop. It must not imply autonomous repair, Google endorsement or emotional pressure. Show a concept first; test whether people find it useful or distracting. A character is optional, a consistent brand system is not.

Generated artwork is a concept until selected, inspected, exported to optimised files and documented with size/alt policy. Functional diagrams, icons and live charts are code/vector so labels and evidence stay accessible. Decorative images get empty alt; informative illustrations get a short equivalent description nearby or in alt text.

## Motion storyboard

| Event | Meaning | Normal motion | Reduced motion / announcement |
|---|---|---|---|
| Scan starts | Request accepted | Status glyph begins, same area persists | Static indicator + “Reading your website…” |
| Page evidence arrives | More scope read | Brief status emphasis, no shifting rows | Update text/count, batch screen-reader notices |
| Finding opens | Inspect this page | 150–200ms drawer opacity/short translation | Immediate stable content, title receives focus |
| Draft saves | Local plan updated | Small 120–180ms acknowledgement | role=status “Draft saved. Website unchanged.” |
| External apply recorded | User reports edit | Timeline entry | “Marked applied by you; not checked yet.” |
| Recheck finishes | Result available | Same panel becomes expected/actual comparison | Text state; no confetti or metric count-up |
| Request fails | Recovery available | Stop progress indicator | Persistent error + retry; no bouncing objects |
| Delete | Destructive choice | Stable dialog, no playful motion | Same stable dialog and result |

Implement static and reduced-motion states first; use transforms/opacity behind no-preference. Prefer 100–250ms depending on distance; exits quicker. Do not animate width/height/position to rearrange evidence, add broad will-change, or leave decorative loops running. Cancellation remains available. Never delay data to finish a flourish. Follow [Motion UI Polish](C:/Users/joygh/.codex/skills/motion-ui-polish/SKILL.md).

## Copy rules and reusable examples

- Buttons name the object: “Review title”, “Save draft”, “Copy change”, “Check published page”. “Run AI” is secondary to the user outcome.
- Explain confidence inline: “Observed in 18 scanned pages”, “Suggested from page text”, “Search data not connected”.
- Error: “We couldn't read this page. Your earlier scan is still saved. Retry the page or check its address.”
- Partial: “40 pages read. More discovered URLs remain outside this scan.” Never “Scan complete: your site is healthy.”
- No search data: “You can review technical findings now. Add search data later to prioritise by visibility.”
- No AI key: “Write a change yourself, or connect AI to draft one.”
- Verification: “The title matches your draft in the latest response. Cross-page uniqueness wasn't checked.”

## UX rules that override visual preferences

Predictable navigation/back and retained filters; no unsaved editor loss; keyboard equivalent for every action; visible focus; accessible status text; labelled form fields; discoverable cancel; no content hidden under fixed elements; selection and state not expressed by colour alone. Screen-reader notices for status must not unexpectedly steal focus. [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html).

Validation must include 390/768/1024/1440 widths, long page titles/URLs, zoomed text, reduced motion, missing data, failed network, quota failure, no-AI/no-GSC paths and returning to saved work. These are future acceptance checks; the existence of this document does not mean they passed.
