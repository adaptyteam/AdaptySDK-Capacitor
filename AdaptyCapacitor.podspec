require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
# `repository.url` is npm's `git+https://...` form.
repository = package['repository']['url'].delete_prefix('git+')

# The native SDK version of the pods published to the AdaptySDK-CocoaPods-Specs spec repo, which
# the app's Podfile has to reach (`adapty_pods!` in ios/adapty_podfile.rb). Package.swift pins the
# same version for Swift Package Manager.
adapty_ios_version = '4.4.1'

# Read only by Capacitor apps on CocoaPods (`npx cap add ios --packagemanager CocoaPods`);
# SPM apps use Package.swift.
Pod::Spec.new do |s|
  s.name = 'AdaptyCapacitor'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = repository.delete_suffix('.git')
  s.author = package['author']
  s.source = { :git => repository, :tag => "v#{s.version}" }
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.dependency 'Adapty', adapty_ios_version
  s.dependency 'AdaptyUI', adapty_ios_version
  s.dependency 'AdaptyPlugin', adapty_ios_version
  s.swift_version = '5.1'
end
