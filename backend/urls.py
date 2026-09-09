from django.urls import path
from .views import callback_receiver_wan, register_callback_wan

urlpatterns = [
    path('callback/wan/', callback_receiver_wan, name='callback-receiver-wan'),
    path('register_callback/wan/', register_callback_wan, name='register-callback-wan'),
]
