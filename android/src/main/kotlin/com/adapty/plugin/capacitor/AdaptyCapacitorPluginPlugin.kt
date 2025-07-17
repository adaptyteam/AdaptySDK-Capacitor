package com.adapty.plugin.capacitor

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import android.util.Log

@CapacitorPlugin(name = "AdaptyCapacitorPlugin")
class AdaptyCapacitorPluginPlugin : Plugin() {

    private val implementation = AdaptyCapacitorPluginKt()

    override fun load() {
        super.load()
        // Set activity from Capacitor plugin to adapty provider
        implementation.setActivityProvider { activity }

        // Initialize crossplatform helper with event callback
        implementation.initialize(context) { eventName, eventData ->
            handleNativeEvent(eventName, eventData)
        }
    }

    private fun handleNativeEvent(eventName: String, eventData: String) {
        Log.d("AdaptyCapacitor", "Received native event: $eventName")
        
        try {
            val eventObj = JSObject()
            
            eventObj.put("data", eventData)
            
            // Send event through Capacitor bridge
            notifyListeners(eventName, eventObj)
            Log.d("AdaptyCapacitor", "Event forwarded to bridge: $eventName")
        } catch (e: Exception) {
            Log.e("AdaptyCapacitor", "Failed to handle native event $eventName: ${e.message}", e)
        }
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
