#!/usr/bin/env ruby

# Prerequisites:
# gem install xcodeproj

require 'fileutils'
require 'xcodeproj'

# Script to automatically copy Adapty fallback JSON files to native projects
# and link them in iOS Xcode project using the Xcodeproj gem

ADAPTY_ASSETS = {
  android: {
    source: './assets/android/android_fallback.json',
    target: './android/app/src/main/assets/android_fallback.json',
    description: 'Android assets folder'
  },
  ios: {
    source: './assets/ios/ios_fallback.json',
    target: './ios/App/App/ios_fallback.json',
    description: 'iOS app bundle',
    needs_xcode_link: true
  }
}.freeze

def ensure_directory_exists(dir_path)
  unless Dir.exist?(dir_path)
    FileUtils.mkdir_p(dir_path)
    puts "📁 Created directory: #{dir_path}"
  end
end

def copy_file(source, target, description)
  return false unless File.exist?(source)
  
  begin
    ensure_directory_exists(File.dirname(target))
    FileUtils.cp(source, target)
    puts "✅ #{description}: #{source} → #{target}"
    true
  rescue => error
    puts "❌ Error copying #{source}: #{error.message}"
    false
  end
rescue
  puts "⚠️  Source not found: #{source}"
  false
end

def update_ios_project
  pbxproj_path = './ios/App/App.xcodeproj'
  
  unless Dir.exist?(pbxproj_path)
    puts '⚠️  iOS project not found, skipping Xcode linking'
    return false
  end

  begin
    puts '🔍 Parsing Xcode project...'
    project = Xcodeproj::Project.open(pbxproj_path)
    
    file_name = 'ios_fallback.json'
    
    # Get the main app target
    target = project.targets.first
    unless target
      puts '❌ No targets found in Xcode project'
      return false
    end
    
    puts "🔍 Target: #{target.name}"

    # Check if file is already added to the project
    existing_file = project.files.find { |file| file.display_name == file_name }
    if existing_file
      puts '📱 iOS fallback.json already linked in Xcode project'
      return true
    end

    puts "🔍 Adding resource file: #{file_name}"
    
    # Find or create the App group
    app_group = project.main_group.find_subpath('App') || project.main_group.new_group('App')
    
    # Add the file to the App group
    file_ref = app_group.new_reference(file_name)
    
    # Add the file to the target's resources build phase (NOT sources!)
    resources_build_phase = target.resources_build_phase
    resources_build_phase.add_file_reference(file_ref)
    
    # Save the project
    project.save
    puts '🔗 Successfully linked ios_fallback.json in Xcode project using Xcodeproj gem'
    true
    
  rescue => error
    puts "❌ Error updating iOS project with Xcodeproj gem: #{error.message}"
    puts "❌ Error backtrace: #{error.backtrace.first(3).join("\n")}"
    puts '💡 Please check if your Xcode project is valid and not corrupted'
    false
  end
end

# Main execution
puts '🚀 Copying Adapty fallback assets...'
puts

platform = ENV['CAPACITOR_PLATFORM_NAME']
total_copied = 0

if platform == 'ios' || platform.nil?
  if copy_file(ADAPTY_ASSETS[:ios][:source], ADAPTY_ASSETS[:ios][:target], ADAPTY_ASSETS[:ios][:description])
    total_copied += 1
    update_ios_project
  end
end

if platform == 'android' || platform.nil?
  if copy_file(ADAPTY_ASSETS[:android][:source], ADAPTY_ASSETS[:android][:target], ADAPTY_ASSETS[:android][:description])
    total_copied += 1
  end
end

puts
puts "✨ Copied #{total_copied} Adapty fallback file(s)"
