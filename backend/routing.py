from django.urls import re_path
from .consumers import CallbackConsumer

websocket_urlpatterns = [
    # ws://<host>/ws/callbacks/wan/
    re_path(r'^ws/callbacks/(?P<option>wan)/$', CallbackConsumer.as_asgi()),
]
