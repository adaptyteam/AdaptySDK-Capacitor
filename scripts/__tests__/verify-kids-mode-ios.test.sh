#!/usr/bin/env bash
# Fast unit test for the pure grep helpers — no iOS build.
# Run: bash scripts/__tests__/verify-kids-mode-ios.test.sh
set -uo pipefail
# shellcheck source=/dev/null
source "$(dirname "${BASH_SOURCE[0]}")/../verify-kids-mode-ios.sh"  # guarded main → not run on source

fail=0
check() { if [[ "$2" == "$3" ]]; then echo "ok   - $1"; else echo "NOT OK - $1 (want $2 got $3)"; fail=1; fi; }

echo "/System/Library/Frameworks/AdSupport.framework/AdSupport" | frameworks_present && r=0 || r=1
check "frameworks_present detects AdSupport" 0 "$r"
echo "/System/Library/Frameworks/AppTrackingTransparency.framework/AppTrackingTransparency" | frameworks_present && r=0 || r=1
check "frameworks_present detects AppTrackingTransparency" 0 "$r"
echo "/usr/lib/libSystem.B.dylib" | frameworks_present && r=0 || r=1
check "frameworks_present absent on clean output" 1 "$r"
printf '%s\n' '_OBJC_CLASS_$_ASIdentifierManager' | symbols_present && r=0 || r=1
check "symbols_present detects ASIdentifierManager" 0 "$r"
printf '%s\n' '_OBJC_CLASS_$_NSObject' | symbols_present && r=0 || r=1
check "symbols_present absent on clean output" 1 "$r"
printf '%s\n' '_OBJC_CLASS_$_AdaptyCapacitorPlugin' | sentinel_present && r=0 || r=1
check "sentinel_present detects AdaptyCapacitorPlugin" 0 "$r"

exit $fail
