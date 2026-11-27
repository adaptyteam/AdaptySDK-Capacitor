package com.example.plugin.customelements

import kotlin.math.min

// Pulse timeline position in 0..1: wraps when looping, otherwise stops at the end.
fun pulseProgress(elapsedMs: Long, durationMs: Long, loop: Boolean): Float {
  if (durationMs <= 0) return 0f
  val elapsed = elapsedMs.coerceAtLeast(0)
  val position = if (loop) elapsed % durationMs else min(elapsed, durationMs)
  return position.toFloat() / durationMs
}
