package com.adapty.plugin.capacitor;

import android.util.Log;

public class AdaptyCapacitorPlugin {

    public String echo(String value) {
        Log.i("Echo", value);
        return value;
    }
}
