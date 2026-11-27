package com.example.plugin.customelements

import com.adapty.ui.AdaptyCustomElementContent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DevtoolsCustomElementsTest {
  @Test fun servesTheSixGalleryTypes() =
    listOf("review_card", "store_map", "star_rating", "lottie_badge", "link_probe", "text_input")
      .forEach { assertNotNull(it, DevtoolsCustomElements.select(it, "any")) }

  @Test fun leavesCheckoutWidgetUnserved() =
    assertNull(DevtoolsCustomElements.select("checkout_widget", "checkout_1"))

  @Test fun uikitSuffixPicksTheViewForm() {
    assertTrue(DevtoolsCustomElements.select("text_input", "custom_uikit") is AdaptyCustomElementContent.View)
    assertTrue(DevtoolsCustomElements.select("text_input", "custom_swiftui") is AdaptyCustomElementContent.Compose)
  }

  @Test fun loopWraps() = assertEquals(0.25f, pulseProgress(1250, 1000, loop = true), 1e-6f)

  @Test fun noLoopStopsAtTheEnd() = assertEquals(1f, pulseProgress(5000, 1000, loop = false), 1e-6f)

  @Test fun clampsPayloadNumbersBeforeNarrowing() {
    // 2^32 narrows to 0 and -(2^32 - 1) to 1, so clamping after toInt() would fail these
    assertEquals(5, clampPayloadInt(4294967296L, default = 0, min = 0, max = 5))
    assertEquals(0, clampPayloadInt(-4294967295L, default = 0, min = 0, max = 5))
    assertEquals(4, clampPayloadInt(4L, default = 0, min = 0, max = 5))
    assertEquals(0, clampPayloadInt(-3L, default = 0, min = 0, max = 5))
    assertEquals(4, clampPayloadInt(4.7, default = 0, min = 0, max = 5))
    assertEquals(10, clampPayloadInt(1e20, default = 5, min = 1, max = 10))
    assertEquals(5, clampPayloadInt("x", default = 5, min = 1, max = 10))
  }
}
