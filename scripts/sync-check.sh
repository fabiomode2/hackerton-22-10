#!/usr/bin/env bash
# sync-check.sh — ¿estoy trabajando sobre código viejo?
#
# Uso:  ./scripts/sync-check.sh
#       ./scripts/sync-check.sh --quiet   (solo imprime si hay algo que hacer)
#
# Códigos de salida:
#   0  al día
#  10  tu rama va por detrás del remoto      → git pull --rebase
#  20  main avanzó                           → rebase sobre origin/main
#  30  divergencia / posible conflicto       → PARAR, avisar al lead
#  40  cambios sin commitear                 → commit o stash
#  50  sin upstream / error de red           → revisar a mano

set -uo pipefail

QUIET=0
[[ "${1:-}" == "--quiet" ]] && QUIET=1

say() { [[ $QUIET -eq 1 ]] || printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { warn "No es un repo git."; exit 50; }

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
say "Rama: $BRANCH"

if ! git fetch origin --prune --quiet 2>/dev/null; then
  warn "✗ No se pudo hacer fetch (¿red?). Trabaja con lo que tienes y avisa."
  exit 50
fi

# --- cambios locales -------------------------------------------------------
DIRTY=0
if [[ -n "$(git status --porcelain)" ]]; then
  DIRTY=1
  COUNT=$(git status --porcelain | wc -l | tr -d ' ')
  say "· Cambios sin commitear: $COUNT archivo(s)"
fi

# --- sin upstream ----------------------------------------------------------
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [[ -z "$UPSTREAM" ]]; then
  warn "✗ La rama '$BRANCH' no tiene upstream."
  warn "  Ejecuta: git push -u origin $BRANCH"
  [[ "$DIRTY" -eq 1 ]] && warn "  (y commitea antes: $COUNT archivo(s) pendientes)"
  exit 50
fi

AHEAD="$(git rev-list --count "$UPSTREAM..HEAD" 2>/dev/null || echo 0)"
BEHIND="$(git rev-list --count "HEAD..$UPSTREAM" 2>/dev/null || echo 0)"

# --- main avanzó respecto a tu base ---------------------------------------
MAIN_BEHIND=0
if git rev-parse --verify --quiet origin/main >/dev/null; then
  if [[ "$BRANCH" != "main" ]]; then
    BASE="$(git merge-base HEAD origin/main 2>/dev/null || true)"
    if [[ -n "$BASE" ]]; then
      MAIN_BEHIND="$(git rev-list --count "$BASE..origin/main" 2>/dev/null || echo 0)"
    fi
  fi
fi

# --- commits nuevos que merece la pena leer -------------------------------
if [[ "$MAIN_BEHIND" -gt 0 ]]; then
  say ""
  say "main tiene $MAIN_BEHIND commit(s) que no tienes:"
  git log --oneline --no-decorate "HEAD..origin/main" | head -20
  say ""
fi

# --- ficheros sensibles tocados en main -----------------------------------
if [[ "$MAIN_BEHIND" -gt 0 ]]; then
  SENSITIVE=$(git diff --name-only "HEAD...origin/main" 2>/dev/null \
    | grep -E '(^packages/fit-engine/src/types\.ts$|^package\.json$|^pnpm-workspace\.yaml$|^pnpm-lock\.yaml$)' || true)
  if [[ -n "$SENSITIVE" ]]; then
    warn "⚠ main ha tocado archivos sensibles:"
    printf '    %s\n' $SENSITIVE >&2
  fi
fi

# --- decisión --------------------------------------------------------------
if [[ "$DIRTY" -eq 1 ]]; then
  warn "→ Cambios sin commitear. Commit o stash antes de tocar el remoto."
  exit 40
fi

if [[ "$AHEAD" -gt 0 && "$BEHIND" -gt 0 ]]; then
  warn "→ Divergencia: $AHEAD local(es) / $BEHIND remoto(s). PARAR y avisar al lead."
  warn "  Sugerencia: git pull --rebase  (solo si sabes que no hay conflicto)"
  exit 30
fi

if [[ "$BEHIND" -gt 0 ]]; then
  say "→ Vas $BEHIND commit(s) por detrás de $UPSTREAM."
  say "  Ejecuta: git pull --rebase"
  exit 10
fi

if [[ "$MAIN_BEHIND" -gt 0 ]]; then
  say "→ origin/main avanzó $MAIN_BEHIND commit(s)."
  say "  Ejecuta: git rebase origin/main   (o pide merge al lead)"
  exit 20
fi

say "✓ Al día ($AHEAD commit(s) locales sin subir)"
if [[ "$AHEAD" -gt 0 ]]; then
  say "  Recuerda: git push"
fi
exit 0
