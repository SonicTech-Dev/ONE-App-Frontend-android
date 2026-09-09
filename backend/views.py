import json
import logging
import os
import requests
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

AKUBELO_OPEN_ABILITY_URL = 'https://api.ecloud.akubela.com/api/v1.0/invoke/open-ability/method'
AKUBELO_TOKEN_URL = f'{AKUBELO_OPEN_ABILITY_URL}/oauth2/token'
AKUBELO_GENERAL_COMMANDS_URL = f'{AKUBELO_OPEN_ABILITY_URL}/general-commands'
AKUBELO_USER_COMMANDS_URL = f'{AKUBELO_OPEN_ABILITY_URL}/user-commands'
WAN_NOTICE_URL = os.getenv(
    'WAN_NOTICE_URL',
    'https://one-development.soniciot.com/api/callback/wan/',
)


def _require_bearer_token(request):
    authorization = request.headers.get('Authorization', '').strip()
    if not authorization.lower().startswith('bearer '):
        raise ValueError('Authorization Bearer token is required')
    token = authorization[7:].strip()
    if not token:
        raise ValueError('Authorization Bearer token is required')
    return authorization


def _json_response(response, step):
    try:
        payload = response.json()
    except ValueError:
        payload = {'raw': response.text[:1000]}

    if not response.ok:
        raise RuntimeError(f'{step} failed with HTTP {response.status_code}: {payload}')
    if isinstance(payload, dict) and payload.get('success') is False:
        raise RuntimeError(f'{step} failed: {payload}')
    return payload


def _get_general_access_token():
    client_id = os.getenv('AKUBELO_GENERAL_CLIENT_ID')
    client_secret = os.getenv('AKUBELO_GENERAL_CLIENT_SECRET')
    if not client_id or not client_secret:
        raise RuntimeError(
            'AKUBELO_GENERAL_CLIENT_ID and AKUBELO_GENERAL_CLIENT_SECRET must be configured'
        )

    response = requests.post(
        AKUBELO_TOKEN_URL,
        headers={
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        data={
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret,
            'scope': 'general',
            'expires_in': 3600,
        },
        timeout=15,
    )
    payload = _json_response(response, 'Akuvox general token request')
    token = payload.get('result', {}).get('access_token') if isinstance(payload, dict) else None
    if not token:
        raise RuntimeError('Akuvox general token response did not contain result.access_token')
    return token


def _configure_notice_url(general_token):
    response = requests.post(
        AKUBELO_GENERAL_COMMANDS_URL,
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {general_token}',
        },
        json={
            'command': 'configure_notice_url',
            'id': 'c45e846ca23ab42c9ae469d988ae32a96',
            'param': {'notice_url': WAN_NOTICE_URL},
        },
        timeout=15,
    )
    return _json_response(response, 'Akuvox notice URL configuration')


def _turn_on_notice(user_authorization, residence_id, listen_list):
    response = requests.post(
        AKUBELO_USER_COMMANDS_URL,
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': user_authorization,
        },
        json={
            'command': 'turn_on_listen_config',
            'id': 'c45e846ca23ab42c9ae469d988ae32a96',
            'param': {
                'residence_id': residence_id,
                'listen_list': listen_list,
            },
        },
        timeout=15,
    )
    return _json_response(response, 'Akuvox notice listener activation')


@csrf_exempt
def callback_receiver_wan(request):
    """
    Device posts WAN callbacks here:
    POST /api/callback/wan/
    Broadcasts payload to WebSocket group 'callbacks_wan'.
    """
    if request.method != 'POST':
        print(f"[WAN] Method Not Allowed for /api/callback/wan/: {request.method}")
        logger.warning("Method Not Allowed: /api/callback/wan/ (method=%s)", request.method)
        return HttpResponseNotAllowed(['POST'])
    remote_ip = request.META.get('REMOTE_ADDR')
    content_type = request.META.get('CONTENT_TYPE')
    body_bytes = request.body or b""
    body_len = len(body_bytes)
    # Print raw body and context BEFORE parsing
    print("\n[WAN] ===== Callback Received =====")
    print(f"[WAN] From: {remote_ip}  Content-Type: {content_type}  Length: {body_len}")
    try:
        raw_text = body_bytes.decode('utf-8', errors='replace')
    except Exception:
        raw_text = str(body_bytes)
    print("[WAN] Raw body:")
    print(raw_text)
    # Parse JSON and print the full payload (pretty)
    try:
        payload = json.loads(raw_text)
    except Exception:
        print("[WAN] ERROR: Body is not valid JSON.")
        logger.warning("WAN callback body not valid JSON")
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    print("[WAN] Full payload (pretty JSON):")
    try:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    except Exception:
        print(f"[WAN] Payload (raw dict): {payload}")
    # Optional concise one-liner (kept at DEBUG to avoid noise)
    summary = f"notice={payload.get('notice')} action={payload.get('action')} id={payload.get('id')} ts={payload.get('timestamp')} from={remote_ip}"
    logger.debug("WAN callback summary: %s", summary)
    # Broadcast to WebSocket group
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'callbacks_wan',
            {'type': 'callback.message', 'payload': payload}
        )
        print("[WAN] Broadcasted payload to 'callbacks_wan' group")
        return JsonResponse({'status': 'ok'})
    except Exception as e:
        print(f"[WAN] Broadcast failure: {e}")
        logger.exception('Broadcast failure')
        return JsonResponse({'status': 'error', 'message': 'broadcast_failed'}, status=500)
@csrf_exempt
def register_callback_wan(request):
    """
    Configure and activate the WAN callback in Akuvox.

    Steps:
    1. Get a general client-credentials token.
    2. Configure the public backend notice URL with that token.
    3. Activate account/device listeners with the user's Bearer token.

    POST /api/register_callback/wan/
    """
    if request.method != 'POST':
        print(f"[WAN] Method Not Allowed for /api/register_callback/wan/: {request.method}")
        logger.warning("Method Not Allowed: /api/register_callback/wan/ (method=%s)", request.method)
        return HttpResponseNotAllowed(['POST'])
    try:
        raw_text = request.body.decode('utf-8', errors='replace')
        payload = json.loads(raw_text)
    except Exception:
        print("[WAN] Invalid JSON in register_callback_wan. Raw:")
        print(raw_text if 'raw_text' in locals() else str(request.body))
        logger.warning("Invalid JSON in register_callback_wan")
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    try:
        user_authorization = _require_bearer_token(request)
        param = payload.get('param') if isinstance(payload, dict) else None
        residence_id = param.get('residence_id') if isinstance(param, dict) else None
        if not residence_id:
            return JsonResponse(
                {'status': 'error', 'message': 'param.residence_id is required'},
                status=400,
            )

        listen_list = param.get('listen_list') if isinstance(param, dict) else None
        if not isinstance(listen_list, list) or not listen_list:
            listen_list = ['account', 'device']

        print('[WAN] Received WAN callback registration from frontend')
        print(f'[WAN] Configuring notice URL: {WAN_NOTICE_URL}')
        print(f'[WAN] Activating listeners for residence: {residence_id}')

        general_token = _get_general_access_token()
        configure_result = _configure_notice_url(general_token)
        activate_result = _turn_on_notice(user_authorization, residence_id, listen_list)

        return JsonResponse({
            'status': 'success',
            'data': {
                'notice_url': WAN_NOTICE_URL,
                'residence_id': residence_id,
                'listen_list': listen_list,
                'configure_notice_url': configure_result,
                'turn_on_listen_config': activate_result,
            },
        })
    except ValueError as error:
        return JsonResponse({'status': 'error', 'message': str(error)}, status=401)
    except (requests.RequestException, RuntimeError) as error:
        logger.exception('WAN callback registration failed')
        return JsonResponse({'status': 'error', 'message': str(error)}, status=502)
