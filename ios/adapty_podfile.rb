# Podfile helpers of @adapty/capacitor for Capacitor apps on CocoaPods
# (`npx cap add ios --packagemanager CocoaPods`). SPM apps have no Podfile and need none of this.
# Require this file at the top of ios/App/Podfile:
#
#   require Pod::Executable.execute_command('node', ['-p',
#     'require.resolve(
#       "@adapty/capacitor/ios/adapty_podfile.rb",
#       {paths: [process.argv[1]]},
#     )', __dir__]).strip
#
# Not a `require_relative`: `npx cap sync` rewrites the Podfile from its first `require_relative`
# through Capacitor's own pods_helpers line, so one placed above that line is silently dropped.
# node's resolution also finds a hoisted node_modules.
#
# adapty_pods! - installs the native SDK pods (Adapty, AdaptyUI, AdaptyPlugin) from the Adapty spec
# repo: they are not on CocoaPods trunk. Call it in the app target, outside `capacitor_pods`, which
# `npx cap sync` regenerates:
#
#   target 'App' do
#     capacitor_pods
#     adapty_pods!
#   end
#
# A manual setup is also supported: a top-level `source` for the Adapty spec repo, plus one for
# https://cdn.cocoapods.org/, since any `source` disables the implicit trunk.
#
# adapty_enable_kids_mode(installer) - Adapty Kids Mode (COPPA / App Store Kids Category), in
# post_install:
#
#   post_install do |installer|
#     assertDeploymentTarget(installer)
#     adapty_enable_kids_mode(installer)
#   end
#
# Only post_install works: CocoaPods saves the Pods projects right after it, so from
# post_integrate the project edits are silently lost. It raises, failing `pod install`, in the
# cases it detects (listed at the method), not on every misuse. SPM apps get Kids Mode from the
# AdaptyCapacitorKidsMode package trait instead (`npx adapty-kids-mode`).

# Rubies before 3.1 dedup `require` by expanded path, not realpath: required through two paths
# (e.g. a symlinked node_modules), the file loads twice and would redefine its constants; keep
# the first.
return if defined?(AdaptyPodfile::SPECS_REPO)

module AdaptyPodfile
  SPECS_REPO = 'https://github.com/adaptyteam/AdaptySDK-CocoaPods-Specs.git'.freeze
  # The podspec's native SDK dependencies.
  PODS = %w[Adapty AdaptyUI AdaptyPlugin].freeze

  KIDS_MODE_CONDITION = 'KidsMode'.freeze
  ADAPTY_POD = 'Adapty'.freeze
  AD_SUPPORT = 'AdSupport'.freeze
  # `-framework` / `-weak_framework` AdSupport by exact name: `AdSupportKit` stays.
  AD_SUPPORT_FLAG = /[ \t]*-(?:weak_)?framework[ \t]+(?:"#{AD_SUPPORT}"|#{AD_SUPPORT}(?=\s|\z))/.freeze

  # The pods have no Kids Mode switch, so apply the SPM trait's effect by hand: the IDFA code is
  # guarded by the `KidsMode` compilation condition, and Adapty.podspec links AdSupport.
  def self.enable_kids_mode(installer)
    # Every variant of the pod (`Adapty-iOS15.0`, ...) is its own target, and with
    # generate_multiple_pod_projects it lives in a per-pod project, not in pods_project.
    labels = installer.pod_targets.select { |target| target.pod_name == ADAPTY_POD }.map(&:label)
    adapty_targets = Array(installer.generated_projects).flat_map(&:targets).select do |target|
      labels.include?(target.name)
    end
    if adapty_targets.empty?
      # Plain errors: CocoaPods wraps post_install errors into its own Informative.
      raise "[Adapty] Kids Mode NOT enabled: no #{ADAPTY_POD} target in the generated Pods projects. " \
            'Install @adapty/capacitor and run `npx cap sync ios`.'
    end

    # The aggregate and pod target xcconfigs carry other pods' frameworks too, so AdSupport can be
    # dropped only if no other pod declares it. Checked before any change.
    others = installer.pod_targets.select do |target|
      target.pod_name != ADAPTY_POD && target.spec_consumers.any? do |consumer|
        (consumer.frameworks + consumer.weak_frameworks).include?(AD_SUPPORT)
      end
    end.map(&:pod_name).uniq
    unless others.empty?
      raise "[Adapty] Kids Mode NOT enabled: #{AD_SUPPORT} would stay linked, also declared by " \
            "#{others.join(', ')}."
    end

    condition = "-D#{KIDS_MODE_CONDITION}"
    framework = "#{AD_SUPPORT}.framework"
    adapty_targets.each do |adapty|
      adapty.build_configurations.each do |config|
        flags = config.build_settings['OTHER_SWIFT_FLAGS'] || '$(inherited)'
        next if flags.include?(condition)

        config.build_settings['OTHER_SWIFT_FLAGS'] =
          flags.is_a?(Array) ? flags + [condition] : "#{flags} #{condition}"
      end
      adapty.frameworks_build_phase.files.dup.each do |file|
        adapty.frameworks_build_phase.remove_build_file(file) if file.display_name == framework
      end
    end
    # No save: CocoaPods writes the generated projects right after the post_install hooks.

    if unlink_ad_support(installer)
      Pod::UI.puts "[Adapty] Kids Mode enabled: #{condition} on the #{ADAPTY_POD} pod, #{AD_SUPPORT} unlinked"
    else
      Pod::UI.puts "[Adapty] Kids Mode enabled: #{condition} on the #{ADAPTY_POD} pod; no xcconfig listed #{AD_SUPPORT}"
    end
  end

  # Drops AdSupport from the xcconfig objects CocoaPods keeps in memory, so a later hook that
  # re-saves them cannot bring it back, and from the files, edited in place to keep what earlier
  # hooks wrote there. Returns whether anything listed it.
  def self.unlink_ad_support(installer)
    configs = installer.aggregate_targets.flat_map { |target| target.xcconfigs.values } +
              installer.pod_targets.flat_map { |target| target.build_settings.values.map(&:xcconfig) }
    in_memory = configs.count do |config|
      [config.frameworks, config.weak_frameworks].map { |names| names.delete?(AD_SUPPORT) }.any?
    end
    # Pathname#glob: brackets or braces in the project path are not read as patterns.
    on_disk = installer.sandbox.target_support_files_root.glob('**/*.xcconfig').count do |path|
      contents = path.read
      stripped = contents.gsub(AD_SUPPORT_FLAG, '')
      path.write(stripped) unless stripped == contents
      stripped != contents
    end
    in_memory + on_disk > 0
  end
end

# Pins the native SDK pods to the spec repo; the podspec sets their version. The pins keep the
# implicit trunk of a Podfile with no top-level `source`. The pods' own dependencies (AdaptyLogger
# etc.) are not pinned: they resolve from trunk and the spec repo, trunk winning on an equal
# version. Runs as a Podfile DSL method, like `use_frameworks!`; pods the target already declares
# are left as they are.
def adapty_pods!
  declared = current_target_definition.dependencies.map(&:root_name)
  (AdaptyPodfile::PODS - declared).each { |name| pod name, :source => AdaptyPodfile::SPECS_REPO }
end

# Sets the `KidsMode` compilation condition (OTHER_SWIFT_FLAGS `-DKidsMode`) on the Adapty pod,
# which compiles out all IDFA / AdSupport / AppTrackingTransparency code, and unlinks AdSupport,
# which that pod declares explicitly. Verify: `kids_mode_enabled: true` in the activate log.
#
# Raises in the cases it detects: no Adapty pod target, or another pod declaring AdSupport too,
# which would keep it linked. Must run in post_install: from post_integrate the project edits are
# never saved (no error).
def adapty_enable_kids_mode(installer)
  AdaptyPodfile.enable_kids_mode(installer)
end
