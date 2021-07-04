from django.contrib import admin
from mapstore2_adapter.api.models import MapStoreResource, MapStoreData, MapStoreAttribute


class MapStoreResourceAdmin(admin.ModelAdmin):
    pass


class MapStoreDataAdmin(admin.ModelAdmin):
    pass


class MapStoreAttributeAdmin(admin.ModelAdmin):
    pass

admin.site.register(MapStoreResource, MapStoreResourceAdmin)
admin.site.register(MapStoreData, MapStoreDataAdmin)
admin.site.register(MapStoreAttribute, MapStoreAttributeAdmin)