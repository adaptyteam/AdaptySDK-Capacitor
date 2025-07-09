package com.adapty.plugin.capacitor

import android.content.Context
import android.util.Log
import com.adapty.internal.crossplatform.CrossplatformHelper
import com.adapty.utils.FileLocation

class AdaptyCapacitorPluginKt {
    private val crossplatformHelper by lazy {
        CrossplatformHelper.shared
    }

    fun initialize(context: Context) {
        CrossplatformHelper.init(
            context,
            { eventName, eventData ->
                // For Capacitor, we'll handle events differently than React Native
                // This callback is for native events, currently not used in our implementation
                Log.d("AdaptyCapacitor", "Event received: $eventName")
            },
            { value -> 
                // Return FileLocation based on the value - for now use empty asset as stub
                // This will be handled properly when we implement file location functionality
                FileLocation.fromAsset("")
            }
        )
    }

    fun handleMethodCall(methodName: String, args: String, callback: (String?) -> Unit) {
        try {
            crossplatformHelper.onMethodCall(args, methodName) { response ->
                callback(response)
            }
        } catch (e: Exception) {
            Log.e("AdaptyCapacitor", "Exception during method call: ${e.message}")
            callback(null)
        }
    }
}
