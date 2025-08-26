#!/bin/bash

# Script to sync all plugin files from 'files' section to node_modules
# This replaces the need for 'yarn install --check-files' which is slow

TARGET_DIR="./examples/adapty-devtools/node_modules/@adapty/capacitor"

echo "🔄 Syncing plugin files to node_modules..."

# Create target directories if they don't exist
mkdir -p "$TARGET_DIR/dist"
mkdir -p "$TARGET_DIR/android/src/main"
mkdir -p "$TARGET_DIR/ios/Sources"
mkdir -p "$TARGET_DIR/ios/Tests"

# Sync all files from 'files' section in package.json
echo "📦 Syncing dist/ ..."
rsync -av --delete ./dist/ "$TARGET_DIR/dist/"

echo "🤖 Syncing android/src/main/ ..."
rsync -av --delete ./android/src/main/ "$TARGET_DIR/android/src/main/"

echo "🤖 Syncing android/build.gradle ..."
rsync -av ./android/build.gradle "$TARGET_DIR/android/"

echo "🍎 Syncing ios/Sources/ ..."
rsync -av --delete ./ios/Sources/ "$TARGET_DIR/ios/Sources/"

echo "🍎 Syncing ios/Tests/ ..."
rsync -av --delete ./ios/Tests/ "$TARGET_DIR/ios/Tests/"

echo "📄 Syncing Package.swift ..."
rsync -av ./Package.swift "$TARGET_DIR/"

echo "📄 Syncing AdaptyCapacitor.podspec ..."
rsync -av ./AdaptyCapacitor.podspec "$TARGET_DIR/"

echo "📄 Syncing package.json ..."
rsync -av ./package.json "$TARGET_DIR/"

echo "✅ Plugin files synced successfully!"
