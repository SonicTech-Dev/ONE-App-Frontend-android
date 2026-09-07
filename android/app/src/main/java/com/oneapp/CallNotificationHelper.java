package com.oneapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Posts a high-priority incoming-call notification with a full-screen intent,
 * the standard "incoming call" UX on Android. Tapping (or the full-screen
 * takeover when locked) launches MainActivity with the "incomingCall" extra.
 */
public final class CallNotificationHelper {
    private static final String TAG = "CallNotificationHelper";
    private static final String CHANNEL_ID = "incoming_calls";
    private static final int INCOMING_CALL_NOTIFICATION_ID = 4242;

    private CallNotificationHelper() {}

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Incoming intercom and SIP calls");
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(channel);
            }
        }
    }

    public static void showIncomingCall(Context context, String callerName) {
        try {
            ensureChannel(context);

            Intent launch = new Intent(context, MainActivity.class);
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launch.putExtra("incomingCall", true);
            PendingIntent pi = PendingIntent.getActivity(
                context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Incoming call")
                .setContentText(callerName != null && !callerName.isEmpty() ? callerName : "Unknown caller")
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true);

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(INCOMING_CALL_NOTIFICATION_ID, builder.build());
                Log.d(TAG, "Incoming call notification posted for " + callerName);
            }
        } catch (Throwable t) {
            // POST_NOTIFICATIONS denied (API 33+) lands here — ringing still works in-app.
            Log.w(TAG, "failed to post incoming call notification: " + t.getMessage());
        }
    }

    public static void cancelIncomingCall(Context context) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(INCOMING_CALL_NOTIFICATION_ID);
            }
        } catch (Throwable ignored) {}
    }
}
