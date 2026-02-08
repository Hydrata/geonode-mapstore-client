from django import template
from django.conf import settings
from geonode.base.models import Configuration, Menu, MenuItem

register = template.Library()

def _handle_single_item(menu_item):
    m_item = {}
    m_item["type"] = "link"
    m_item["href"] = menu_item.url
    m_item["label"] = menu_item.title
    if menu_item.blank_target:
        m_item["target"] = "_blank"
    return m_item

@register.simple_tag
def get_menu_json(placeholder_name):
    menus = {
        m: MenuItem.objects.filter(menu=m).order_by("order")
        for m in Menu.objects.filter(placeholder__name=placeholder_name)
    }
    ms = []
    for menu, menu_items in menus.items():
        if len(menu_items) > 1:
            m = {}
            m["label"] = menu.title
            m["type"] = "dropdown"
            m["items"] = []
            for menu_item in menu_items:
                m_item = _handle_single_item(menu_item)
                m["items"].append(m_item)

            ms.append(m)
        if len(menu_items) == 1:
            m = _handle_single_item(menu_items.first())
            ms.append(m)
    return ms

@register.simple_tag
def get_settings():
    return {
        'ACCOUNT_OPEN_SIGNUP': settings.ACCOUNT_OPEN_SIGNUP,
        'READ_ONLY': Configuration.load().read_only,
        'GEOSERVER_WEB_UI_LOCATION': settings.GEOSERVER_WEB_UI_LOCATION
    }

@register.simple_tag(takes_context=True)
def get_user_menu(context):
    """
    Returns the user menu items for authenticated/anonymous users.
    This tag was removed from GeoNode 5.x but is needed for legacy templates.
    """
    request = context.get('request')
    user = getattr(request, 'user', None) if request else None
    menu_items = []

    if user and user.is_authenticated:
        menu_items = [
            {"type": "link", "href": "/", "label": "Home"},
            {"type": "link", "href": f"/people/profile/{user.username}/", "label": "Profile"},
            {"type": "link", "href": "/account/logout/", "label": "Log out"},
        ]
        if user.is_superuser:
            menu_items.insert(-1, {"type": "link", "href": "/admin/", "label": "Admin"})
    else:
        menu_items = [
            {"type": "link", "href": "/account/login/", "label": "Sign in", "id": "sign-in"},
        ]
        if getattr(settings, 'ACCOUNT_OPEN_SIGNUP', False):
            menu_items.append({"type": "link", "href": "/account/signup/", "label": "Register"})

    return menu_items