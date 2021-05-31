import os
import logging

from django import template
from django.conf import settings

logger = logging.getLogger(__name__)
register = template.Library()


@register.simple_tag
def client_version():
    try:
        file_path = os.path.join(
            settings.STATIC_ROOT,
            'mapstore/version.txt'
        )
        with open(file_path, 'r') as f:
            version = f.read()
        return version
    except Exception as e:
        logger.error(e)
        return ''
