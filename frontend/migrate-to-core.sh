#!/usr/bin/env bash
# Migrate the frontend into:  src/core (infra) | src/features (domains) | src/pages (screens)
# Uses `git mv` (history-preserving, reversible) then rewrites @/ import aliases across src/.
# Run from the frontend project root. Requires a CLEAN git tree so it's one revertable step.

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: not a git repo. Init/commit first."; exit 1; fi
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: you have uncommitted changes. Commit or stash first (so this is reversible)."
  echo "Tip:  git switch -c chore/migrate-to-core && git commit -am wip"; exit 1; fi
if [ ! -d src ]; then echo "ERROR: run from the frontend root (where src/ lives)."; exit 1; fi

gmv() {  # gmv <src> <dest> — move only if source exists; create dest parent
  local s="$1" d="$2"
  if [ ! -e "$s" ]; then echo "  --skip (missing): $s"; return; fi
  mkdir -p "$(dirname "$d")"
  git mv "$s" "$d" && echo "  moved $s -> $d"
}

echo "== 1. core: store / redux wiring =="
gmv src/app/store.ts              src/core/store/store.ts
gmv src/app/hooks.ts              src/core/store/hooks.ts
gmv src/app/listenerMiddleware.ts src/core/store/listenerMiddleware.ts
gmv src/app/uiSlice.ts            src/core/store/uiSlice.ts
gmv src/lib/baseApi.ts            src/core/store/baseApi.ts
gmv src/lib/baseQuery.ts          src/core/store/baseQuery.ts

echo "== 2. core: app shell, routing, layout =="
gmv src/app/providers.tsx         src/core/providers.tsx
gmv src/app/router.tsx            src/core/routing/router.tsx
gmv src/app/RoleGuard.tsx         src/core/routing/guard/RoleGuard.tsx
gmv src/routes/AppLayout.tsx      src/core/layout/AppLayout.tsx

echo "== 3. core: config / components / styles / types / lib =="
gmv src/config                    src/core/config
gmv src/components/ui             src/core/components/ui
gmv src/components/common         src/core/components/common
gmv src/styles                    src/core/styles
gmv src/types                     src/core/types
gmv src/lib/utils.ts              src/core/lib/utils.ts

echo "== 4. pages: screens grouped by role =="
gmv src/routes/auth               src/pages/auth
gmv src/routes/patient            src/pages/patient
gmv src/routes/doctor             src/pages/doctor
gmv src/routes/staff              src/pages/staff

echo "== 5. stray cleanup (non-domain feature folders + duplicate DESIGN.md) =="
gmv src/features/dashboard/stitch src/../design/stitch/dashboard
gmv src/features/profile/stitch   src/../design/stitch/profile
[ -d src/features/dashboard ] && rmdir src/features/dashboard 2>/dev/null && echo "  removed empty features/dashboard"
[ -d src/features/profile ]   && rmdir src/features/profile   2>/dev/null && echo "  removed empty features/profile"
if [ -d src/features/stitch_markdown_design_system ]; then
  git rm -r -q src/features/stitch_markdown_design_system && echo "  removed duplicate DESIGN.md (kept docs/DESIGN.md)"
fi

echo "== 6. remove now-empty folders =="
rmdir src/app 2>/dev/null && echo "  removed empty src/app"
rmdir src/lib 2>/dev/null && echo "  removed empty src/lib"
# NOTE: src/routes/guard/RoleGuard.tsx is a duplicate of the one now in core — see warnings below.

echo "== 7. rewrite @/ import aliases across src =="
MAP=(
  "@/app/store|@/core/store/store"
  "@/app/hooks|@/core/store/hooks"
  "@/app/listenerMiddleware|@/core/store/listenerMiddleware"
  "@/app/uiSlice|@/core/store/uiSlice"
  "@/app/providers|@/core/providers"
  "@/app/router|@/core/routing/router"
  "@/app/RoleGuard|@/core/routing/guard/RoleGuard"
  "@/lib/baseApi|@/core/store/baseApi"
  "@/lib/baseQuery|@/core/store/baseQuery"
  "@/lib/utils|@/core/lib/utils"
  "@/components/ui|@/core/components/ui"
  "@/components/common|@/core/components/common"
  "@/config|@/core/config"
  "@/styles|@/core/styles"
  "@/types|@/core/types"
  "@/routes/AppLayout|@/core/layout/AppLayout"
  "@/routes/guard/RoleGuard|@/core/routing/guard/RoleGuard"
  "@/routes/auth|@/pages/auth"
  "@/routes/patient|@/pages/patient"
  "@/routes/doctor|@/pages/doctor"
  "@/routes/staff|@/pages/staff"
)
for pair in "${MAP[@]}"; do
  old="${pair%%|*}"; new="${pair##*|}"
  grep -rlF --include='*.ts' --include='*.tsx' "$old" src 2>/dev/null | while read -r f; do
    sed -i "s#${old}#${new}#g" "$f"
  done
done

echo "== 8. fix relative tailwind.css import in entry files (if present) =="
for f in src/main.tsx src/App.tsx; do
  [ -f "$f" ] && sed -i "s#\.\./styles/tailwind\.css#@/core/styles/tailwind.css#g; s#\./styles/tailwind\.css#@/core/styles/tailwind.css#g" "$f"
done

echo ""
echo "DONE. Now:"
echo "  1) npx tsc --noEmit   # catches any remaining imports (likely a few relative ones"
echo "     in src/App.tsx or src/main.tsx that used ./app/... instead of @/...)."
echo "  2) Reconcile the duplicate guard: compare src/routes/guard/RoleGuard.tsx with"
echo "     src/core/routing/guard/RoleGuard.tsx, delete the stale one, then: rmdir src/routes/guard src/routes"
echo "  3) Restart the TS server in your editor, then: npm run dev"
echo "  Reminder: '@/*' still maps to 'src/*' in tsconfig/vite — no alias config change needed."