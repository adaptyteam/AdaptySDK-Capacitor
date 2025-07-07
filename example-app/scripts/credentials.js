#!/usr/bin/env node
import fs from 'fs';
import promptSync from 'prompt-sync';

const prompt = promptSync();

var filename = '.adapty-credentials.json';
var token_key = 'token';
var ios_bundle_key = 'ios_bundle';

var exists = fs.existsSync(filename);

if (!exists) {
  console.log('Adapty credentials file not found. Creating...');

  const json = read_credentials_sync();
  write_credentials_sync(json);
  process.exit(0);
}

var result = fs.readFileSync(filename, 'utf8');
var file = JSON.parse(result);
const json = read_credentials_sync(file);
write_credentials_sync(json);

function read_credentials_sync(obj = {}) {
  var result = {};

  // Adapty token
  var cache_token = obj[token_key];
  var input_token = prompt(`Enter your Adapty token${cache_token ? ` (${cache_token})` : ''}: `);

  if (input_token) {
    result[token_key] = input_token;
  } else if (cache_token) {
    result[token_key] = cache_token;
  }

  // iOS BundleID
  var cache_bundle = obj[ios_bundle_key];
  var input_ios_bundle = prompt(`Enter your iOS bundle identifier${cache_bundle ? ` (${cache_bundle})` : ''}: `);

  if (input_ios_bundle) {
    result[ios_bundle_key] = input_ios_bundle;
  } else if (cache_bundle) {
    result[ios_bundle_key] = cache_bundle;
  }

  if (result[ios_bundle_key] === cache_bundle) {
    console.log(`[CREDENTIALS] Bundle ID unchanged (${result[ios_bundle_key]}), because no update needed`);
  } else {
    console.log(
      `[CREDENTIALS] Bundle ID changed from "${cache_bundle}" to "${result[ios_bundle_key]}", updating Xcode project...`,
    );
    write_ios_bundle(result[ios_bundle_key]);
    console.info("Don't forget to set your team in Xcode!");
  }

  return result;
}

function write_credentials_sync(obj) {
  var str = JSON.stringify(obj, null, 2);

  try {
    fs.writeFileSync(filename, str);
  } catch (error) {
    console.error(err);
    process.exit(1);
  }
}

// write_ios_bundle rewrites project.pbxproj file with new bundle identifier
// Adapted for Capacitor: ios/App/App.xcodeproj/project.pbxproj
function write_ios_bundle(new_bundle) {
  console.log(`[CREDENTIALS] Starting iOS bundle update to: ${new_bundle}`);

  var pbxprojPath = 'ios/App/App.xcodeproj/project.pbxproj';
  console.log(`[CREDENTIALS] Reading Capacitor project file: ${pbxprojPath}`);

  try {
    if (!fs.existsSync(pbxprojPath)) {
      console.error(`[CREDENTIALS] Error: Capacitor iOS project not found at ${pbxprojPath}`);
      console.error('[CREDENTIALS] Make sure you have run "npx cap add ios" first');
      process.exit(1);
    }

    var ios_content = fs.readFileSync(pbxprojPath, 'utf8');
    console.log(`[CREDENTIALS] Successfully read project file (${ios_content.length} characters)`);

    // Count current bundle identifiers
    var currentBundles = ios_content.match(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g);
    console.log(`[CREDENTIALS] Found ${currentBundles ? currentBundles.length : 0} bundle identifier entries`);
    if (currentBundles && currentBundles.length > 0) {
      console.log(`[CREDENTIALS] Current bundle identifiers: ${currentBundles.join(', ')}`);
    }

    var ios_content_new = ios_content.replace(
      /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
      `PRODUCT_BUNDLE_IDENTIFIER = ${new_bundle};`,
    );

    console.log(`[CREDENTIALS] Writing updated content to: ${pbxprojPath}`);
    fs.writeFileSync(pbxprojPath, ios_content_new);
    console.log('[CREDENTIALS] ✅ Successfully updated iOS bundle identifier in project.pbxproj');
  } catch (error) {
    console.error(`[CREDENTIALS] Error updating project file: ${error.message}`);
    process.exit(1);
  }
}
