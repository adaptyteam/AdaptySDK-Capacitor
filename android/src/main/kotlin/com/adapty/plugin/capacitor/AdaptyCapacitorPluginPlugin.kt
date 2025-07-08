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

    @PluginMethod
    fun activate(call: PluginCall) {
        val apiKey = call.getString("apiKey")
        val params = call.getObject("params")

        if (apiKey == null || apiKey.isEmpty()) {
            call.reject("API key is required")
            return
        }

        try {
            // Convert JSObject to JSONObject
            val configuration = JSONObject()
            if (params != null) {
                for (key in params.keys()) {
                    val value = params.get(key)
                    configuration.put(key, value)
                }
            }
            
            implementation.activate(context, apiKey, configuration) { error ->
                if (error != null) {
                    call.reject("Failed to activate Adapty: $error")
                } else {
                    call.resolve()
                }
            }
        } catch (e: Exception) {
            Log.e("AdaptyCapacitor", "Exception during activation", e)
            call.reject("Failed to activate Adapty: ${e.message}")
        }
    }

    @PluginMethod
    fun isActivated(call: PluginCall) {
        val ret = JSObject()
        ret.put("isActivated", implementation.isActivated())
        call.resolve(ret)
    }
} 