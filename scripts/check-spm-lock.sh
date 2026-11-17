#!/usr/bin/env bash
#
# Verify the committed root Package.resolved is in sync with Package.swift.
#
# The iOS CI job builds with -disableAutomaticPackageResolution, so the lock file is the
# only source of pins. A stale lock is invisible locally (local builds resolve automatically)
# and surfaces in CI as an opaque SwiftPM error, so check it explicitly.
#
# The check is a fingerprint comparison: SwiftPM computes originHash from the raw bytes of
# the root manifest, so a matching hash means the lock was generated from exactly this
# Package.swift — and therefore its pins satisfy it. This catches every manifest edit,
# including `traits:` changes, which the pins themselves do not record.
#
# No network, no SwiftPM, no scratch directory. The remaining case a hash cannot catch —
# someone hand-editing the pins without touching the manifest — is caught by the build
# itself, which applies the same gate.
#
# Usage: scripts/check-spm-lock.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$REPO_ROOT/Package.swift"
LOCK="$REPO_ROOT/Package.resolved"

fail() {
  printf '\n%s\n' "$*" >&2
  cat >&2 <<'EOF'

Fix:
    yarn resolve:ios
    git add Package.resolved

Commit Package.resolved together with Package.swift — a commit that changes the
manifest without the lock is almost always wrong.

Note: local builds (yarn verify:ios) resolve automatically and stay green with a
stale lock, which is why this check exists.
EOF
  exit 1
}

cd "$REPO_ROOT"

[ -f "$LOCK" ] || fail "ERROR: Package.resolved is missing. CI builds with -disableAutomaticPackageResolution and cannot resolve without it."

manifest_hash="$(shasum -a 256 "$MANIFEST" | cut -d' ' -f1)"
origin_hash="$(node -p "JSON.parse(require('fs').readFileSync('$LOCK', 'utf8')).originHash")"

if [ "$manifest_hash" != "$origin_hash" ]; then
  fail "ERROR: Package.resolved was generated from a different Package.swift.
       originHash in lock: $origin_hash
       sha256(Package.swift): $manifest_hash"
fi

echo "OK: Package.resolved matches Package.swift."
