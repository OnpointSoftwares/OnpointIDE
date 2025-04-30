import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import workspace.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workspace.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            workspace.routing.websocket_urlpatterns
        )
    ),
})


