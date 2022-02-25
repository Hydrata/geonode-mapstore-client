from mapstore2_adapter.utils import decode_base64


def update_geoapp_thumbnail(instance, data):
    thumbnail = ''
    if 'thumbnail_url' in data:
        try:
            thumbnail, thumbnail_format = decode_base64(data.get('thumbnail_url'))
        except Exception:
            if data.get('thumbnail_url'):
                thumbnail = data.get('thumbnail_url')
                thumbnail_format = 'link'

    if thumbnail:
        if thumbnail_format == 'link':
            data['thumbnail_url'] = thumbnail
        else:
            thumbnail_filename = "geoapp-%s-thumb.%s" % (instance.uuid, thumbnail_format)
            instance.save_thumbnail(thumbnail_filename, thumbnail)
            data['thumbnail_url'] = instance.thumbnail_url
