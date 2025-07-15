package com.adapty.plugin.capacitor

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import android.util.Log

@CapacitorPlugin(name = "AdaptyCapacitorPlugin")
class AdaptyCapacitorPluginPlugin : Plugin() {

    private val implementation = AdaptyCapacitorPluginKt()

    override fun load() {
        super.load()
        // Initialize crossplatform helper on plugin load
        implementation.initialize(context)

        // Set activity from Capacitor plugin to adapty provider
        implementation.setActivityProvider { activity }
    }

    @PluginMethod
    fun handleMethodCall(call: PluginCall) {
        val methodName = call.getString("methodName") ?: run {
            call.reject("methodName is required")
            return
        }

        val args = call.getString("args").orEmpty()

        implementation.handleMethodCall(methodName, args) { response ->
            // Return response as string directly
            val result = JSObject()
            result.put("crossPlatformJson", response)
            call.resolve(result)
        }
    }
}
