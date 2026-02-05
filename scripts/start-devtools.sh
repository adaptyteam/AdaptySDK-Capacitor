#!/bin/bash
# Start Adapty Devtools app for development
# Usage: ./scripts/start-devtools.sh [ios|android]

set -e

PLATFORM=${1:-ios}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEVTOOLS_DIR="$ROOT_DIR/examples/adapty-devtools"

echo "🔧 Starting Adapty Devtools ($PLATFORM)..."

# Step 1: Install and build root plugin
cd "$ROOT_DIR"
if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "📦 Installing root dependencies..."
    yarn install
fi
echo "🏗️  Building plugin..."
yarn build

# Step 2: Install devtools dependencies (skip postinstall to avoid interactive prompt)
cd "$DEVTOOLS_DIR"
if [ ! -d "$DEVTOOLS_DIR/node_modules" ]; then
    echo "📦 Installing devtools dependencies..."
    yarn install --ignore-scripts
fi

# Step 3: Build and sync
echo "🔄 Building and syncing..."
yarn build
yarn cap sync

# Step 4: Run on platform
echo "🚀 Launching on $PLATFORM..."

if [ "$PLATFORM" = "android" ]; then
    # For Android, auto-select first available emulator to avoid interactive prompt
    echo "📱 Finding Android target..."
    TARGET_ID=$(emulator -list-avds 2>/dev/null | head -1)
    if [ -z "$TARGET_ID" ]; then
        echo "❌ No Android emulators found. Please create one in Android Studio."
        echo "   Then run manually: cd examples/adapty-devtools && npx cap run android"
        exit 1
    fi
    echo "📱 Using target: $TARGET_ID"
    yarn build && npx cap run android --target "$TARGET_ID"
else
    yarn "$PLATFORM"
fi
