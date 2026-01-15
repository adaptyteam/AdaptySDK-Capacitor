#!/usr/bin/env ruby

# Prerequisites:
# gem install xcodeproj

require 'fileutils'
require 'xcodeproj'
require 'pathname'

# Script to automatically copy Adapty fallback JSON files to native projects
# and link them in iOS Xcode project using the Xcodeproj gem

ADAPTY_ASSETS = {
  android: {
    source_dir: './assets/android',
    target_dir: './android/app/src/main/assets',
    description: 'Android assets folder'
  },
  ios: {
    source_dir: './assets/ios',
    target_dir: './ios/App/App',
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

def copy_files_from_dir(source_dir, target_dir, description)
  unless Dir.exist?(source_dir)
    puts "⚠️  Source directory not found: #{source_dir}"
    return []
  end

  ensure_directory_exists(target_dir)

  Dir.children(source_dir).filter_map do |entry|
    source_path = File.join(source_dir, entry)
    next unless File.file?(source_path)

    target_path = File.join(target_dir, entry)
    copy_file(source_path, target_path, description) ? target_path : nil
  end
end

def update_ios_project(target_dir, target_files)
  pbxproj_path = './ios/App/App.xcodeproj'
  
  unless Dir.exist?(pbxproj_path)
    puts '⚠️  iOS project not found, skipping Xcode linking'
    return false
  end

  if target_files.empty?
    puts 'ℹ️  No iOS files to link'
    return false
  end

  begin
    puts '🔍 Parsing Xcode project...'
    project = Xcodeproj::Project.open(pbxproj_path)
    
    target = project.targets.first
    unless target
      puts '❌ No targets found in Xcode project'
      return false
    end
    
    puts "🔍 Target: #{target.name}"

    resources_build_phase = target.resources_build_phase
    app_group = project.main_group.find_subpath('App') || project.main_group.new_group('App')

    linked_any = false

    target_files.each do |file_path|
      file_name = File.basename(file_path)
      desired_path = file_name
      existing_file = project.files.find { |file| file.display_name == file_name || file.path == desired_path }

      if existing_file
        existing_file.path = desired_path if existing_file.path != desired_path
        existing_file.source_tree = '<group>'
        app_group.children << existing_file unless app_group.children.include?(existing_file)
        file_ref = existing_file
      else
        file_ref = app_group.new_reference(desired_path)
        file_ref.source_tree = '<group>'
      end

      already_linked = resources_build_phase.files.any? { |f| f.file_ref == file_ref }
      next if already_linked

      resources_build_phase.add_file_reference(file_ref)
      linked_any = true
      puts "🔗 Linked iOS asset: #{file_name}"
    end

    if linked_any
      project.save
      puts '📱 iOS assets linked in Xcode project'
    else
      puts 'ℹ️  iOS assets already linked'
    end

    linked_any
    
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
  ios_files = copy_files_from_dir(
    ADAPTY_ASSETS[:ios][:source_dir],
    ADAPTY_ASSETS[:ios][:target_dir],
    ADAPTY_ASSETS[:ios][:description]
  )
  total_copied += ios_files.size
  update_ios_project(ADAPTY_ASSETS[:ios][:target_dir], ios_files) if ADAPTY_ASSETS[:ios][:needs_xcode_link]
end

if platform == 'android' || platform.nil?
  android_files = copy_files_from_dir(
    ADAPTY_ASSETS[:android][:source_dir],
    ADAPTY_ASSETS[:android][:target_dir],
    ADAPTY_ASSETS[:android][:description]
  )
  total_copied += android_files.size
end

puts
puts "✨ Copied #{total_copied} Adapty fallback file(s)"
