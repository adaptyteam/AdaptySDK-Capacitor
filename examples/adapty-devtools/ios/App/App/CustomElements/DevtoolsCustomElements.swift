import AdaptyUI
import AdaptyUIBuilder
import OSLog
import SwiftUI
import UIKit

private let logger = Logger(subsystem: "io.adapty.devtools", category: "CustomElements")

// App-side content for the `custom` elements of the UIBuilder gallery's custom-elements bundles
// (Adapty internal). `checkout_widget` is left unserved on purpose.
@MainActor
enum DevtoolsCustomElements {
    // Log keys already written, so each is logged once per process
    static var seen = Set<String>()

    static func register() {
        AdaptyUI.setCustomElementsResolver(DevtoolsResolver())
    }

    static func logOnce(type: String, id: String, served: Bool) {
        guard seen.insert("resolve\u{1F}\(type)\u{1F}\(id)").inserted else { return }
        logger.info(
            "resolve type=\(type, privacy: .public) id=\(id, privacy: .public) served=\(served, privacy: .public)"
        )
    }

    static func logPayloadOnce(id: String, payload: String?) {
        #if DEBUG
        guard seen.insert("payload\u{1F}\(id)").inserted else { return }
        let escaped = payload.map { String(reflecting: $0) } ?? "null"
        logger.info("review_card id=\(id, privacy: .public) payload=\(escaped, privacy: .public)")
        #endif
    }
}

struct DevtoolsResolver: AdaptyUICustomElementsResolver {
    func view(
        forType type: String,
        id: String,
        context: AdaptyUICustomElementContext
    ) -> AnyView? {
        let view: AnyView?
        switch type {
        case "review_card": view = AnyView(ReviewCard(context: context, id: id))
        case "store_map": view = AnyView(StoreMap(context: context))
        case "star_rating": view = AnyView(StarRating(context: context))
        case "lottie_badge": view = AnyView(LottieBadge(context: context))
        case "link_probe": view = AnyView(LinkProbe(context: context))
        // Same rule as Android: the id picks the form, `_uikit` is the UIKit one
        case "text_input":
            view = id.hasSuffix("_uikit")
                ? AnyView(UIKitTextInput(placeholder: context.attributedString("placeholder").map { String($0.characters) }))
                : AnyView(TextInput(context: context))
        default: view = nil
        }
        DevtoolsCustomElements.logOnce(type: type, id: id, served: view != nil)
        return view.map {
            AnyView($0.accessibilityElement(children: .contain).accessibilityIdentifier("ce-\(type)-\(id)"))
        }
    }
}

private let mono = Font.system(size: 11, design: .monospaced)

private func number(_ value: Any?) -> NSNumber? { value as? NSNumber }

// MARK: - review_card

// assets (image + colour), strings (textView + attributedString), bindings, payloadDictionary, payloadJsonString.
private struct ReviewCard: View {
    let context: AdaptyUICustomElementContext
    let id: String

    var body: some View {
        let accent: Color = {
            if case let .color(c) = context.asset("accent") { return c }
            return .gray
        }()
        let payload = context.payloadDictionary
        let rating = min(max(number(payload?["rating"])?.intValue ?? 0, 0), 5)
        let tags = (payload?["tags"] as? [Any])?.compactMap { $0 as? String } ?? []
        let country = (payload?["author"] as? [String: Any])?["country"] as? String
        let payloadString = context.payloadJsonString
        let highlighted = context.variableValue(String.self, byKey: "highlighted")

        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                if let avatar = context.imageView("avatar") {
                    avatar.scaledToFill().frame(width: 48, height: 48).clipShape(Circle())
                }
                VStack(alignment: .leading) {
                    if let author = context.textView("author") { author }
                    Text(String(repeating: "★", count: rating) + String(repeating: "☆", count: 5 - rating) + (country.map { "  \($0)" } ?? ""))
                        .foregroundColor(accent)
                }
            }
            if let body = context.attributedString("body") {
                Text(body).font(.system(size: 14))
            }
            if !tags.isEmpty {
                HStack(spacing: 6) {
                    ForEach(Array(tags.enumerated()), id: \.offset) { _, tag in
                        Text(tag)
                            .font(.system(size: 11))
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(accent, in: RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
            Text("highlighted: \(highlighted ?? "null")").font(mono).foregroundColor(.secondary)
            #if DEBUG
            Text("payload: \(payloadString ?? "null")").font(mono).foregroundColor(.secondary)
            #endif
        }
        .onAppear { DevtoolsCustomElements.logPayloadOnce(id: id, payload: payloadString) }
    }
}

// MARK: - store_map

// test implementation: a Canvas grid stands in for a map; use MapKit / Google Maps in a real app
// Bindings are re-read on every build; the camera is local state set once and moved only by
// dragging, so the marker follows the flow while the camera stays where the user left it.
private struct StoreMap: View {
    let context: AdaptyUICustomElementContext
    @State private var camera: CGPoint?
    @State private var dragStart: CGPoint?
    // Matches Android's 0.0005°/px at ~3x density, so a ±0.1° move stays inside the map.
    private let degreesPerPt: CGFloat = 0.0015

    var body: some View {
        let lat = context.variableValue(Double.self, byKey: "lat") ?? 0
        let lon = context.variableValue(Double.self, byKey: "lon") ?? 0
        let cam = camera ?? CGPoint(x: lon, y: lat)

        ZStack {
            Color(red: 0xE8 / 255, green: 0xEE / 255, blue: 0xF2 / 255)
            Canvas { ctx, size in
                let step = 0.01 / degreesPerPt
                let originX = size.width / 2 - cam.x / degreesPerPt
                let originY = size.height / 2 + cam.y / degreesPerPt
                var grid = Path()
                var x = originX.truncatingRemainder(dividingBy: step)
                while x < size.width {
                    grid.move(to: CGPoint(x: x, y: 0))
                    grid.addLine(to: CGPoint(x: x, y: size.height))
                    x += step
                }
                var y = originY.truncatingRemainder(dividingBy: step)
                while y < size.height {
                    grid.move(to: CGPoint(x: 0, y: y))
                    grid.addLine(to: CGPoint(x: size.width, y: y))
                    y += step
                }
                ctx.stroke(grid, with: .color(Color(red: 0xC9 / 255, green: 0xD3 / 255, blue: 0xDA / 255)), lineWidth: 1)
                let marker = CGPoint(
                    x: size.width / 2 + (CGFloat(lon) - cam.x) / degreesPerPt,
                    y: size.height / 2 - (CGFloat(lat) - cam.y) / degreesPerPt
                )
                ctx.fill(
                    Path(ellipseIn: CGRect(x: marker.x - 12, y: marker.y - 12, width: 24, height: 24)),
                    with: .color(Color(red: 0xE5 / 255, green: 0x39 / 255, blue: 0x35 / 255))
                )
                ctx.fill(Path(ellipseIn: CGRect(x: marker.x - 4, y: marker.y - 4, width: 8, height: 8)), with: .color(.white))
            }
            VStack {
                HStack {
                    if let title = context.attributedString("title") {
                        Text(title).fontWeight(.semibold).padding(8)
                    }
                    Spacer()
                }
                Spacer()
                HStack {
                    Spacer()
                    Text(String(format: "%.4f, %.4f", locale: Locale(identifier: "en_US_POSIX"), lat, lon))
                        .font(mono)
                        .padding(4)
                        .background(Color.white.opacity(0.8))
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 160)
        .clipped()
        .contentShape(Rectangle())
        .gesture(
            DragGesture()
                .onChanged { g in
                    let start = dragStart ?? cam
                    dragStart = start
                    camera = CGPoint(
                        x: start.x - g.translation.width * degreesPerPt,
                        y: start.y + g.translation.height * degreesPerPt
                    )
                }
                .onEnded { _ in dragStart = nil }
        )
        .onAppear { if camera == nil { camera = CGPoint(x: lon, y: lat) } }
    }
}

// MARK: - star_rating

// sendMessage + payloadDictionary + isEnabled.
private struct StarRating: View {
    let context: AdaptyUICustomElementContext
    @State private var selected = 0
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        let maxStars = min(max(number(context.payloadDictionary?["maxStars"])?.intValue ?? 5, 1), 10)
        HStack(spacing: 4) {
            ForEach(1 ... maxStars, id: \.self) { star in
                Text(star <= selected ? "★" : "☆")
                    .font(.system(size: 32))
                    .foregroundColor(isEnabled ? Color(red: 1, green: 0xB3 / 255, blue: 0) : .gray)
                    .onTapGesture {
                        guard isEnabled else { return }
                        selected = star
                        context.sendMessage(["value": star])
                    }
            }
        }
    }
}

// MARK: - lottie_badge

// test implementation: a hand-parsed one-layer Lottie; use lottie-ios / lottie-compose in a real app
// Data asset delivery. The app carries no Lottie runtime, so it reads the timeline and the fill
// colour of the single-layer pulse from the bytes and animates a circle with them.
private struct LottieBadge: View {
    let context: AdaptyUICustomElementContext

    var body: some View {
        if case let .data(a) = context.asset("animation"), a.format == "lottie" {
            let payload = context.payloadDictionary
            let speed = number(payload?["speed"])?.doubleValue ?? 1
            LottieBadgeBody(
                asset: a,
                pulse: a.value.flatMap(LottiePulse.parse),
                loop: payload?["loop"] as? Bool ?? true,
                speed: speed > 0 && speed.isFinite ? speed : 1,
                playing: context.variableValue(Bool.self, byKey: "playing") ?? true
            )
            // Identity follows the bytes, so a new animation starts its clock from zero
            .id(a.value)
        } else {
            Text("no lottie data asset").font(mono).foregroundColor(.red)
        }
    }
}

private struct LottieBadgeBody: View {
    let asset: AdaptyUIDataAsset
    let pulse: LottiePulse?
    let loop: Bool
    let speed: Double
    let playing: Bool

    // Timeline time banked by earlier play runs (scaled by speed) and the start of the current run;
    // pausing banks the run, so the frame is kept and resume continues from it
    @State private var banked: TimeInterval = 0
    @State private var runStart: Date?
    // Set once a play-once run reaches its end, so the timeline stops ticking on the final frame
    @State private var finished = false

    var body: some View {
        VStack {
            TimelineView(.animation(minimumInterval: nil, paused: !playing || pulse == nil || (!loop && finished))) { tl in
                ZStack {
                    if let pulse {
                        let e = elapsed(at: tl.date)
                        let t = pulseProgress(elapsed: e, duration: pulse.duration, loop: loop)
                        Circle()
                            .fill(pulse.color)
                            .frame(width: 48, height: 48)
                            .scaleEffect(pulse.lerpScale(t))
                            .opacity(min(max(pulse.lerpOpacity(t), 0), 1))
                            .onChange(of: !loop && e >= pulse.duration) { done in if done { finished = true } }
                    }
                }
                .frame(width: 96, height: 96)
            }
            Text("value: \(asset.value.map { "\($0.count) B" } ?? "-") · url: \(urlCaption) · \(playing ? "playing" : "paused")")
                .font(mono)
        }
        .onAppear { if playing, runStart == nil { runStart = Date() } }
        .onChange(of: playing) { isPlaying in
            if isPlaying {
                runStart = Date()
            } else if let start = runStart {
                banked += Date().timeIntervalSince(start) * speed
                runStart = nil
            }
        }
    }

    // Full URL in debug builds only; release shows the host
    private var urlCaption: String {
        #if DEBUG
        asset.url?.absoluteString ?? "-"
        #else
        asset.url?.host ?? "-"
        #endif
    }

    private func elapsed(at date: Date) -> TimeInterval {
        banked + (runStart.map { max(date.timeIntervalSince($0), 0) * speed } ?? 0)
    }
}

// Pulse timeline position in 0...1: wraps when looping, otherwise stops at the end.
private func pulseProgress(elapsed: TimeInterval, duration: TimeInterval, loop: Bool) -> Double {
    guard duration > 0 else { return 0 }
    let e = max(elapsed, 0)
    let position = loop ? e.truncatingRemainder(dividingBy: duration) : min(e, duration)
    return position / duration
}

private struct LottiePulse {
    let frameRate: Double
    let frames: Double
    let scale: (Double, Double)
    let opacity: (Double, Double)
    let color: Color

    var duration: TimeInterval { frameRate > 0 ? frames / frameRate : 0 }
    func lerpScale(_ t: Double) -> Double { (scale.0 + (scale.1 - scale.0) * t) / 100 }
    func lerpOpacity(_ t: Double) -> Double { (opacity.0 + (opacity.1 - opacity.0) * t) / 100 }

    static func parse(_ data: Data) -> LottiePulse? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let fr = number(json["fr"])?.doubleValue,
            let ip = number(json["ip"])?.doubleValue,
            let op = number(json["op"])?.doubleValue,
            let layer = (json["layers"] as? [[String: Any]])?.first,
            let ks = layer["ks"] as? [String: Any],
            let s = keyframes(ks, "s"),
            let o = keyframes(ks, "o")
        else { return nil }

        var color = Color.black
        let items = ((layer["shapes"] as? [[String: Any]])?.first?["it"] as? [[String: Any]]) ?? []
        for item in items where item["ty"] as? String == "fl" {
            if let c = (item["c"] as? [String: Any])?["k"] as? [NSNumber], c.count >= 3 {
                color = Color(red: c[0].doubleValue, green: c[1].doubleValue, blue: c[2].doubleValue)
            }
        }
        return LottiePulse(frameRate: fr, frames: op - ip, scale: s, opacity: o, color: color)
    }

    private static func keyframes(_ ks: [String: Any], _ key: String) -> (Double, Double)? {
        guard
            let k = (ks[key] as? [String: Any])?["k"] as? [[String: Any]],
            let first = number((k.first?["s"] as? [Any])?.first)?.doubleValue,
            let last = number((k.last?["s"] as? [Any])?.first)?.doubleValue
        else { return nil }
        return (first, last)
    }
}

// MARK: - text_input

private struct TextInput: View {
    let context: AdaptyUICustomElementContext
    @State private var text = ""

    var body: some View {
        TextField("", text: $text, prompt: context.attributedString("placeholder").map { Text($0) })
            .textFieldStyle(.roundedBorder)
            .frame(maxWidth: .infinity)
    }
}

private struct UIKitTextInput: UIViewRepresentable {
    let placeholder: String?

    func makeUIView(context _: Context) -> UITextField {
        let field = UITextField()
        field.borderStyle = .roundedRect
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return field
    }

    func updateUIView(_ field: UITextField, context: Context) {
        field.placeholder = placeholder
        // SwiftUI's .disabled reaches UIKit only through the environment
        field.isEnabled = context.environment.isEnabled
    }
}

// MARK: - link_probe

// Which openURL gets a link tapped inside a custom element; payload `overrideOpenURL` makes the
// app wrap the element in its own recording OpenURLAction.
private let probeURL = URL(string: "https://adapty.io")!

private struct LinkProbe: View {
    let context: AdaptyUICustomElementContext
    @State private var got: [String] = []

    var body: some View {
        let override = context.payloadDictionary?["overrideOpenURL"] as? Bool == true
        if override {
            LinkProbeBody(context: context, got: got, override: true)
                .environment(\.openURL, OpenURLAction { url in
                    logger.debug("app handler got \(url.absoluteString, privacy: .public)")
                    got.append(url.absoluteString)
                    return .systemAction
                })
        } else {
            LinkProbeBody(context: context, got: got, override: false)
        }
    }
}

private struct LinkProbeBody: View {
    let context: AdaptyUICustomElementContext
    let got: [String]
    let override: Bool
    @Environment(\.openURL) private var openURL
    @State private var openStatus = "not tapped"

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let caption = context.textView("caption") { caption }
            HStack(spacing: 0) {
                Text("Link: ")
                Link("adapty.io", destination: probeURL)
            }
            hint("hint_link")
            Button {
                openURL(probeURL) { accepted in
                    openStatus = accepted ? "accepted" : "rejected"
                    logger.debug("openURL \(accepted ? "accepted" : "rejected", privacy: .public)")
                }
            } label: {
                Text("openURL(adapty.io)")
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color(red: 0x58 / 255, green: 0x56 / 255, blue: 0xD6 / 255), in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            Text("openURL: \(openStatus)").font(.system(size: 12, design: .monospaced))
            hint("hint_open_url")
            if let link = context.textView("link") { link }
            hint("hint_text_view")
            if override {
                Text("App handler got: \(got.last ?? "-") (\(got.count))").font(.system(size: 12, design: .monospaced))
            }
        }
    }

    @ViewBuilder
    private func hint(_ id: String) -> some View {
        if let view = context.textView(id) { view.padding(.bottom, 6) }
    }
}
