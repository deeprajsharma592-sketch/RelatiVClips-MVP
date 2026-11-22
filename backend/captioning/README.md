# RelatiV caption system

`shared/caption_styles.json` is the source of truth for both libass exports and the dashboard preview.

To add a font: add a static TTF to `backend/assets/fonts`, add the matching WOFF2 to `frontend-next/public/fonts`, keep its OFL text in `backend/assets/fonts/licenses`, then add one registry entry. The family string must match the TTF's internal family name. Variable fonts are deliberately unsupported.

To add a preset: add it to `shared/caption_styles.json`. Keep explicit 1080×1920 sizes and safe-zone positions; the ASS builder handles word grouping, line fitting, stable active-word events, and subject-aware slot selection.
