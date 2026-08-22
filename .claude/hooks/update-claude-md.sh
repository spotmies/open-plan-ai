#!/usr/bin/env bash
# .claude/hooks/update-claude-md.sh
#
# Triggered by PostToolUse on Bash.
# When a test run succeeds and new src/features/* dirs are not yet documented
# in CLAUDE.md, calls `claude --print` to add a concise entry for each.
#
# Anti-loop guard: uses a lock file so the sub-claude spawned here does not
# re-trigger this hook.

set -euo pipefail

# ── 0. Anti-loop guard ─────────────────────────────────────────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
LOCK="$REPO_ROOT/.claude/.update-claude-md.lock"
[ -f "$LOCK" ] && exit 0
touch "$LOCK"
trap 'rm -f "$LOCK"' EXIT

# ── 1. Parse hook payload from stdin ──────────────────────────────────────────
INPUT="$(cat)"

_jq() { echo "$INPUT" | jq -r "$1" 2>/dev/null; }
_py() { echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null || echo ""; }

if command -v jq &>/dev/null; then
  COMMAND="$(_jq '.tool_input.command // ""')"
  OUTPUT="$(_jq '.tool_response.output // ""')"
else
  COMMAND="$(_py 'd.get("tool_input",{}).get("command","")')"
  OUTPUT="$(_py 'd.get("tool_response",{}).get("output","")')"
fi

# ── 2. Only act on a successful test run ──────────────────────────────────────
if ! echo "$COMMAND" | grep -qE '(npm test|npm run test|npx vitest|vitest)'; then
  exit 0
fi

# Bail if Vitest reports failures
if echo "$OUTPUT" | grep -qE '(FAIL|failed|× )'; then
  if echo "$OUTPUT" | grep -qE ' failed'; then
    exit 0
  fi
fi

# ── 3. Detect features not yet documented ─────────────────────────────────────
CLAUDE_MD="$REPO_ROOT/CLAUDE.md"
[ -f "$CLAUDE_MD" ] || exit 0

UNDOCUMENTED=()
if [ -d "$REPO_ROOT/src/features" ]; then
  for dir in "$REPO_ROOT/src/features"/*/; do
    [ -d "$dir" ] || continue
    FEATURE="$(basename "$dir")"
    echo "$FEATURE" | grep -qE '^(index|shared|__tests__)$' && continue
    grep -q "features/$FEATURE\b" "$CLAUDE_MD" 2>/dev/null && continue
    UNDOCUMENTED+=("$FEATURE")
  done
fi

[ "${#UNDOCUMENTED[@]}" -eq 0 ] && exit 0

FEATURE_LIST="$(IFS=', '; echo "${UNDOCUMENTED[*]}")"
echo "📝  New frontend features detected: $FEATURE_LIST — updating CLAUDE.md..."

# ── 4. Invoke claude --print to append entries ────────────────────────────────
claude --print \
  "You are maintaining CLAUDE.md for the open-plan-ai React/TypeScript frontend repo.

New feature modules were just implemented and their tests pass. They are not yet documented in CLAUDE.md.

New features: $FEATURE_LIST

Steps:
1. Read $CLAUDE_MD.
2. For each new feature, read the main page component and any hooks or service files inside src/features/<name>/.
3. Add a concise entry for each feature in the 'Feature Modules' section (or create that section if absent).
4. Keep entries to 2-4 bullets max. Match the existing tone exactly.
5. Note the key page components, primary hooks, and any non-obvious patterns (e.g. hardcoded data pending API, Socket.IO room used, virtual scrolling).
6. Only ADD — never remove or reformat existing content.
7. Also check whether DESIGN.md needs a new color section for domain-specific colors introduced by the feature. If yes, append to DESIGN.md too.

Files to update: $CLAUDE_MD (and optionally $REPO_ROOT/DESIGN.md)" \
  --allowedTools "Read,Edit" \
  --output-format text \
  > /dev/null 2>&1 || true

echo "✅  CLAUDE.md updated."
