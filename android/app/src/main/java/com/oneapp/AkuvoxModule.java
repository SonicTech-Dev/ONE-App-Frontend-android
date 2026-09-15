package com.oneapp;

import android.app.Application;
import android.util.Log;
import androidx.annotation.NonNull;
import android.view.View;
import android.view.SurfaceView;

import com.akuvox.mobile.libcommon.model.media.MediaManager;
import com.akuvox.mobile.libcommon.params.SurfaceViewsParams;
import com.akuvox.mobile.libcommon.bean.CallDataBean;
import com.akuvox.mobile.libcommon.bean.MakeCallBean;
import com.akuvox.mobile.libcommon.exp.ISipMessageListener;
import com.akuvox.mobile.libcommon.udp.IRtspMessageListener;
import com.akuvox.mobile.libcommon.udp.IRequestListener;
import com.akuvox.mobile.libcommon.wrapper.struct.MonitorDataWrap;
import com.akuvox.mobile.libcommon.bean.SipTransTypeEnum;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

public class AkuvoxModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;
    private IRtspMessageListener smartLockRtspListener = null;
    // Tracks the currently active SIP call ID so JS screens can poll it on mount
    // and avoid missing the onCallEstablished event due to navigation timing.
    private volatile int activeCallId = -1;
    // Tracks the current outgoing/in-progress SIP call ID before establishment
    // so JS can still cancel a ringing call.
    private volatile int currentCallId = -1;

    // Pending incoming call payload, so JS launched cold (e.g. via the
    // full-screen call notification) can recover the call and show the modal.
    private volatile int pendingIncomingCallId = -1;
    private volatile String pendingIncomingRemoteUserName = null;
    private volatile String pendingIncomingRemoteDisplayName = null;
    private volatile int pendingIncomingCallVideoMode = 1;

    private void clearPendingIncomingCall() {
        pendingIncomingCallId = -1;
        pendingIncomingRemoteUserName = null;
        pendingIncomingRemoteDisplayName = null;
    }

    public AkuvoxModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        Log.d("AkuvoxModule", "AkuvoxModule loaded");
    }

    @NonNull
    @Override
    public String getName() {
        return "Akuvox";
    }

    // Required by NativeEventEmitter
    @ReactMethod public void addListener(String eventName) {}
    @ReactMethod public void removeListeners(Integer count) {}

    // Use current Activity when available (per SL50 docs)
    private android.content.Context activityOrApp() {
        android.app.Activity a = getCurrentActivity();
        return a != null ? a : reactContext;
    }

    // Emit events to JS
    private void emitToJS(String eventName, WritableMap params) {
        Log.d("AkuvoxModule", "Emitting event to JS: " + eventName + " | " + params.toString());
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }

    // Prefer "remote" fields/methods, fallback to any View, with debug logging
    private View tryExtractRemoteVideoView(SurfaceViewsParams svp) {
        if (svp == null) return null;

        List<String> fieldLog = new ArrayList<>();
        try {
            Field[] fields = svp.getClass().getDeclaredFields();
            // Pass 1: remote first
            for (Field f : fields) {
                f.setAccessible(true);
                Object v = f.get(svp);
                fieldLog.add(f.getName() + "=" + (v != null ? v.getClass().getName() : "null"));
                if (v instanceof View && f.getName().toLowerCase().contains("remote")) {
                    Log.d("AkuvoxModule", "Found remote video view via field '" + f.getName() + "': " + v);
                    return (View) v;
                }
            }
            // Pass 2: any View
            for (Field f : fields) {
                f.setAccessible(true);
                Object v = f.get(svp);
                if (v instanceof View) {
                    Log.d("AkuvoxModule", "Found video view via field '" + f.getName() + "': " + v);
                    return (View) v;
                }
            }
        } catch (Throwable t) {
            Log.w("AkuvoxModule", "Field scan error: " + t.getMessage());
        }

        String[] getterNames = new String[] {
            "getRemoteView", "getRemoteVideo", "getRemoteSurfaceView", "getRemoteTextureView",
            "remoteView", "remoteVideo", "remoteSurfaceView", "remoteTextureView",
            "getVideoView", "getMainView"
        };
        for (String name : getterNames) {
            try {
                Method m = svp.getClass().getMethod(name);
                Object v = m.invoke(svp);
                if (v instanceof View) {
                    Log.d("AkuvoxModule", "Found remote video view via method '" + name + "': " + v);
                    return (View) v;
                }
            } catch (NoSuchMethodException ignored) {
            } catch (Throwable t) {
                Log.w("AkuvoxModule", "Getter '" + name + "' error: " + t.getMessage());
            }
        }

        Log.w("AkuvoxModule", "SurfaceViewsParams fields: " + String.join(", ", fieldLog));
        Log.w("AkuvoxModule", "Could not extract remote video View from SurfaceViewsParams.");
        return null;
    }

    // ---------------- SIP/VIDEO CALL SDK ---------------- //

    @ReactMethod
    public void initSdk() {
        Log.d("SIP", "AkuvoxModule: initSdk called");
        MediaManager.initAKTalkSDK(
            (Application) reactContext.getApplicationContext(),
            new ISipMessageListener() {
                @Override
                public int rtspMessageErrorMonitor(String error) {
                    Log.e("SIP", "RTSP error: " + error);
                    WritableMap params = Arguments.createMap();
                    params.putString("error", error);
                    emitToJS("onRtspError", params);
                    return 0;
                }
                @Override
                public int rtspMessageEstablishedMonitor(int monitorId, SurfaceViewsParams surfaceViewsParams) {
                    Log.d("AkuvoxModule", "rtspMessageEstablishedMonitor called! monitorId=" + monitorId);

                    View remoteView = tryExtractRemoteVideoView(surfaceViewsParams);
                    Log.d("AkuvoxModule", "Extracted remote video View for monitorId=" + monitorId + " = " + remoteView);

                    if (remoteView != null) {
                        SmartLockVideoCache.put(monitorId, remoteView);
                        Log.d("AkuvoxModule", "Remote video view cached for monitorId=" + monitorId);
                    } else {
                        Log.e("AkuvoxModule", "Failed to get remote video view for monitorId=" + monitorId);
                    }

                    WritableMap params = Arguments.createMap();
                    params.putInt("monitorId", monitorId);
                    params.putString("surfaceViewsParams", surfaceViewsParams != null ? surfaceViewsParams.toString() : "null");
                    emitToJS("onMonitorEstablished", params);
                    return 0;
                }
                @Override
                public int rtspMessageFinishedMonitor() {
                    Log.d("SIP", "RTSP finished");
                    WritableMap params = Arguments.createMap();
                    params.putString("status", "finished");
                    emitToJS("onMonitorFinished", params);
                    return 0;
                }
                @Override
                public int sipMessageFinishedCall(int callId, String reason) {
                    Log.d("SIP", "Call finished: ID=" + callId + ", reason=" + reason);
                    // Stop ringing/vibration and dismiss the call notification.
                    CallAlertHelper.stop(reactContext);
                    CallNotificationHelper.cancelIncomingCall(reactContext);
                    if (callId == pendingIncomingCallId || pendingIncomingCallId != -1) {
                        clearPendingIncomingCall();
                    }
                    if (callId == activeCallId) activeCallId = -1;
                    if (callId == currentCallId) currentCallId = -1;
                    MediaManager.getInstance(activityOrApp()).stopLocalVideo(callId);
                    WritableMap params = Arguments.createMap();
                    params.putInt("callId", callId);
                    params.putString("reason", reason);
                    emitToJS("onCallFinished", params);
                    return 0;
                }
                @Override
                public int sipMessageIncomingCall(CallDataBean callData) {
                    Log.d("SIP", "Incoming call: callId=" + callData.callId
                        + ", remoteUserName=" + callData.remoteUserName
                        + ", remoteDisplayName=" + callData.remoteDisplayName
                        + ", callVideoMode=" + callData.callVideoMode);

                    // 1) Remember the call so a cold-started JS runtime can recover it.
                    pendingIncomingCallId = callData.callId;
                    pendingIncomingRemoteUserName = callData.remoteUserName;
                    pendingIncomingRemoteDisplayName = callData.remoteDisplayName;
                    pendingIncomingCallVideoMode = callData.callVideoMode;

                    // 2) Ring + vibrate + wake the screen (works while app is backgrounded).
                    CallAlertHelper.start(reactContext);

                    // 3) Heads-up / full-screen notification for background & lockscreen.
                    String caller = callData.remoteDisplayName != null && !callData.remoteDisplayName.isEmpty()
                        ? callData.remoteDisplayName : callData.remoteUserName;
                    CallNotificationHelper.showIncomingCall(reactContext, caller);

                    // 4) If an activity exists, show it over the lockscreen.
                    android.app.Activity activity = getCurrentActivity();
                    if (activity != null) {
                        MainActivity.applyIncomingCallWindowFlags(activity);
                    }

                    WritableMap params = Arguments.createMap();
                    params.putInt("callId", callData.callId);
                    params.putString("remoteUserName", callData.remoteUserName);
                    params.putString("remoteDisplayName", callData.remoteDisplayName);
                    params.putInt("callVideoMode", callData.callVideoMode);
                    emitToJS("onIncomingCall", params);
                    return 0;
                }
                @Override
                public int sipMessageEstablishedCall(CallDataBean callData) {
                    int callId = callData.callId;
                    activeCallId = callId;
                    currentCallId = callId;
                    // Ringing stops as soon as the call connects.
                    CallAlertHelper.stop(reactContext);
                    CallNotificationHelper.cancelIncomingCall(reactContext);
                    if (callId == pendingIncomingCallId) {
                        clearPendingIncomingCall();
                    }
                    // Call startLocalVideo synchronously here (on the SIP callback thread)
                    // BEFORE emitting onCallEstablished to JS. This ensures the camera
                    // pipeline is started before any JS/view rendering touches getLocalVideoView().
                    // On fast LAN connections this matters: the JS side can render VideoCallView
                    // in < 100ms, so startLocalVideo must be done first.
                    try {
                        MediaManager.getInstance(activityOrApp()).startLocalVideo(callId);
                        Log.d("SIP", "startLocalVideo called for callId=" + callId);
                    } catch (Exception e) {
                        Log.e("SIP", "startLocalVideo failed: " + e.getMessage());
                    }
                    WritableMap params = Arguments.createMap();
                    params.putInt("callId", callId);
                    emitToJS("onCallEstablished", params);
                    Log.d("SIP", "Call established: " + callId);
                    return 0;
                }
                @Override
                public int sipMessageRegStatus(int status) {
                    Log.d("SIP", "Registration status: " + status);
                    WritableMap params = Arguments.createMap();
                    params.putInt("status", status);
                    emitToJS("onSipRegStatus", params);
                    return 0;
                }
                @Override
                public int rtspMessageAudioIntercom(int var1, int var2, MonitorDataWrap var3) { return 0; }
                @Override
                public int rtspMessageMonitorLoadSurfaceView(int monitorId, SurfaceViewsParams surfaceViewsParams) {
                    Log.d("AkuvoxModule", "rtspMessageMonitorLoadSurfaceView called! monitorId=" + monitorId);

                    View remoteView = tryExtractRemoteVideoView(surfaceViewsParams);
                    if (remoteView != null) {
                        SmartLockVideoCache.put(monitorId, remoteView);
                        Log.d("AkuvoxModule", "Remote video view refreshed for monitorId=" + monitorId);
                    }

                    WritableMap params = Arguments.createMap();
                    params.putInt("monitorId", monitorId);
                    params.putString("surfaceViewsParams", surfaceViewsParams != null ? surfaceViewsParams.toString() : "null");
                    emitToJS("onMonitorLoadSurfaceView", params);
                    return 0;
                }
            }
        );
        // Per SDK docs: initMedia with Activity context
        MediaManager.getInstance(activityOrApp()).initMedia(activityOrApp());
    }

    @ReactMethod
    public void getActiveCallId(Promise promise) {
        // Returns the currently active call ID, or -1 if no call is in progress.
        // Used by ActiveCallScreen on mount to recover the callId if the
        // onCallEstablished event fired before the screen's listener was registered.
        promise.resolve(activeCallId);
    }

    @ReactMethod
    public void getCurrentCallId(Promise promise) {
        promise.resolve(currentCallId != -1 ? currentCallId : activeCallId);
    }

    @ReactMethod
    public void getPendingIncomingCall(Promise promise) {
        // Returns the incoming call that is currently ringing, or null. Lets JS
        // recover the call UI when the app was cold-started by the notification
        // (the onIncomingCall event fires before the JS runtime exists in that case).
        if (pendingIncomingCallId == -1) {
            promise.resolve(null);
            return;
        }
        WritableMap params = Arguments.createMap();
        params.putInt("callId", pendingIncomingCallId);
        params.putString("remoteUserName", pendingIncomingRemoteUserName);
        params.putString("remoteDisplayName", pendingIncomingRemoteDisplayName);
        params.putInt("callVideoMode", pendingIncomingCallVideoMode);
        promise.resolve(params);
    }

    @ReactMethod
    public void registerSip(String ciphertext, String displayName, Promise promise) {
        try {
            // Reset stale call state from any previous session.
            activeCallId = -1;
            currentCallId = -1;
            // Gracefully deregister from the previous transport before switching.
            // Without this, the SDK's internal socket/connection stays bound to the
            // old protocol and INVITE requests fail even though REGISTER succeeds.
            MediaManager.getInstance(activityOrApp()).setSipBackendOnline(false);
            // Re-initialize the media/transport layer so TLS sockets, port bindings,
            // and codec sessions are all freshly created for the new transport.
            MediaManager.getInstance(activityOrApp()).initMedia(activityOrApp());
            MediaManager.getInstance(activityOrApp()).setSipTransType(SipTransTypeEnum.TRANS_TYPE_TLS);
            int result = MediaManager.getInstance(activityOrApp()).setSipAccount(ciphertext, displayName);
            MediaManager.getInstance(activityOrApp()).setSipBackendOnline(true);
            if (result == 0) {
                // Keep the SIP socket alive in the background for incoming calls.
                SipForegroundService.start(reactContext);
                promise.resolve("SIP account registered successfully.");
                Log.d("SIP", "App registered with account: " + displayName + " / " + ciphertext);
            } else {
                promise.reject("REGISTER_ERROR", "setSipAccount returned error code: " + result);
            }
        } catch (Exception e) {
            promise.reject("REGISTER_EXCEPTION", e.getMessage());
        }
    }

    @ReactMethod
    public void registerSipLan(String ciphertext, String displayName, Promise promise) {
        try {
            // Reset stale call state from any previous session.
            activeCallId = -1;
            currentCallId = -1;
            // Gracefully deregister from the previous transport before switching.
            // Without this, the SDK's internal socket/connection stays bound to the
            // old protocol and INVITE requests fail even though REGISTER succeeds.
            MediaManager.getInstance(activityOrApp()).setSipBackendOnline(false);
            // Re-initialize the media/transport layer so UDP sockets, port bindings,
            // and codec sessions are all freshly created for the new transport.
            MediaManager.getInstance(activityOrApp()).initMedia(activityOrApp());
            MediaManager.getInstance(activityOrApp()).setSipTransType(SipTransTypeEnum.TRANS_TYPE_UDP);
            int result = MediaManager.getInstance(activityOrApp()).setSipAccount(ciphertext, displayName);
            MediaManager.getInstance(activityOrApp()).setSipBackendOnline(true);
            if (result == 0) {
                // Keep the SIP socket alive in the background for incoming calls.
                SipForegroundService.start(reactContext);
                promise.resolve("SIP account registered successfully.");
                Log.d("SIP", "App registered with account: " + displayName + " / " + ciphertext);
            } else {
                promise.reject("REGISTER_ERROR", "setSipAccount returned error code: " + result);
            }
        } catch (Exception e) {
            promise.reject("REGISTER_EXCEPTION", e.getMessage());
        }
    }

    @ReactMethod
    public void getSipStatus(Promise promise) {
        try {
            int status = MediaManager.getInstance(activityOrApp()).getLineStatus();
            promise.resolve(status);
        } catch (Exception e) {
            promise.reject("STATUS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void makeCall(String remoteUserName, String remoteDisplayName, int callVideoMode) {
        MakeCallBean makeCallBean = new MakeCallBean();
        makeCallBean.remoteUserName = remoteUserName;
        makeCallBean.remoteDisplayName = remoteDisplayName;
        makeCallBean.callVideoMode = callVideoMode;
        int callId = MediaManager.getInstance(activityOrApp()).makeCall(makeCallBean, activityOrApp());

        Log.d("SIP", "Outgoing call requested: callId=" + callId
            + ", remoteUserName=" + remoteUserName
            + ", remoteDisplayName=" + remoteDisplayName
            + ", callVideoMode=" + callVideoMode);

        if (callId > 0) {
            currentCallId = callId;
            WritableMap params = Arguments.createMap();
            params.putInt("callId", callId);
            params.putString("remoteUserName", remoteUserName);
            params.putString("remoteDisplayName", remoteDisplayName);
            params.putInt("callVideoMode", callVideoMode);
            emitToJS("onOutgoingCallCreated", params);
        }
    }

    @ReactMethod
    public void hangupCall(int callId) {
        MediaManager.getInstance(activityOrApp()).hungupCall(callId);
    }

    @ReactMethod
    public void rejectCall(int callId) {
        // The Akuvox SDK's hungupCall only acts on established calls — for an
        // incoming RINGING call it is a no-op and no sipMessageFinishedCall ever
        // fires, which previously left the ringtone looping forever. So stop the
        // alert deterministically here, then still attempt hungupCall so the SDK
        // can CANCEL the dialog if it supports it.
        Log.d("SIP", "Rejecting incoming call: callId=" + callId);
        CallAlertHelper.stop(reactContext);
        CallNotificationHelper.cancelIncomingCall(reactContext);
        if (pendingIncomingCallId == callId) {
            clearPendingIncomingCall();
        }
        try {
            int res = MediaManager.getInstance(activityOrApp()).hungupCall(callId);
            Log.d("SIP", "hungupCall (reject path) returned: " + res);
        } catch (Exception e) {
            Log.w("SIP", "hungupCall during reject failed: " + e.getMessage());
        }
    }

    @ReactMethod
    public void answerCall(int callId) {
        // Stop ringing immediately on answer instead of waiting for onCallEstablished.
        CallAlertHelper.stop(reactContext);
        CallNotificationHelper.cancelIncomingCall(reactContext);
        if (pendingIncomingCallId == callId) {
            clearPendingIncomingCall();
        }
        MediaManager.getInstance(activityOrApp()).answerCall(callId, 1);
    }

    @ReactMethod
    public void answerCallWithMode(int callId, int callVideoMode) {
        // Stop ringing immediately on answer instead of waiting for onCallEstablished.
        CallAlertHelper.stop(reactContext);
        CallNotificationHelper.cancelIncomingCall(reactContext);
        if (pendingIncomingCallId == callId) {
            clearPendingIncomingCall();
        }
        MediaManager.getInstance(activityOrApp()).answerCall(callId, callVideoMode);
    }

    @ReactMethod
    public void setMute(boolean muted, Promise promise) {
        // SDK-level mic mute, so the Akuvox audio pipeline stops sending audio
        // rather than relying on a global device mute that VoIP capture can bypass.
        try {
            int result = MediaManager.getInstance(activityOrApp()).setMute(muted);
            Log.d("SIP", "setMute(" + muted + ") returned: " + result);
            promise.resolve(result == 0);
        } catch (Exception e) {
            Log.w("SIP", "setMute failed: " + e.getMessage());
            promise.reject("MUTE_ERROR", e.getMessage());
        }
    }

    private android.media.AudioManager audioManager() {
        return (android.media.AudioManager)
            reactContext.getSystemService(android.content.Context.AUDIO_SERVICE);
    }

    /** Finds a routable communication device of the given type (API 31+). */
    @androidx.annotation.RequiresApi(api = android.os.Build.VERSION_CODES.S)
    private android.media.AudioDeviceInfo findCommunicationDevice(
            android.media.AudioManager am, int type) {
        for (android.media.AudioDeviceInfo device : am.getAvailableCommunicationDevices()) {
            if (device.getType() == type) return device;
        }
        return null;
    }

    @ReactMethod
    public void setSpeakerOn(boolean speakerOn, Promise promise) {
        // The SDK has no speaker API, so audio is routed via AudioManager.
        // setSpeakerphoneOn() is deprecated from API 31 and does not actually
        // re-route on Android 13/14, so use setCommunicationDevice() there and
        // keep the legacy call only as the pre-31 path. Always resolve with the
        // state read back from the OS so the UI can't drift from reality.
        try {
            android.media.AudioManager am = audioManager();
            if (am == null) {
                promise.reject("SPEAKER_ERROR", "AudioManager unavailable");
                return;
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                if (speakerOn) {
                    android.media.AudioDeviceInfo speaker = findCommunicationDevice(
                        am, android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER);
                    if (speaker != null) {
                        am.setCommunicationDevice(speaker);
                    }
                } else {
                    // Prefer an explicit earpiece route; fall back to letting the
                    // platform pick (headset/Bluetooth stay respected either way).
                    android.media.AudioDeviceInfo earpiece = findCommunicationDevice(
                        am, android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE);
                    if (earpiece != null) {
                        am.setCommunicationDevice(earpiece);
                    } else {
                        am.clearCommunicationDevice();
                    }
                }
            } else {
                am.setSpeakerphoneOn(speakerOn);
            }

            promise.resolve(readSpeakerState(am));
        } catch (Exception e) {
            Log.w("SIP", "setSpeakerOn failed: " + e.getMessage());
            promise.reject("SPEAKER_ERROR", e.getMessage());
        }
    }

    private boolean readSpeakerState(android.media.AudioManager am) {
        if (am == null) return false;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            android.media.AudioDeviceInfo current = am.getCommunicationDevice();
            return current != null
                && current.getType() == android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER;
        }
        return am.isSpeakerphoneOn();
    }

    @ReactMethod
    public void isSpeakerOn(Promise promise) {
        try {
            promise.resolve(readSpeakerState(audioManager()));
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    // ---------------- SMART LOCK LAN MONITORING FLOW ---------------- //

    @ReactMethod
    public void setRtspMessageListener(final String deviceId, final String userId) {
        Log.d("SMARTLOCK", "setRtspMessageListener called for deviceId: " + deviceId + ", userId: " + userId);
        smartLockRtspListener = new IRtspMessageListener() {
            @Override
            public void onRtspReady(String rtspUrl) {
                Log.d("SMARTLOCK", "RTSP Ready: " + rtspUrl + ", deviceId: " + deviceId + ", userId: " + userId);
                WritableMap params = Arguments.createMap();
                params.putString("status", "rtspReady");
                params.putString("rtspUrl", rtspUrl);
                emitToJS("onSmartLockRtsp", params);
            }
            @Override
            public void onRtspStop() {
                Log.d("SMARTLOCK", "RTSP Stopped, deviceId: " + deviceId);
                WritableMap params = Arguments.createMap();
                params.putString("status", "rtspStop");
                emitToJS("onSmartLockRtsp", params);
            }
        };
        MediaManager.getInstance(activityOrApp()).setRtspMessageListener(smartLockRtspListener);
    }

    @ReactMethod
    public void clearRtspMessageListener() {
        Log.d("SMARTLOCK", "clearRtspMessageListener called");
        MediaManager.getInstance(activityOrApp()).setRtspMessageListener(null);
        smartLockRtspListener = null;
    }

    @ReactMethod
    public void prepareVideoStart(String deviceId) {
        Log.d("SMARTLOCK", "prepareVideoStart called: " + deviceId);
        int result = MediaManager.getInstance(activityOrApp()).prepareVideoStart(deviceId);
        Log.d("SMARTLOCK", "prepareVideoStart result: " + result);
    }

    @ReactMethod
    public void startMonitorViaLAN(String rtspUrl, String deviceId, Promise promise) {
        try {
            Log.d("SMARTLOCK", "startMonitorViaLAN called: rtspUrl=" + rtspUrl + ", deviceId=" + deviceId);
            int monitorId = MediaManager.getInstance(activityOrApp()).startMonitorViaLAN(rtspUrl, deviceId);
            Log.d("SMARTLOCK", "startMonitorViaLAN returned monitorId: " + monitorId);
            WritableMap params = Arguments.createMap();
            params.putInt("monitorId", monitorId);
            params.putString("rtspUrl", rtspUrl);
            // Resolve only; onMonitorEstablished will be emitted by rtspMessageEstablishedMonitor
            promise.resolve(params);
        } catch (Exception e) {
            Log.e("SMARTLOCK", "startMonitorViaLAN exception: " + e.getMessage(), e);
            promise.reject("MONITOR_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopVideoViaLAN(String deviceId) {
        Log.d("SMARTLOCK", "stopVideoViaLAN called: " + deviceId);
        MediaManager.getInstance(activityOrApp()).stopVideoViaLAN(deviceId);
    }

    @ReactMethod
    public void finishMonitor(int monitorId) {
        Log.d("SMARTLOCK", "finishMonitor called: " + monitorId);
        SmartLockVideoCache.remove(monitorId);
        MediaManager.getInstance(activityOrApp()).finishMonitor(monitorId);
    }

    // WAN monitor (unchanged)
    @ReactMethod
    public void startWanMonitor(String rtspUrl, String ciphertext, Promise promise) {
        try {
            Log.d("WAN_MONITOR", "startWanMonitor called: rtspUrl=" + rtspUrl + ", ciphertext=" + ciphertext);
            int monitorId = MediaManager.getInstance(activityOrApp()).startMonitor(rtspUrl, ciphertext);
            Log.d("WAN_MONITOR", "startMonitor returned monitorId: " + monitorId);
            WritableMap params = Arguments.createMap();
            params.putInt("monitorId", monitorId);
            params.putString("rtspUrl", rtspUrl);
            promise.resolve(params);
            emitToJS("onWanMonitorStarted", params);
        } catch (Exception e) {
            Log.e("WAN_MONITOR", "startWanMonitor exception: " + e.getMessage(), e);
            promise.reject("WAN_MONITOR_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void initLockConfig(String residenceId, String userId, String deviceId, String deviceIp) {
        Log.d("SMARTLOCK", "initLockConfig called: " + residenceId + ", " + userId + ", " + deviceId + ", " + deviceIp);
        MediaManager.getInstance(activityOrApp()).initLockConfig(residenceId, userId, deviceId, deviceIp);
    }

    @ReactMethod
    public void unlockViaLAN(String deviceId, final Callback callback) {
        Log.d("SMARTLOCK", "unlockViaLAN called: " + deviceId);
        MediaManager.getInstance(activityOrApp()).unlockViaLAN(deviceId, new IRequestListener<Boolean>() {
            @Override
            public void onResult(Boolean success) {
                Log.d("SMARTLOCK", "Unlock result: " + success);
                callback.invoke(success);
            }
        });
    }
}