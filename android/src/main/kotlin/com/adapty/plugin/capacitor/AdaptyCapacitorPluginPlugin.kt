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
    }

    @PluginMethod
    fun handleMethodCall(call: PluginCall) {
        val methodName = call.getString("methodName") ?: run {
            call.reject("methodName is required")
            return
        }
        
        val args = call.getString("args") ?: ""
        
        implementation.handleMethodCall(methodName, args) { response ->
            if (response != null) {
                try {
                    val responseJson = JSONObject(response)
                    if (responseJson.has("error")) {
                        call.reject(responseJson.getString("error"))
                    } else {
                        // Convert JSONObject to JSObject
                        val result = JSObject()
                        for (key in responseJson.keys()) {
                            result.put(key, responseJson.get(key))
                        }
                        call.resolve(result)
                    }
                } catch (e: Exception) {
                    // If response is not JSON, return as string
                    val result = JSObject()
                    result.put("result", response)
                    call.resolve(result)
                }
            } else {
                call.resolve()
            }
        }
    }
} 