# SYSTEM DIRECTIVE: Frontend Architecture Guardrails
**STACK:** React + TypeScript + Redux Toolkit (RTK + RTK Query) + shadcn/ui + Tailwind CSS.
**PRIME DIRECTIVE:** Strict adherence to the boundaries, workflows, and anti-patterns defined below. Code violating these parameters will be rejected.

## 1. State Management Boundaries
Strictly separate server state from client state.
* **SERVER STATE:** Owned exclusively by RTK Query endpoints (slots, appointments, doctor profiles, settings, venues, tags, user me). Cache, refetching, and tag invalidations are managed here.
* **CLIENT STATE:** Owned exclusively by Redux slices created via `createSlice` (auth tokens, memory sessions, booking draft wizard steps, UI open/close state).
* **RULE:** Never use `createAsyncThunk` to load server state into slices. Never fetch backend data via raw network requests in features.

## 2. API & Data Flow
* **Single Base API:** All API endpoints are injected onto the base API created in `src/lib/baseApi.ts` using `injectEndpoints`. Never define a secondary `createApi` instance.
* **Error Handling & Flow:** All requests must traverse through the base query (`src/lib/baseQuery.ts`) which manages authorization headers, token refreshing (401 flows), and response envelope normalization. Use `.unwrap()` on mutations to catch backend-specific error codes (e.g., `SLOT_FULL`).
* **View States:** Avoid assuming the happy path. Every data view must implement and account for `Loading`, `Empty`, and `Error` states.

## 3. UI Layer & AI Scaffolding Pipeline (CRITICAL)
* **AI Output Boundaries:** AI code generation (Stitch/Gemini Flash) is strictly **presentational only**. AI components must accept strongly typed `Props` and emit event callbacks. AI MUST NOT generate fetch calls, state management, routing hooks, or side effects (`useEffect` data loading).
* **Component Promotion Flow:** Unpack AI-generated code to `design/generated/` (gitignored). Refactor the components: replace ad-hoc structures with primitive components from `src/components/ui/`, remove all hardcoded data, verify types strictly, and move the finalized pure component to `features/*/components/` or `components/common/`. 
* **shadcn/ui Ownership:** Components residing in `src/components/ui/` are owned by the application (Radix primitives + Tailwind). Do not app-customize these files directly. Build opinionated variants on top of them inside `src/components/common/`. Pull primitives per screen to prevent unused bloat.

## 4. Directory Encapsulation & Strict Typing
* **Feature-First:** Code grouping occurs by business domain feature (`auth`, `appointments`, `users`). Deleting a folder should cleanly remove a feature.
* **Access Rules:** Features remain decoupled. A feature may not reach into another feature's internal directory; all imports must funnel through a feature's public `index.ts`.
* **Zero 'any' Policy:** Strictly enforce TypeScript strict mode (`noUncheckedIndexedAccess`, path aliases `@/*`). Do not bypass type checking with `any`, `as any`, or `// @ts-ignore`. 
* **Typed Store Hooks:** Do not import or use bare `useSelector` or `useDispatch`. Always consume `useAppSelector` and `useAppDispatch` from `src/app/hooks.ts`. Memoize state selectors using `createSelector`.
* **Environment Validation:** Validate environment variables at boot via Zod using `src/config/env.ts`. Never read `import.meta.env` values directly in components or services. Treat frontend runtime keys as public (non-secret). Keep auth access tokens in memory state only, never in local storage.

---

## ❌ ANTI-PATTERNS (DO NOT DO THESE)
* **AI:** DO NOT directly import or use unrefactored code from `design/generated/`. DO NOT let the AI generate internal logic, state, or API connectivity.
* **UI:** DO NOT modify `components/ui/*` primitives. Build wrappers in `components/common/`. DO NOT install or pull the entire shadcn library at once.
* **State & Data:** DO NOT fetch server data into Redux slices via Thunks. DO NOT build one mega-slice or monolithic API file. DO NOT neglect `invalidatesTags` on mutations (stale appointment slots are a severe bug). DO NOT trust the client for validation of business rules or capacity limits.
* **Architecture:** DO NOT use bare `useDispatch` / `useSelector`. DO NOT import internal files across feature boundaries. DO NOT exceed ~2 levels of prop drilling without leveraging hooks/store. DO NOT commit `.env.local` files or leak actual secrets into version control.