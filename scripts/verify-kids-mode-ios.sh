#!/usr/bin/env bash
#
# Verify Adapty Kids Mode (iOS) end-to-end.
#
# Builds examples/adapty-devtools with the AdaptyCapacitorKidsMode SPM trait toggled
# via the shipped `adapty-kids-mode` CLI, then inspects EVERY Mach-O inside App.app
# (app stub, debug dylib, embedded frameworks) for IDFA/AdSupport (+ ATT) with otool/nm.
#
# Usage: scripts/verify-kids-mode-ios.sh <on|off|both>
#   on   - Kids Mode enabled;  assert tokens ABSENT  (CI + local)
#   off  - Kids Mode disabled; assert tokens PRESENT (local negative control)
#   both - off then on (positive + negative control) (local)
#
# Prereqs: examples/adapty-devtools deps installed + .adapty-credentials.json present.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$REPO_ROOT/examples/adapty-devtools"
APP_PROJECT="$EXAMPLE_DIR/ios/App/App.xcodeproj"
DERIVED_DATA="$REPO_ROOT/.derivedData-kids-mode"
SPM_DIR="$REPO_ROOT/.spm-kids-mode"

# Tokens that must vanish when Kids Mode is on: IDFA/AdSupport and AppTrackingTransparency.
FRAMEWORK_PATTERN='AdSupport|AppTrackingTransparency'
SYMBOL_PATTERN='ASIdentifierManager|ATTrackingManager'
# Positive sentinel — Adapty code MUST be visible, else the inspection is vacuous.
SENTINEL_SYMBOL='AdaptyCapacitorPlugin'

log() { printf '\n=== %s ===\n' "$*"; }

frameworks_present() { grep -qiE "$FRAMEWORK_PATTERN"; }
symbols_present()    { grep -qE  "$SYMBOL_PATTERN"; }
sentinel_present()   { grep -q   "$SENTINEL_SYMBOL"; }

# Toggle the trait as a consumer does (== `npx adapty-kids-mode`); via the link: symlink
# this edits the repo-root Package.swift the build consumes.
kids_mode() { node "$EXAMPLE_DIR/node_modules/@adapty/capacitor/scripts/kids-mode.cjs" "$1"; }
restore_manifest() { kids_mode disable >/dev/null 2>&1 || echo "WARN: failed to restore Package.swift to disabled" >&2; }

prepare_example() { ( cd "$REPO_ROOT" && yarn dev-example ); }

build_app() {
  rm -rf "$DERIVED_DATA"   # force recompile so the toggled trait takes effect
  # Re-resolve against the (cached) checkouts so the trait change is picked up even if the
  # clone dir is reused between off/on builds.
  xcodebuild -resolvePackageDependencies -project "$APP_PROJECT" \
    -clonedSourcePackagesDirPath "$SPM_DIR" -skipPackagePluginValidation
  xcodebuild -project "$APP_PROJECT" -scheme App \
    -destination generic/platform=iOS \
    -derivedDataPath "$DERIVED_DATA" \
    -clonedSourcePackagesDirPath "$SPM_DIR" \
    -skipPackagePluginValidation \
    -disableAutomaticPackageResolution \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
    build
}

# Every Mach-O inside the built .app: the app stub, debug dylib, and embedded frameworks.
list_binaries() {
  local app
  app="$(find "$DERIVED_DATA/Build/Products" -type d -name 'App.app' -print -quit 2>/dev/null || true)"
  if [[ -z "$app" ]]; then echo "FATAL: App.app not found under $DERIVED_DATA/Build/Products" >&2; exit 1; fi
  find "$app" -type f \( -name App -o -name '*.dylib' -o -path '*.framework/*' \) 2>/dev/null | while IFS= read -r f; do
    if file -b "$f" 2>/dev/null | grep -q 'Mach-O'; then printf '%s\n' "$f"; fi
  done
}

assert_mode() { # $1 = on|off
  local mode="$1" bins otool_all="" nm_all="" fw sym
  bins="$(list_binaries)"
  if [[ -z "$bins" ]]; then echo "FATAL: no Mach-O binaries found inside App.app" >&2; exit 1; fi
  while IFS= read -r b; do
    [[ -n "$b" ]] || continue
    otool_all+="$(otool -L "$b" 2>/dev/null || true)"$'\n'
    nm_all+="$(nm "$b" 2>/dev/null || true)"$'\n'
  done <<< "$bins"

  # here-strings (not pipes) — nm output is multi-MB; a pipe + grep -q early-exit triggers
  # SIGPIPE under `set -o pipefail` and would falsely report "absent".
  if ! sentinel_present <<< "$nm_all"; then
    echo "FATAL: sentinel '$SENTINEL_SYMBOL' not found in any App.app binary — inspection is vacuous." >&2
    exit 1
  fi
  if frameworks_present <<< "$otool_all"; then fw=present; else fw=absent; fi
  if symbols_present    <<< "$nm_all";    then sym=present; else sym=absent; fi
  echo "kids-mode=$mode  frameworks=$fw  symbols=$sym  sentinel=ok"

  if [[ "$mode" == "on" ]]; then
    if [[ "$fw" == "present" || "$sym" == "present" ]]; then
      echo "FAIL: Kids Mode ON but AdSupport/ATT still linked/referenced." >&2; exit 1
    fi
  else
    if [[ "$fw" != "present" || "$sym" != "present" ]]; then
      echo "FAIL: Kids Mode OFF but AdSupport/ATT not fully present — inspection looks wrong." >&2; exit 1
    fi
  fi
}

run_mode() { # $1 = on|off
  local mode="$1"
  log "Kids Mode $mode — toggle trait"
  if [[ "$mode" == "on" ]]; then kids_mode enable; else kids_mode disable; fi
  log "Kids Mode $mode — build App"
  build_app
  log "Kids Mode $mode — inspect App.app Mach-O binaries"
  assert_mode "$mode"
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    on|off|both) ;;
    *) echo "usage: $0 <on|off|both>" >&2; exit 2 ;;
  esac
  trap restore_manifest EXIT
  prepare_example
  case "$cmd" in
    on)   run_mode on ;;
    off)  run_mode off ;;
    both) run_mode off; run_mode on ;;
  esac
  log "Kids Mode verification ($cmd): PASSED"
}

if [[ "${BASH_SOURCE[0]}" == "${0:-}" ]]; then
  main "$@"
fi
