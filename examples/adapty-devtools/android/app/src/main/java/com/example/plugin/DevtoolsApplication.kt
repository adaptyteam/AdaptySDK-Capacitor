package com.example.plugin

import android.app.Application
import com.example.plugin.customelements.DevtoolsCustomElements

class DevtoolsApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    // Global resolver for flow custom elements; must be set before the first flow renders
    DevtoolsCustomElements.register()
  }
}
