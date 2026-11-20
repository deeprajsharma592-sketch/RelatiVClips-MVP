---
name: audit-ai-design-slop
description: Audit websites, apps, screenshots, mockups, and design code for harmful AI-design clichés, generic generated defaults, and established UI defects. Use when the user wants evidence-backed design feedback, an anti-slop review, or a removal-first cleanup plan without a speculative redesign.
---

# Audit AI Design Slop

Run a diagnostic, evidence-backed audit. Identify the smallest set of removals or corrections that would improve the interface while preserving its existing direction.

## Boundaries

- Do not guess whether AI made the design.
- Do not assign a numeric slop score.
- Do not reject a visual technique in isolation. A gradient, serif, dark theme, glass effect, card, animation, or single-font system can be intentional.
- Do not prescribe a new font, palette, layout, design system, or art direction unless the user explicitly asks for one.
- Do not turn an audit into an implementation task.
- Mark anything outside the visible or provided evidence as unknown.

## Audit the Evidence

Inspect the artifact available in the request:

- screenshots and recordings
- rendered pages and relevant viewports
- interaction and state changes
- source code, tokens, assets, and copy
- console or runtime failures when they affect the experience

For every finding, cite a concrete location, component, behavior, or line of copy. Do not report a generic tendency without evidence in the artifact.

Group symptoms by root cause and report the highest-impact evidence.

## Classify Findings

Use one of these classes:

- **Quality defect:** an established usability, accessibility, content, responsive, or runtime problem.
- **Slop pattern:** a repeated default, decorative layer, or generated-looking convention with no useful role.

## What to Flag

### Decorative stacking
Flag combinations of glow, gradient text, glass, borders, shadows, grids, particles, beams, noise, floating shapes, or browser chrome when multiple layers perform the same decorative job or compete with the content.

### Component and template repetition
Flag:
- card treatment applied to nearly every content block
- repeated icon-heading-description tiles with interchangeable content
- nested rounded containers that do not communicate hierarchy
- generic landing-page sequences unrelated to the product's buying or usage journey
- headings, labels, pills, or CTA blocks that restate nearby information

### Typography and copy clutter
Flag:
- duplicate text or unnecessary labels
- empty superlatives, vague category claims, and generated filler
- decorative type treatments that obscure hierarchy or readability
- long centered paragraphs, awkward forced line breaks, or hard-to-scan text
- inconsistent type roles that look accidental rather than expressive

### Motion theater
Flag motion that delays access, repeats mechanically, distracts from reading, moves targets, blocks input, or lacks respect for reduced-motion preferences. Preserve motion that communicates state, causality, hierarchy, or spatial change.

### Fake proof
Flag invented or unverifiable metrics, customers, testimonials, awards, ratings, activity, dashboards, charts, logos, and portraits when they are presented as evidence.

### Established UI failures
Flag:
- unclear or competing primary actions
- low contrast or unreadable content
- clipping, overflow, overlap, or broken responsive behavior
- broken assets, links, scripts, or controls
- essential information available only on hover
- missing states required by the observed flow
- unclear labels, roles, feedback, or keyboard focus
- accidental inconsistency in spacing, type, color, radius, or icons
- visual hierarchy that contradicts task importance

## Use the Removal Test

For every candidate:
1. State what information, state, action, hierarchy, or brand meaning it provides.
2. Ask whether removing it would improve clarity without losing that role.
3. If yes, recommend removal or consolidation.
4. If no, recommend the smallest correction using the existing system.
5. Suggest a replacement only when deletion would create a real loss.

Default to subtraction.
