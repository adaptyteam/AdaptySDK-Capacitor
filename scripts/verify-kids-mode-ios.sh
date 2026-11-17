#!/usr/bin/env bash
#
# Verify Adapty Kids Mode (iOS) end-to-end, on each iOS integration.
#
# Builds an app with Kids Mode toggled, then inspects EVERY Mach-O inside App.app
# (app stub, debug dylib, embedded frameworks) for IDFA/AdSupport (+ ATT) with otool/nm.
#
# Usage: scripts/verify-kids-mode-ios.sh <on|off|both> [spm|pods]
#   on   - Kids Mode enabled;  assert tokens ABSENT  (CI + local)
#   off  - Kids Mode disabled; assert tokens PRESENT (local negative control)
#   both - off then on (positive + negative control) (local)
#
#   spm  - examples/adapty-devtools (default): the AdaptyCapacitorKidsMode SPM trait, toggled
#          via the shipped `adapty-kids-mode` CLI.
#   pods - a throwaway Capacitor app on CocoaPods, scaffolded in .kids-mode-pods-app/ the way a
#          consumer sets it up (`cap add ios --packagemanager CocoaPods`, then the plugin and the
#          ios/adapty_podfile.rb helpers). Kids Mode is `adapty_enable_kids_mode(installer)`,
#          run by `pod install` with ADAPTY_KIDS_MODE=1: `-DKidsMode` on the Adapty pod and
#          AdSupport unlinked. The pods mode also asserts the Adapty pods came from the spec repo.
#
# Prereqs: spm - examples/adapty-devtools deps installed + .adapty-credentials.json present;
#          pods - CocoaPods installed.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$REPO_ROOT/examples/adapty-devtools"
APP_PROJECT="$EXAMPLE_DIR/ios/App/App.xcodeproj"
DERIVED_DATA="$REPO_ROOT/.derivedData-kids-mode"
SPM_DIR="$REPO_ROOT/.spm-kids-mode"

PODS_APP_DIR="$REPO_ROOT/.kids-mode-pods-app"
PODS_IOS_DIR="$PODS_APP_DIR/ios/App"
PODS_DERIVED_DATA="$REPO_ROOT/.derivedData-kids-mode-pods"
SPECS_REPO='https://github.com/adaptyteam/AdaptySDK-CocoaPods-Specs.git'

TARGET=spm

# Tokens that must vanish when Kids Mode is on: IDFA/AdSupport and AppTrackingTransparency.
FRAMEWORK_PATTERN='AdSupport|AppTrackingTransparency'
SYMBOL_PATTERN='ASIdentifierManager|ATTrackingManager'
# Positive sentinel — Adapty code MUST be visible, else the inspection is vacuous.
SENTINEL_SYMBOL='AdaptyCapacitorPlugin'

log() { printf '\n=== %s ===\n' "$*"; }

frameworks_present() { grep -qiE "$FRAMEWORK_PATTERN"; }
symbols_present()    { grep -qE  "$SYMBOL_PATTERN"; }
sentinel_present()   { grep -q   "$SENTINEL_SYMBOL"; }

# --- spm ----------------------------------------------------------------------------------

# Toggle the trait as a consumer does (== `npx adapty-kids-mode`); via the link: symlink
# this edits the repo-root Package.swift the build consumes.
kids_mode() { node "$EXAMPLE_DIR/node_modules/@adapty/capacitor/scripts/kids-mode.cjs" "$1" --app-root="$EXAMPLE_DIR"; }
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

# --- pods ---------------------------------------------------------------------------------

# The Podfile edits a consumer makes (README "CocoaPods"); aborts if Capacitor's template no longer
# has the anchors. The require goes ABOVE Capacitor's own, the order `cap sync` would break for a
# `require_relative`, so the later `cap sync ios` proves the documented form survives it.
patch_podfile() {
  ruby - "$PODS_IOS_DIR/Podfile" <<'RUBY'
path = ARGV[0]
text = File.read(path)
{
  %r{^require_relative '[^']*@capacitor/ios/scripts/pods_helpers'\n} =>
    "require Pod::Executable.execute_command('node', ['-p',\n" \
    "  'require.resolve(\n" \
    "    \"@adapty/capacitor/ios/adapty_podfile.rb\",\n" \
    "    {paths: [process.argv[1]]},\n" \
    "  )', __dir__]).strip\n\\0",
  /^  capacitor_pods\n/ => "\\0  adapty_pods!\n",
  /^  assertDeploymentTarget\(installer\)\n/ =>
    "\\0  adapty_enable_kids_mode(installer) if ENV['ADAPTY_KIDS_MODE'] == '1'\n",
}.each do |pattern, replacement|
  abort "FATAL: Podfile anchor not found: #{pattern.source}" unless text.match?(pattern)
  text = text.sub(pattern, replacement)
end
File.write(path, text)
RUBY
}

prepare_pods_app() {
  rm -rf "$PODS_APP_DIR"
  mkdir -p "$PODS_APP_DIR/www"
  cat > "$PODS_APP_DIR/package.json" <<'JSON'
{
  "name": "adapty-kids-mode-pods-app",
  "private": true,
  "dependencies": {
    "@capacitor/core": "^8.0.0",
    "@capacitor/ios": "^8.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.0.0"
  }
}
JSON
  echo '{"appId":"com.example.adaptypods","appName":"AdaptyPods","webDir":"www"}' > "$PODS_APP_DIR/capacitor.config.json"
  echo '<!doctype html><title>Adapty pods</title>' > "$PODS_APP_DIR/www/index.html"
  (
    cd "$PODS_APP_DIR"
    yarn install --non-interactive
    # Without the plugin first: its pods need the helper, which the template Podfile lacks.
    yarn cap add ios --packagemanager CocoaPods
    patch_podfile
    yarn add --non-interactive "@adapty/capacitor@link:$REPO_ROOT"
    yarn cap sync ios
  )
}

# `pod install` regenerates the Pods projects, so off after on is clean too.
pod_install() { # $1 = on|off
  if [[ "$1" == "on" ]]; then
    ( cd "$PODS_IOS_DIR" && ADAPTY_KIDS_MODE=1 pod install )
  else
    ( cd "$PODS_IOS_DIR" && pod install )
  fi
}

# Catches the Adapty pods resolving from trunk instead of the spec repo.
assert_pods_from_spec_repo() {
  ruby -ryaml -e 'pods = YAML.load_file(ARGV[0]).dig("SPEC REPOS", ARGV[1]) || []
    missing = %w[Adapty AdaptyUI AdaptyPlugin] - pods
    abort "FATAL: not resolved from #{ARGV[1]}: #{missing.join(", ")}" unless missing.empty?
    puts "Adapty pods resolved from #{ARGV[1]}"' "$PODS_IOS_DIR/Podfile.lock" "$SPECS_REPO"
}

build_pods_app() {
  rm -rf "$DERIVED_DATA"
  xcodebuild -workspace "$PODS_IOS_DIR/App.xcworkspace" -scheme App \
    -destination generic/platform=iOS \
    -derivedDataPath "$DERIVED_DATA" \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
    build
}

# --- inspection ---------------------------------------------------------------------------

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
  log "Kids Mode $mode ($TARGET) — toggle"
  if [[ "$TARGET" == "pods" ]]; then
    pod_install "$mode"
    assert_pods_from_spec_repo
  elif [[ "$mode" == "on" ]]; then
    kids_mode enable
  else
    kids_mode disable
  fi
  log "Kids Mode $mode ($TARGET) — build App"
  if [[ "$TARGET" == "pods" ]]; then build_pods_app; else build_app; fi
  log "Kids Mode $mode ($TARGET) — inspect App.app Mach-O binaries"
  assert_mode "$mode"
}

main() {
  local cmd="${1:-}" target="${2:-spm}"
  case "$cmd" in
    on|off|both) ;;
    *) echo "usage: $0 <on|off|both> [spm|pods]" >&2; exit 2 ;;
  esac
  case "$target" in
    spm|pods) ;;
    *) echo "usage: $0 <on|off|both> [spm|pods]" >&2; exit 2 ;;
  esac
  TARGET="$target"
  if [[ "$TARGET" == "pods" ]]; then
    export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # CocoaPods warns on, then breaks with, other encodings
    DERIVED_DATA="$PODS_DERIVED_DATA"
    prepare_pods_app
  else
    trap restore_manifest EXIT
    prepare_example
  fi
  case "$cmd" in
    on)   run_mode on ;;
    off)  run_mode off ;;
    both) run_mode off; run_mode on ;;
  esac
  log "Kids Mode verification ($cmd, $TARGET): PASSED"
}

if [[ "${BASH_SOURCE[0]}" == "${0:-}" ]]; then
  main "$@"
fi
