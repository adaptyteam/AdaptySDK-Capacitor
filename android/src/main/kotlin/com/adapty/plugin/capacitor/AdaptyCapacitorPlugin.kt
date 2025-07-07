package com.adapty.plugin.capacitor

import android.content.Context
import android.util.Log
import com.adapty.Adapty
import com.adapty.models.AdaptyConfig
import com.adapty.utils.AdaptyResult
import org.json.JSONObject
import org.json.JSONException

class AdaptyCapacitorPluginKt {
    private var isActivated = false

    fun activate(context: Context, apiKey: String, configuration: JSONObject, callback: (String?) -> Unit) {
        try {
            val configBuilder = AdaptyConfig.Builder(apiKey)

            // Set customer user ID if provided
            if (configuration.has("customer_user_id")) {
                configBuilder.withCustomerUserId(configuration.getString("customer_user_id"))
            }

            // Set observer mode
            configBuilder.withObserverMode(configuration.optBoolean("observer_mode", false))

            // Set IP address collection disabled
            configBuilder.withIpAddressCollectionDisabled(configuration.optBoolean("ip_address_collection_disabled", false))

            // Set Android-specific configuration
            if (configuration.has("google_adid_collection_disabled")) {
                configBuilder.withAdIdCollectionDisabled(configuration.getBoolean("google_adid_collection_disabled"))
            }

            val adaptyConfig = configBuilder.build()

            Adapty.activate(context, adaptyConfig)

            Log.i("AdaptyCapacitor", "Adapty activated successfully")
            isActivated = true
            callback(null)

        } catch (e: Exception) {
            Log.e("AdaptyCapacitor", "Exception during activation: ${e.message}")
            callback(e.message)
        }
    }

    fun isActivated(): Boolean {
        return isActivated
    }

    fun echo(value: String): String {
        Log.i("Echo", value)
        return value
    }
}
