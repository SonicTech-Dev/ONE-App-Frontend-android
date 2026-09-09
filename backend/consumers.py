import json
from channels.generic.websocket import AsyncWebsocketConsumer

class CallbackConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Only WAN is supported in backend broadcasting
        self.option = self.scope['url_route']['kwargs']['option']  # 'wan'
        if self.option != 'wan':
            await self.close()
            return
        self.group_name = 'callbacks_wan'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def callback_message(self, event):
        payload = event.get('payload')
        await self.send(text_data=json.dumps(payload))
