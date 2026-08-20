def classFactory(iface):
    from .plugin import GeoRampPlugin

    return GeoRampPlugin(iface)
