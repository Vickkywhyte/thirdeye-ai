#!/usr/bin/env bash
# Phase A' verification — checks that all reconciliation artefacts exist and reference each other.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Phase A' verification"
echo "====================="

REQUIRED=(
  "docs/adr/0008-build-doc-reconciliation.md"
  "docs/02-DATA-MODEL.md"
  "docs/03-API-CONTRACT.md"
  "docs/08-ADR-INDEX.md"
  "docs/09-PRD-DELTA.md"
  ".claude/CLAUDE.md"
)

MISSING=0
for f in "${REQUIRED[@]}"; do
  if [[ -f "$f" ]]; then
    echo "  OK    $f"
  else
    echo "  MISS  $f"
    MISSING=$((MISSING + 1))
  fi
done

echo ""
echo "Cross-reference checks"
echo "----------------------"

check() {
  local file="$1" pattern="$2" label="$3"
  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo "  OK    $label"
  else
    echo "  MISS  $label  ($file :: $pattern)"
    MISSING=$((MISSING + 1))
  fi
}

check "docs/02-DATA-MODEL.md"        "Reconciliation (ADR 0008)"      "02-DATA-MODEL has Reconciliation section"
check "docs/03-API-CONTRACT.md"      "Reconciliation (ADR 0008)"      "03-API-CONTRACT has Reconciliation section"
check "docs/08-ADR-INDEX.md"         "0008-build-doc-reconciliation"  "08-ADR-INDEX references ADR 0008"
check "docs/09-PRD-DELTA.md"         "schema-ready"                   "09-PRD-DELTA lists schema-ready deltas"
check ".claude/CLAUDE.md"            "Gate A′ passed"                 ".claude/CLAUDE.md §10 marks Gate A' passed"
check ".claude/CLAUDE.md"            "Phase B"                        ".claude/CLAUDE.md §10 names next Phase B"

echo ""
if [[ $MISSING -eq 0 ]]; then
  echo "Gate A' PASSED."
  exit 0
else
  echo "Gate A' FAILED — $MISSING item(s) missing."
  exit 1
fi
