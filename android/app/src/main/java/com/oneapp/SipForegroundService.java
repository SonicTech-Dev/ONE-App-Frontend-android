package com.oneapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Foreground service that keeps the process (and therefore the Akuvox SIP
 * socket) alive while the app is backgrounded, so incoming INVITEs are still
 * received. Started after a successful SIP registration (LAN or WAN).
 */
public class SipForegroundService extends Service {
    private static final String TAG = "SipForegroundService";
    private static final String CHANNEL_ID = "sip_service_channel";
    private static final int NOTIFICATION_ID = 4100;

    public static void start(Context context) {
        try {
            Intent intent = new Intent(context, SipForegroundService.class);
            ContextCompat.startForegroundService(context, intent);
            Log.d(TAG, "SipForegroundService start requested");
        } catch (Throwable t) {
            Log.w(TAG, "failed to start foreground service: " + t.getMessage());
        }
    }

    public static void stop(Context context) {
        try {
            context.stopService(new Intent(context, SipForegroundService.class));
        } catch (Throwable ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        goForeground();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        goForeground();
        return START_STICKY;
    }

    private void goForeground() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Call connectivity", NotificationManager.IMPORTANCE_MIN);
                channel.setDescription("Keeps the app reachable for incoming intercom calls");
                channel.setShowBadge(false);
                nm.createNotificationChannel(channel);
            }
        }

        Intent launch = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("ONE App")
            .setContentText("Connected for incoming calls")
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build();

        try {
            ServiceCompat.startForeground(
                this, NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
        } catch (Throwable t) {
            Log.w(TAG, "startForeground failed: " + t.getMessage());
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
