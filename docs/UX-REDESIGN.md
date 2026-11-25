# Workspace redesign

The workspace is organized around a concrete loop: scan a site, review the highest-value findings, inspect a page, and save a draft for review. The visual system was rebuilt in `src/workspace.css`; the former stylesheet was removed. This is a web interface using Apple's design principles, with normal web controls and browser navigation.

## Interaction changes

- A focused start screen keeps URL entry primary. Backups move into a disclosure below the workspace content.
- Results lead with a next action, then scan metrics and findings. Three relevant AI entry points follow the evidence; all nine tasks remain available in Research.
- A persistent site selector opens any saved scan. New scan reveals its form without discarding the current results.
- Mobile navigation has five labeled destinations. Page inventory and link connections share a segmented switch, and mobile rows show labeled values without sideways scrolling.
- Page editing survives closing and reopening the inspector. Saving adds a draft to the repair plan, with an explicit link to view it. Removing a draft offers Undo.
- Research setup uses a task chooser and progressive disclosure for model and audience settings. Task/context values are retained per scan; API keys and data-sharing consent are excluded from those saved settings.
- Sections have URL fragments and support browser Back. Navigation focuses the page heading; the inspector traps keyboard focus and returns it on close. A skip link bypasses navigation.
- Owner sign-in explains the difference between the workspace password and the NVIDIA key.

## Visual system

System fonts, neutral surfaces, a blue action accent, consistent controls, and restrained borders keep page evidence prominent. Color tokens support system dark appearance and increased contrast; motion is disabled under reduced-motion preferences. Status and priorities use text as well as color.

Computed contrast ratios: primary text on white 15.73:1; secondary text on raised light surfaces 5.67:1; white primary-button text 5.57:1. Dark equivalents are 13.18:1, 6.96:1 and 4.90:1. These checks cover the named token pairs, not a full accessibility certification.

## Design references

- Apple HIG, [Layout — Visual hierarchy](https://developer.apple.com/design/human-interface-guidelines/layout): relative importance, alignment and progressive disclosure.
- Apple HIG, [Typography — Ensuring legibility](https://developer.apple.com/design/human-interface-guidelines/typography): readable sizes and system typography.
- Apple HIG, [Accessibility — Vision and Mobility](https://developer.apple.com/design/human-interface-guidelines/accessibility): contrast, non-color status, keyboard access and comfortable controls.
- Apple HIG, [Sidebars — Best practices](https://developer.apple.com/design/human-interface-guidelines/sidebars): shallow hierarchy and adaptation to available space.

## Verification

Browser checks covered the start and result screens, priority filtering, site switching, owner sign-out/sign-in with isolated QA credentials, page inventory and link navigation, draft recovery/save/Undo, task selection, and browser Back restoring the research task and seed text. Desktop, 390px and 320px layouts were inspected. A DOM overflow check found no horizontal page overflow on the 320px hosted research layout. Dark palette contrast was computed; dark appearance was not visually inspected. Existing crawler/provider/security tests remain separate from these UX checks.

No additional provider requests or website publishing are triggered by these UI changes. Crawls and AI analyses retain their explicit actions and disclosures.
