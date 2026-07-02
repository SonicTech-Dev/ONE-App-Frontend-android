import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function maskAuthorizationHeader(headers) {
  if (!headers?.Authorization) return headers;
  const token = headers.Authorization.replace(/^Bearer\s+/i, '');
  const maskedToken = token.length > 12
    ? `${token.slice(0, 6)}...${token.slice(-4)}`
    : '***';

  return {
    ...headers,
    Authorization: `Bearer ${maskedToken}`,
  };
}

export default function CallbackRegistration({
  deviceCallbackUrl, // e.g. http://192.168.2.115/api/v1.0/callback
  callbackUrl,       // e.g. http://<your-ip>:8080/
  callbackId,
  listenList,
  residenceId,
  networkMode = 'LAN',
  run,
  onStatus,          // function(status: 'success' | 'error', data?: any)
}) {
  const { getActiveLanToken, getActiveWanToken } = useAuth();
  const [authHeaders, setAuthHeaders] = useState(null);
  // headersLoading starts true so the run-effect waits silently until the async
  // token fetch either succeeds or fails before deciding to warn.
  const [headersLoading, setHeadersLoading] = useState(true);
  // Always hold the latest onStatus reference without putting it in effect deps.
  const onStatusRef = useRef(onStatus);
  useEffect(() => { onStatusRef.current = onStatus; });
  const modeLabel = (networkMode || 'LAN').toUpperCase();

  // Build auth headers whenever the selected transport changes.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setHeadersLoading(true);
      try {
        const token = modeLabel === 'WAN'
          ? await getActiveWanToken()
          : await getActiveLanToken();
        const headers = { 'Authorization': `Bearer ${token}` };
        if (mounted) {
          setAuthHeaders(headers);
          console.log(`[CallbackRegistration][${modeLabel}] Built auth headers:`, maskAuthorizationHeader(headers));
        }
      } catch (err) {
        console.error(`[CallbackRegistration][${modeLabel}] Failed to build auth headers:`, err);
        if (mounted) setAuthHeaders(null);
      } finally {
        if (mounted) setHeadersLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [getActiveLanToken, getActiveWanToken, modeLabel]);

  // Register callback when run=true and headers are settled
  useEffect(() => {
    if (!run) return;
    // Silently wait while the token fetch is still in-flight
    if (headersLoading) return;
    if (!authHeaders || typeof authHeaders !== 'object') {
      console.warn(`[CallbackRegistration][${modeLabel}] Auth headers not ready, cannot register callback.`);
      onStatusRef.current?.('error', { message: `${modeLabel} auth headers not ready` });
      return;
    }

    const controller = new AbortController();

    const configureCallback = async () => {
      try {
        const payload = {
          command: 'configure_callback',
          id: callbackId,
          param: {
            url: callbackUrl,
            listen_list: listenList,
            ...(modeLabel === 'WAN' && residenceId ? { residence_id: residenceId } : {}),
          },
        };

        // Log the outgoing request
        const reqHeaders = {
          ...authHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        console.log(`[CallbackRegistration][${modeLabel}] Request URL:`, deviceCallbackUrl);
        console.log(`[CallbackRegistration][${modeLabel}] Callback target URL:`, callbackUrl);
        console.log(`[CallbackRegistration][${modeLabel}] Request Headers:`, maskAuthorizationHeader(reqHeaders));
        console.log(`[CallbackRegistration][${modeLabel}] Request Payload:`, payload);

        const response = await fetch(deviceCallbackUrl, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        // Collect response headers if available
        const respHeaders = {};
        try {
          response.headers?.forEach?.((v, k) => { respHeaders[k] = v; });
        } catch {}

        // Read body as text, then try parse JSON for logging
        const text = await response.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch {}

        // Log the response
        console.log(`[CallbackRegistration][${modeLabel}] Response Status:`, response.status, response.statusText);
        console.log(`[CallbackRegistration][${modeLabel}] Response Headers:`, respHeaders);
        console.log(`[CallbackRegistration][${modeLabel}] Response Body:`, data ?? text);

        // Pass parsed data (if any) to onStatus
        if (response.ok) {
          onStatusRef.current?.('success', data ?? { status: response.status });
        } else {
          onStatusRef.current?.('error', data ?? { status: response.status, statusText: response.statusText });
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error(`[CallbackRegistration][${modeLabel}] Network/Error:`, error);
        onStatusRef.current?.('error', { message: error.message || 'Network error' });
      }
    };

    configureCallback();
    return () => controller.abort();
  // onStatus intentionally excluded — it's accessed via onStatusRef to prevent
  // the effect from re-firing on every SmartScreen render.
  }, [run, headersLoading, authHeaders, deviceCallbackUrl, callbackUrl, callbackId, listenList, residenceId, modeLabel]);

  return null;
}