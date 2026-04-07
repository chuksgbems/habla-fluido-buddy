

# Remove Lovable Branding Before Deployment

Here is every place in your source code that references Lovable, and what to do about each.

---

## 1. `index.html` — OG/Twitter images and meta tags

| Line | Current | Change to |
|------|---------|-----------|
| 12 | `og:image` pointing to `lovable.dev/opengraph-image-p98pqg.png` | Replace with your own OG image URL (host your own image) |
| 15 | `twitter:site` set to `@Lovable` | Change to your own Twitter handle or remove |
| 16 | `twitter:image` pointing to `lovable.dev/...` | Replace with your own image URL |

## 2. `vite.config.ts` — lovable-tagger plugin (line 4, 15)

The `lovable-tagger` package adds `data-lov-id` attributes to components in development mode. It does NOT appear in production builds, so it is harmless. But to fully remove the trace:

- Remove the `import { componentTagger } from "lovable-tagger"` import
- Remove `mode === "development" && componentTagger()` from the plugins array
- Optionally remove `lovable-tagger` from `package.json` devDependencies

## 3. Published site badge — "Edit with Lovable" badge

The published deployment currently shows an "Edit with Lovable" badge. This can be hidden via settings (requires Pro plan). I can toggle it off for you if you have a Pro plan.

## 4. `supabase/functions/spanish-tutor/index.ts` — AI gateway (lines 25-27, 52, 55)

This uses `LOVABLE_API_KEY` and `ai.gateway.lovable.dev` to power the AI chat tutor. **You cannot remove this** unless you replace it with your own AI provider (e.g., direct OpenAI/Google API key). The gateway URL and key are backend-only — users never see them. They do not appear in the browser or frontend code.

## 5. `README.md`

Contains default Lovable project template text. Replace with your own project README.

---

## Summary

| Item | Visible to users? | Action |
|------|--------------------|--------|
| OG image & Twitter meta | Yes (when sharing links) | Replace with your own images/handles |
| lovable-tagger | No (dev only) | Remove import + plugin for cleanliness |
| Published badge | Yes (bottom of site) | Hide via settings (Pro plan required) |
| AI gateway URL/key | No (server-side only) | Leave as-is, or swap to your own AI provider |
| README.md | No (GitHub only) | Rewrite with your own content |

## Files to change
- `index.html` — replace OG/Twitter meta tags
- `vite.config.ts` — remove lovable-tagger import and plugin usage
- `package.json` — remove lovable-tagger from devDependencies
- `README.md` — rewrite

