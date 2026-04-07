# AGENTS.md

## Project Summary

This repository is a Next.js 16 App Router project using React 19 and Supabase.

- Main user-facing routes live under `app/`.
- Admin tooling lives under `app/admin/`.
- Shared admin UI lives under `components/admin/`.
- Shared auth and Supabase helpers live under `src/lib/`.

## Common Commands

- `npm run dev` starts the local dev server.
- `npm run build` runs the production build.
- `npm run lint` runs ESLint.

Prefer validating with `npm run build` after route or import changes, since bad relative imports will fail there even when a targeted lint pass succeeds.

## Repo Structure

- `app/layout.tsx` is the root layout.
- `app/admin/layout.tsx` wraps admin pages in `AdminShell`.
- `components/admin/AdminShell.tsx` owns the admin sidebar navigation.
- `app/admin/page.tsx` is the admin overview dashboard.
- `app/admin/_lib.ts` contains reusable admin-side record parsing helpers.
- `app/admin/data/[resource]/page.tsx` is the generic admin data explorer/editor for several tables.
- `app/admin/data/humor-flavors/[id]/page.tsx` is the custom detail page for humor flavors and their steps.

## Coding Conventions

- Follow existing server-component patterns for admin pages unless the file clearly needs client behavior.
- Reuse helpers from `app/admin/_lib.ts` for loosely typed Supabase rows instead of re-implementing parsing logic.
- Reuse existing admin UI components from `components/admin/` before creating new ones.
- When adding an admin page, update `components/admin/AdminShell.tsx` so it is reachable from the sidebar.
- Keep styling consistent with the existing admin palette and spacing patterns.

## Supabase Notes

- Admin pages commonly call `requireSuperadmin()` from `src/lib/auth/requireSuperadmin.ts`.
- Data from Supabase is often treated as `Record<string, unknown>` and normalized with `asRecord()`.
- Expect some tables to have fallback timestamp columns like `created_datetime_utc` or `created_at`; existing code frequently supports both.

## Data Model Notes

### Humor Flavor Core

- `humor_flavors`: `id`, `slug`, `description`, `created_datetime_utc`
- `humor_flavor_steps`: `id`, `humor_flavor_id`, `order_by`, `llm_input_type_id`, `llm_output_type_id`, `llm_model_id`, `humor_flavor_step_type_id`, `llm_system_prompt`, `llm_user_prompt`, `llm_temperature`, `description`
- `humor_flavor_step_types`: `id`, `slug`, `description`

### LLM Lookup Tables

- `llm_input_types` has `slug` and `description`, not `name`
- `llm_output_types` has `slug` and `description`, not `name`
- `llm_models` has `name`
- `llm_model_responses` is the audit trail for exact prompt/model output and includes `humor_flavor_step_id`

### Caption And Image Tables

- `captions` stores generated caption records and is linked to `humor_flavor_id`, `image_id`, `caption_request_id`, and `llm_prompt_chain_id`
- `images` includes `id`, `url`, `image_description`, and `is_common_use`

### Study Testing Tables

- `study_image_sets` stores image test-set definitions
- `study_image_set_image_mappings` is the real mapping table between image sets and images
- `studies` stores study entities
- `study_caption_mappings` maps captions to studies and is not fully wired into the Matrix captions flow yet

## Implementation Notes

- Do not order `llm_input_types` or `llm_output_types` by `name`; use `slug`, `description`, or a generic sort helper.
- For humor flavor steps, related lookup rows should come from FK-backed joins off `humor_flavor_steps`.
- Current helper reference: `app/admin/data/humor-flavors/[id]/_lib.ts`.
- Step type description should come from `humor_flavor_step_types.description`; only fall back to `humor_flavor_steps.description` if needed.
- Study image-set previews and counts should use `study_image_set_image_mappings`; earlier guessed relation names can produce incorrect zero-image results.

## Testing Flow Notes

- Testing should first show a grid of `study_image_sets`.
- Each set card should show set name, description, image count, and small image previews.
- Clicking a set should open a dedicated run page.
- The run page should generate captions for each image in sequence, show progressive loading/results, and provide `View Captions`.
- Generation endpoint: `https://api.almostcrackd.ai/pipeline/generate-captions`

## Change Guidance

- Avoid broad refactors unless they are required for the task.
- Respect existing route organization under `app/admin/data/` rather than introducing parallel admin patterns.
- If adding a page under a deep route, double-check relative import depth before finishing.
- If you touch navigation, confirm the active-state behavior still works for nested routes.

## Verification

Before handing off work, run the smallest useful check and escalate to `npm run build` when routing, imports, or server component wiring changed.
