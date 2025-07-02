package com.adapty.plugin.capacitor

import android.util.Log

class AdaptyCapacitorPlugin {

    fun echo(value: String): String {
        Log.i("Echo", value)
        return value
    }
} 