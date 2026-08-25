import json
import logging
import os

import requests
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import UserAccount


logger = logging.getLogger(__name__)


AKUBELA_TOKEN_URL = "https://api.ecloud.akubela.com/api/v1.0/invoke/open-ability/method/oauth2/token"
AKUBELA_USER_COMMANDS_URL = "https://api.ecloud.akubela.com/api/v1.0/invoke/open-ability/method/user-commands"
AKUBELA_COMMAND_ID = "c45e846ca23ab42c9ae469d988ae32a96"

GENERAL_USERNAME = os.getenv("AKUBELA_GENERAL_USERNAME", "fayis@sonictech.ae")
GENERAL_PASSWORD = os.getenv("AKUBELA_GENERAL_PASSWORD", "Fayis@123")
CLIENT_ID = os.getenv("AKUBELA_CLIENT_ID", "ccf1ac952146b11f0904c02dd80f92105")
CLIENT_SECRET = os.getenv("AKUBELA_CLIENT_SECRET", "scf1ac95d146b11f0904c02dd80f92105")


class UserVisibleError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _error_response(message, status):
    return JsonResponse({"error": message}, status=status)


def _parse_json_body(request):
    try:
        return json.loads(request.body)
    except json.JSONDecodeError:
        raise UserVisibleError("Invalid request data.", status=400)


def _parse_response_json(response):
    try:
        return response.json()
    except ValueError:
        return {}


def _extract_akubela_error_message(data):
    candidates = [
        data.get("error"),
        data.get("message"),
        data.get("msg"),
        (data.get("result") or {}).get("message") if isinstance(data.get("result"), dict) else None,
        (data.get("result") or {}).get("msg") if isinstance(data.get("result"), dict) else None,
    ]
    message = " ".join(str(item).strip() for item in candidates if item).lower()
    return message


def _map_akubela_error(data, fallback_message):
    message = _extract_akubela_error_message(data)
    if "already exists" in message or "duplicate" in message or "registered" in message:
        return UserVisibleError("User with this email already exists.", status=400)
    if "invalid" in message and "residence" in message:
        return UserVisibleError("Unable to complete registration for this home right now.", status=400)
    if "timeout" in message or "network" in message or "connection" in message:
        return UserVisibleError("Please check your internet connection and try again.", status=502)
    return UserVisibleError(fallback_message, status=502)


def _get_general_access_token():
    payload = {
        "username": GENERAL_USERNAME,
        "password": GENERAL_PASSWORD,
        "grant_type": "password",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "user",
        "expires_in": 100000,
    }

    response = requests.post(
        AKUBELA_TOKEN_URL,
        headers={
            "accept": "application/json",
            "content-type": "application/x-www-form-urlencoded",
        },
        data=payload,
        timeout=20,
    )

    data = _parse_response_json(response)

    if not response.ok or not data.get("success"):
        raise _map_akubela_error(data, "Unable to complete registration right now. Please try again.")

    return data["result"]["access_token"]


def _create_family_account(*, email, password, first_name, last_name, auth, residence_id):
    access_token = _get_general_access_token()
    body = {
        "command": "create_family_account",
        "id": AKUBELA_COMMAND_ID,
        "param": {
            "residence_id": residence_id,
            "auth": auth,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "password": password,
        },
    }

    response = requests.post(
        AKUBELA_USER_COMMANDS_URL,
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
        json=body,
        timeout=30,
    )

    data = _parse_response_json(response)

    if not response.ok or not data.get("success"):
        raise _map_akubela_error(data, "Unable to complete registration right now. Please try again.")

    return data


@csrf_exempt
def register_user(request):
    if request.method != 'POST':
        return _error_response("Method must be POST", 405)

    try:
        data = _parse_json_body(request)
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        first_name = (data.get('first_name') or '').strip()
        last_name = (data.get('last_name') or '').strip()
        residence_id = (data.get('residence_id') or '').strip()
        auth = 'user'

        if not email or not password:
            return _error_response("Email and password are required.", 400)

        if not residence_id:
            return _error_response("Residence ID is required.", 400)

        if UserAccount.objects.filter(email=email).exists():
            return _error_response("User with this email already exists.", 400)

        with transaction.atomic():
            akubela_response = _create_family_account(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                auth=auth,
                residence_id=residence_id,
            )

            user = UserAccount.objects.create(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                auth=auth,
                residence_id=residence_id,
            )

        return JsonResponse(
            {
                "success": True,
                "message": "User registered successfully!",
                "user_id": user.no,
                "cloud_created": True,
                "family_linked": True,
                "completed": True,
                "akubela_response": akubela_response,
            },
            status=201,
        )

    except UserVisibleError as exc:
        return _error_response(exc.message, exc.status)
    except requests.RequestException:
        logger.exception("AkuBela request error during registration")
        return _error_response("Please check your internet connection and try again.", 502)
    except Exception:
        logger.exception("Unexpected registration error")
        return _error_response("Unable to complete registration right now. Please try again.", 500)


@csrf_exempt
def login_user(request):
    if request.method != 'POST':
        return _error_response("Method must be POST", 405)

    try:
        data = _parse_json_body(request)
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not email or not password:
            return _error_response("Email and password are required.", 400)

        user = UserAccount.objects.filter(email=email).first()

        if user and user.password == password:
            return JsonResponse(
                {
                    "success": True,
                    "message": "Login successful!",
                    "first_name": user.first_name,
                    "residence_id": user.residence_id,
                    "token": f"custom-session-{user.no}",
                },
                status=200,
            )

        return _error_response("Invalid email or password.", 401)

    except UserVisibleError as exc:
        return _error_response(exc.message, exc.status)
    except Exception:
        logger.exception("Unexpected login error")
        return _error_response("Unable to sign in right now. Please try again.", 500)