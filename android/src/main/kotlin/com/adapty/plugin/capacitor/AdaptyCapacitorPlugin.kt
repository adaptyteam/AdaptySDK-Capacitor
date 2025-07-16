package com.adapty.plugin.capacitor

import android.content.Context
import android.util.Log
import com.adapty.internal.crossplatform.CrossplatformHelper
import com.adapty.utils.FileLocation

class AdaptyCapacitorPluginKt {
    private val crossplatformHelper by lazy {
        CrossplatformHelper.shared
    }

    private var activityProvider: (() -> android.app.Activity?)? = null
    private var eventCallback: ((String, String) -> Unit)? = null

    fun initialize(context: Context, eventCallback: ((String, String) -> Unit)? = null) {
        this.eventCallback = eventCallback
        
        CrossplatformHelper.init(
            context,
            { eventName, eventData ->
                Log.d("AdaptyCapacitor", "CrossplatformHelper event: $eventName")
                // Forward events to Capacitor bridge
                this.eventCallback?.invoke(eventName, eventData ?: "")
            },
            { value ->
                // Return FileLocation based on the value - for now use empty asset as stub
                // This will be handled properly when we implement file location functionality
                FileLocation.fromAsset("")
            }
        )

        crossplatformHelper.setActivity {
            activityProvider?.invoke()
        }
    }

    fun setActivityProvider(provider: () -> android.app.Activity?) {
        activityProvider = provider
    }

    fun handleMethodCall(methodName: String, args: String, callback: (String?) -> Unit) {
        runCatching {
            crossplatformHelper.onMethodCall(args, methodName) { response ->
                callback(response)
            }
        }.onFailure { e ->
            Log.e("AdaptyCapacitor", "Exception during method call: ${e.message}")
            callback(null)
        }
    }
}
