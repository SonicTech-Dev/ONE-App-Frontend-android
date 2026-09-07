package com.oneapp

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.core.app.ActivityCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "ONEApp"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d("MainActivity", "onCreate triggered")

        // Launched from the incoming-call notification: show above lockscreen.
        if (intent?.getBooleanExtra("incomingCall", false) == true) {
            applyIncomingCallWindowFlags(this)
        }

        // 🔐 Ask for storage permission (required for frame saving)
        ActivityCompat.requestPermissions(
            this,
            arrayOf(
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.READ_EXTERNAL_STORAGE
            ),
            1001
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Activity already running (singleTask) and the user tapped the call notification.
        if (intent.getBooleanExtra("incomingCall", false)) {
            applyIncomingCallWindowFlags(this)
        }
    }

    companion object {
        /**
         * Lets the activity appear over the lockscreen and turns the screen on,
         * the standard behaviour for incoming-call UIs. Called natively from
         * AkuvoxModule when a SIP INVITE arrives.
         */
        @JvmStatic
        fun applyIncomingCallWindowFlags(activity: Activity) {
            activity.runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    activity.setShowWhenLocked(true)
                    activity.setTurnScreenOn(true)
                } else {
                    @Suppress("DEPRECATION")
                    activity.window.addFlags(
                        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    )
                }
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }
}