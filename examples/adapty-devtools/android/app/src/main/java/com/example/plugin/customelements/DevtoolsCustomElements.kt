package com.example.plugin.customelements

import android.net.Uri
import android.util.Log
import android.widget.EditText
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.adapty.ui.AdaptyCustomElementContent
import com.adapty.ui.AdaptyCustomElementContext
import com.adapty.ui.AdaptyCustomElementsResolver
import com.adapty.ui.AdaptyUI
import com.adapty.ui.AdaptyUiAsset
import com.example.plugin.BuildConfig
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import org.json.JSONObject

private const val TAG = "AdaptyDevtools"

// App-side content for the `custom` elements of the UIBuilder gallery's custom-elements bundles
// (Adapty internal). `checkout_widget` is left unserved on purpose.
object DevtoolsCustomElements {
  // Log keys already written, so each (type, id) is logged once per process
  private val seen: MutableSet<String> = ConcurrentHashMap.newKeySet()

  fun select(type: String, id: String): AdaptyCustomElementContent? =
    when (type) {
      "review_card" -> AdaptyCustomElementContent.compose { ReviewCard(it, id) }
      "store_map" -> AdaptyCustomElementContent.compose { StoreMap(it) }
      "star_rating" -> AdaptyCustomElementContent.compose { StarRating(it) }
      "lottie_badge" -> AdaptyCustomElementContent.compose { LottieBadge(it) }
      "link_probe" -> AdaptyCustomElementContent.compose { LinkProbe(it) }
      // The resolver gets no context, so the id picks the form: `_uikit` is the View form
      "text_input" ->
        if (id.endsWith("_uikit")) {
          AdaptyCustomElementContent.view(
            factory = { viewContext, _ -> EditText(viewContext).apply { isSingleLine = true } },
            // Re-runs on updates, so the placeholder stays live; the same EditText keeps typed text
            update = { view, context ->
              (view as EditText).hint = context.text("placeholder")
              view.isEnabled = context.isEnabled
            },
          )
        } else {
          AdaptyCustomElementContent.compose { TextInput(it) }
        }
      else -> null
    }

  fun register() {
    AdaptyUI.setCustomElementsResolver(
      AdaptyCustomElementsResolver { t, i -> select(t, i).also { logOnce(t, i, it != null) } },
    )
  }

  private fun logOnce(type: String, id: String, served: Boolean) {
    if (seen.add("resolve\u001F$type\u001F$id")) Log.i(TAG, "resolve type=$type id=$id served=$served")
  }

  internal fun logPayloadOnce(id: String, payload: String?) {
    if (BuildConfig.DEBUG && seen.add("payload\u001F$id")) {
      Log.i(TAG, "review_card id=$id payload=${payload?.let(JSONObject::quote) ?: "null"}")
    }
  }
}

private val Mono = FontFamily.Monospace

// assets (image + colour), strings (textContent + annotatedString), bindings, payloadMap, payloadString.
@Composable
private fun ReviewCard(context: AdaptyCustomElementContext, id: String) {
  val accent = (context.asset("accent") as? AdaptyUiAsset.Color)?.let { Color(it.value) } ?: Color.Gray
  val payload = context.payloadMap
  val rating = clampPayloadInt(payload?.get("rating"), default = 0, min = 0, max = 5)
  val tags = (payload?.get("tags") as? List<*>)?.filterIsInstance<String>().orEmpty()
  val country = (payload?.get("author") as? Map<*, *>)?.get("country") as? String
  val payloadString = context.payloadString
  LaunchedEffect(id) { DevtoolsCustomElements.logPayloadOnce(id, payloadString) }

  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      context.imageContent("avatar")?.invoke(Modifier.size(48.dp).clip(CircleShape))
      Column {
        context.textContent("author")?.invoke(Modifier)
        Text("★".repeat(rating) + "☆".repeat(5 - rating) + (country?.let { "  $it" } ?: ""), color = accent)
      }
    }
    context.annotatedString("body")?.let { Text(it, fontSize = 14.sp) }
    if (tags.isNotEmpty()) {
      Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        tags.forEach { tag ->
          Text(
            tag,
            fontSize = 11.sp,
            color = Color.White,
            modifier = Modifier.background(accent, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 2.dp),
          )
        }
      }
    }
    Text("highlighted: ${context.binding("highlighted", String::class.java)}", fontSize = 11.sp, fontFamily = Mono, color = Color.DarkGray)
    if (BuildConfig.DEBUG) Text("payload: $payloadString", fontSize = 11.sp, fontFamily = Mono, color = Color.DarkGray)
  }
}

// test implementation: a Canvas grid stands in for a map; use MapKit / Google Maps in a real app
// Bindings re-read on every recomposition; the camera is local state set once and moved only by
// panning, so the marker follows the flow while the camera stays where the user left it.
@Composable
private fun StoreMap(context: AdaptyCustomElementContext) {
  val lat = context.binding("lat", Double::class.java) ?: 0.0
  val lon = context.binding("lon", Double::class.java) ?: 0.0
  var camera by remember { mutableStateOf(Offset(lon.toFloat(), lat.toFloat())) }
  // Degrees per dp (as iOS per pt), converted with the density so the scale is density-independent
  val degreesPerDp = 0.0015f

  Box(
    Modifier
      .fillMaxWidth()
      .height(160.dp)
      // The marker can be panned off the canvas: keep it inside the map
      .clipToBounds()
      .background(Color(0xFFE8EEF2))
      .pointerInput(Unit) {
        val degreesPerPx = degreesPerDp / density
        detectDragGestures { change, drag ->
          change.consume()
          camera = Offset(camera.x - drag.x * degreesPerPx, camera.y + drag.y * degreesPerPx)
        }
      },
  ) {
    Canvas(Modifier.matchParentSize()) {
      val degreesPerPx = degreesPerDp / density
      val grid = 0.01f
      val originX = size.width / 2 - camera.x / degreesPerPx
      val originY = size.height / 2 + camera.y / degreesPerPx
      val step = grid / degreesPerPx
      var x = originX % step
      while (x < size.width) {
        drawLine(Color(0xFFC9D3DA), Offset(x, 0f), Offset(x, size.height), 1.dp.toPx())
        x += step
      }
      var y = originY % step
      while (y < size.height) {
        drawLine(Color(0xFFC9D3DA), Offset(0f, y), Offset(size.width, y), 1.dp.toPx())
        y += step
      }
      val marker = Offset(
        size.width / 2 + (lon.toFloat() - camera.x) / degreesPerPx,
        size.height / 2 - (lat.toFloat() - camera.y) / degreesPerPx,
      )
      drawCircle(Color(0xFFE53935), radius = 12.dp.toPx(), center = marker)
      drawCircle(Color.White, radius = 4.dp.toPx(), center = marker)
    }
    context.annotatedString("title")?.let {
      Text(it, fontWeight = FontWeight.SemiBold, modifier = Modifier.align(Alignment.TopStart).padding(8.dp))
    }
    Text(
      String.format(Locale.US, "%.4f, %.4f", lat, lon),
      fontSize = 11.sp,
      fontFamily = Mono,
      modifier = Modifier.align(Alignment.BottomEnd).background(Color.White.copy(alpha = 0.8f)).padding(4.dp),
    )
  }
}

// send() + payloadMap + isEnabled.
@Composable
private fun StarRating(context: AdaptyCustomElementContext) {
  val maxStars = clampPayloadInt(context.payloadMap?.get("maxStars"), default = 5, min = 1, max = 10)
  var selected by remember { mutableStateOf(0) }
  Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    for (star in 1..maxStars) {
      Text(
        if (star <= selected) "★" else "☆",
        fontSize = 32.sp,
        color = if (context.isEnabled) Color(0xFFFFB300) else Color.Gray,
        modifier = Modifier.clickable(enabled = context.isEnabled) {
          selected = star
          context.send(mapOf("value" to star))
        },
      )
    }
  }
}

// Content-equality key for remember: a hash collision alone never reuses the old pulse and clock
private class AssetContent(val bytes: ByteArray) {
  override fun equals(other: Any?) = other is AssetContent && bytes.contentEquals(other.bytes)
  override fun hashCode() = bytes.contentHashCode()
}

// test implementation: a hand-parsed one-layer Lottie; use lottie-ios / lottie-compose in a real app
// Data asset delivery. The app carries no Lottie runtime, so it reads the timeline and the fill
// colour of the single-layer pulse from the bytes and animates a circle with them.
@Composable
private fun LottieBadge(context: AdaptyCustomElementContext) {
  val asset = context.asset("animation") as? AdaptyUiAsset.Data
  if (asset == null || asset.format != "lottie") {
    Text("no lottie data asset", fontFamily = Mono, color = Color.Red)
    return
  }
  val bytes = asset.value
  // Keyed by content, not array identity: a new animation restarts the clock, a re-delivered copy doesn't
  val source = bytes?.let(::AssetContent)
  val pulse = remember(source) { bytes?.let { runCatching { LottiePulse.parse(JSONObject(String(it))) }.getOrNull() } }
  val payload = context.payloadMap
  val loop = payload?.get("loop") as? Boolean ?: true
  val speed = (payload?.get("speed") as? Number)?.toFloat()?.takeIf { it > 0f && it.isFinite() } ?: 1f
  val playing = context.binding("playing", Boolean::class.java) ?: true
  // Full URL in debug builds only; release shows the host
  val url = asset.url?.let { if (BuildConfig.DEBUG) it else Uri.parse(it).host ?: "-" } ?: "-"

  // Elapsed timeline time, scaled by speed: frozen while paused, continued on resume
  var elapsedNanos by remember(source) { mutableLongStateOf(0L) }
  val durationMs = pulse?.let { (it.frames / it.frameRate * 1000).toLong() } ?: 0L
  LaunchedEffect(playing, pulse, speed, loop) {
    if (!playing || pulse == null || durationMs <= 0) return@LaunchedEffect
    var last = withFrameNanos { it }
    while (loop || elapsedNanos < durationMs * 1_000_000) {
      withFrameNanos { now ->
        elapsedNanos += ((now - last) * speed).toLong()
        last = now
      }
    }
  }
  val progress = pulseProgress(elapsedNanos / 1_000_000, durationMs, loop)

  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Box(Modifier.size(96.dp), contentAlignment = Alignment.Center) {
      if (pulse != null) {
        Box(
          Modifier
            .size(48.dp)
            .scale(pulse.lerpScale(progress))
            .alpha(pulse.lerpOpacity(progress).coerceIn(0f, 1f))
            .background(pulse.color, CircleShape),
        )
      }
    }
    Text(
      "value: ${bytes?.let { "${it.size} B" } ?: "-"} · url: $url · ${if (playing) "playing" else "paused"}",
      fontSize = 11.sp,
      fontFamily = Mono,
    )
  }
}

private class LottiePulse(
  val frameRate: Float,
  val frames: Float,
  val scale: Pair<Float, Float>,
  val opacity: Pair<Float, Float>,
  val color: Color,
) {
  fun lerpScale(t: Float) = (scale.first + (scale.second - scale.first) * t) / 100f
  fun lerpOpacity(t: Float) = (opacity.first + (opacity.second - opacity.first) * t) / 100f

  companion object {
    fun parse(json: JSONObject): LottiePulse {
      val layer = json.getJSONArray("layers").getJSONObject(0)
      val ks = layer.getJSONObject("ks")
      fun keyframes(key: String): Pair<Float, Float> {
        val k = ks.getJSONObject(key).getJSONArray("k")
        return k.getJSONObject(0).getJSONArray("s").getDouble(0).toFloat() to
          k.getJSONObject(k.length() - 1).getJSONArray("s").getDouble(0).toFloat()
      }
      val items = layer.getJSONArray("shapes").getJSONObject(0).getJSONArray("it")
      var color = Color.Black
      for (i in 0 until items.length()) {
        val item = items.getJSONObject(i)
        if (item.getString("ty") == "fl") {
          val c = item.getJSONObject("c").getJSONArray("k")
          color = Color(c.getDouble(0).toFloat(), c.getDouble(1).toFloat(), c.getDouble(2).toFloat())
        }
      }
      return LottiePulse(
        frameRate = json.getDouble("fr").toFloat(),
        frames = (json.getDouble("op") - json.getDouble("ip")).toFloat(),
        scale = keyframes("s"),
        opacity = keyframes("o"),
        color = color,
      )
    }
  }
}

@Composable
private fun TextInput(context: AdaptyCustomElementContext) {
  var text by remember { mutableStateOf("") }
  TextField(
    value = text,
    onValueChange = { text = it },
    placeholder = { context.annotatedString("placeholder")?.let { Text(it) } },
    singleLine = true,
    enabled = context.isEnabled,
    modifier = Modifier.fillMaxWidth(),
  )
}

// Which UriHandler gets a link tapped inside a custom element; payload `overrideOpenURL` makes the
// app wrap the element in its own recording UriHandler.
private const val PROBE_URL = "https://adapty.io"

@Composable
private fun LinkProbe(context: AdaptyCustomElementContext) {
  val override = context.payloadMap?.get("overrideOpenURL") == true
  val system = LocalUriHandler.current
  val got = remember { mutableStateOf(listOf<String>()) }
  if (override) {
    val handler = remember(system) {
      object : UriHandler {
        override fun openUri(uri: String) {
          Log.d(TAG, "app handler got $uri")
          got.value = got.value + uri
          system.openUri(uri)
        }
      }
    }
    CompositionLocalProvider(LocalUriHandler provides handler) { LinkProbeBody(context, got.value, override) }
  } else {
    LinkProbeBody(context, got.value, override)
  }
}

@Composable
private fun LinkProbeBody(context: AdaptyCustomElementContext, got: List<String>, override: Boolean) {
  val uriHandler = LocalUriHandler.current
  var openStatus by remember { mutableStateOf("not tapped") }
  val hint = Modifier.padding(bottom = 6.dp)
  Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    context.textContent("caption")?.invoke(Modifier)
    Text(
      buildAnnotatedString {
        append("Link: ")
        withLink(LinkAnnotation.Url(PROBE_URL, TextLinkStyles(SpanStyle(color = Color(0xFF007AFF), textDecoration = TextDecoration.Underline)))) {
          append("adapty.io")
        }
      },
    )
    context.textContent("hint_link")?.invoke(hint)
    Text(
      "openUri(adapty.io)",
      color = Color.White,
      modifier = Modifier.background(Color(0xFF5856D6), RoundedCornerShape(8.dp)).clickable {
        openStatus = try {
          uriHandler.openUri(PROBE_URL)
          "accepted"
        } catch (e: Exception) {
          "rejected: ${e.javaClass.simpleName}"
        }
        Log.d(TAG, "openUri $openStatus")
      }.padding(horizontal = 10.dp, vertical = 6.dp),
    )
    Text("openUri: $openStatus", fontFamily = Mono, fontSize = 12.sp)
    context.textContent("hint_open_url")?.invoke(hint)
    context.textContent("link")?.invoke(Modifier)
    context.textContent("hint_text_view")?.invoke(hint)
    if (override) Text("App handler got: ${got.lastOrNull() ?: "-"} (${got.size})", fontFamily = Mono, fontSize = 12.sp)
  }
}

// Clamps before narrowing so huge integral values don't wrap; fractions truncate toward zero.
internal fun clampPayloadInt(value: Any?, default: Int, min: Int, max: Int): Int {
  val number = value as? Number ?: return default.coerceIn(min, max)
  return when (number) {
    is Double, is Float -> number.toDouble().toInt().coerceIn(min, max)
    else -> number.toLong().coerceIn(min.toLong(), max.toLong()).toInt()
  }
}
