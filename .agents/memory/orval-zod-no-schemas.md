---
name: Orval Zod codegen — no schemas option
description: The zod orval output must not have the schemas option set, or TypeScript types and Zod schemas share names and cause TS2308 ambiguity errors.
---

## Rule
Never add `schemas: { path: "generated/types", type: "typescript" }` to the `zod` output block in `lib/api-spec/orval.config.ts`.

## Why
With the schemas option, orval generates BOTH:
- `lib/api-zod/src/generated/api.ts` — Zod schemas (e.g. `export const BulkDeletePostsBody = zod.object({...})`)
- `lib/api-zod/src/generated/types/bulkDeletePostsBody.ts` — TypeScript type (e.g. `export type BulkDeletePostsBody = {...}`)

Both get re-exported from `lib/api-zod/src/index.ts`, causing TS2308: "Module has already exported a member named 'BulkDeletePostsBody'".

`generated/api.ts` is self-contained and does not import from `./generated/types/`, so removing schemas is safe.

## How to apply
When running `pnpm --filter @workspace/api-spec run codegen`, if you see TS2308 errors about re-exported members, check `lib/api-spec/orval.config.ts` — ensure the `zod` output block has NO `schemas` key.
