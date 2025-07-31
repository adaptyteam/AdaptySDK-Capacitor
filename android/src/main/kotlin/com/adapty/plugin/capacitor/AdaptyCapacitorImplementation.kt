package com.adapty.plugin.capacitor

import android.content.Context
import android.util.Log
import com.adapty.internal.crossplatform.CrossplatformHelper
import com.adapty.utils.FileLocation

class AdaptyCapacitorImplementation {
    private val crossplatformHelper by lazy {
        CrossplatformHelper.shared
    }

    private var activityProvider: (() -> android.app.Activity?)? = null
    private var eventCallback: ((String, String) -> Unit)? = null
    private var context: Context? = null

    fun initialize(context: Context, eventCallback: ((String, String) -> Unit)? = null) {
        this.context = context
        this.eventCallback = eventCallback
        
        CrossplatformHelper.init(
            context,
            { eventName, eventData ->
                Log.d("AdaptyCapacitor", "CrossplatformHelper event: $eventName")
                // Forward events to Capacitor bridge
                this.eventCallback?.invoke(eventName, eventData ?: "")
            },
            { value -> extractFileLocation(value) },
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

    private fun extractFileLocation(value: String): FileLocation {
        val context = this.context ?: throw IllegalStateException("Context not initialized")
        return if (value.lastOrNull() == 'r') {
            FileLocation.fromResId(
                context,
                context.resources.getIdentifier(
                    value.dropLast(1),
                    "raw",
                    context.packageName,
                )
            )
        } else {
            FileLocation.fromAsset(value.dropLast(1))
        }
    }
} 