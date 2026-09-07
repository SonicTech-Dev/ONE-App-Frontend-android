package com.oneapp;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

/**
 * Starts/stops the device ringtone, vibration pattern and a short wake lock
 * for incoming SIP calls. Fully native so ringing works even when the JS
 * runtime is paused (app backgrounded) as long as the process is alive.
 */
public final class CallAlertHelper {
    private static final String TAG = "CallAlertHelper";

    private static Ringtone ringtone;
    private static Vibrator vibrator;
    private static PowerManager.WakeLock wakeLock;

    private CallAlertHelper() {}

    public static synchronized void start(Context context) {
        // Idempotent: never stack a second ringtone on top of an active one.
        stopInternal();

        // Wake the CPU/screen briefly so the SIP callback + notification are seen.
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "oneapp:incomingCallWake"
            );
            wakeLock.acquire(60 * 1000L); // safety cap; released on stop()
        } catch (Throwable t) {
            Log.w(TAG, "wake lock failed: " + t.getMessage());
        }

        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), uri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= 21) {
                    ringtone.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                }
                if (Build.VERSION.SDK_INT >= 28) {
                    ringtone.setLooping(true);
                }
                ringtone.play();
                Log.d(TAG, "Ringtone started");
            }
        } catch (Throwable t) {
            Log.w(TAG, "ringtone failed: " + t.getMessage());
        }

        try {
            vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 1000, 800};
                if (Build.VERSION.SDK_INT >= 26) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    //noinspection deprecation
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "vibration failed: " + t.getMessage());
        }
    }

    public static synchronized void stop(Context context) {
        stopInternal();
    }

    private static void stopInternal() {
        try { if (ringtone != null && ringtone.isPlaying()) ringtone.stop(); } catch (Throwable ignored) {}
        ringtone = null;
        try { if (vibrator != null) vibrator.cancel(); } catch (Throwable ignored) {}
        vibrator = null;
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Throwable ignored) {}
        wakeLock = null;
    }
}
