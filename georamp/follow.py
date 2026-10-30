"""Debounced canvas following independent of the configuration dialog."""

import json

from qgis.core import (
    Qgis,
    QgsApplication,
    QgsCoordinateTransform,
    QgsCsException,
    QgsMessageLog,
    QgsProject,
    QgsRasterLayer,
    QgsTask,
)
from qgis.PyQt.QtCore import QObject, QTimer, pyqtSignal

from .styling import apply_style, calculate_style


class CanvasFollowManager(QObject):
    statusChanged = pyqtSignal(str)
    updated = pyqtSignal(str)

    def __init__(self, iface):
        super().__init__(iface.mainWindow())
        self.iface = iface
        self.layers = {}
        self.callbacks = {}
        self.task = None
        self.queue = []
        self.revision = 0
        self.closed = False
        self.applying = False
        self.timer = QTimer(self)
        self.timer.setSingleShot(True)
        self.timer.setInterval(350)
        self.timer.timeout.connect(self.start_updates)
        iface.mapCanvas().extentsChanged.connect(self.canvas_changed)
        QgsProject.instance().layersWillBeRemoved.connect(self.remove_layers)
        QgsProject.instance().readProject.connect(self.restore_project)

    def watch(self, layer, settings):
        self.unwatch(layer.id())
        self.layers[layer.id()] = json.loads(json.dumps(settings))
        self.layers[layer.id()]["dynamic_follow"] = True
        layer_id = layer.id()
        callback = lambda: self.external_style_changed(layer_id)
        layer.styleChanged.connect(callback)
        self.callbacks[layer.id()] = callback
        layer.setCustomProperty("georamp/stretch", json.dumps(self.layers[layer.id()]))
        layer.setCustomProperty("georamp/follow_status", "active")
        self.statusChanged.emit(f"Following {len(self.layers)} applied layer(s)")

    def external_style_changed(self, layer_id):
        if not self.applying:
            self.unwatch(layer_id)

    def unwatch(self, layer_id):
        self.layers.pop(layer_id, None)
        callback = self.callbacks.pop(layer_id, None)
        layer = QgsProject.instance().mapLayer(layer_id)
        if callback and layer:
            try:
                layer.styleChanged.disconnect(callback)
            except (RuntimeError, TypeError):
                pass
        if layer:
            layer.setCustomProperty("georamp/follow_status", "stopped")
            try:
                state = json.loads(layer.customProperty("georamp/stretch", "{}"))
                state["dynamic_follow"] = False
                layer.setCustomProperty("georamp/stretch", json.dumps(state))
            except (ValueError, TypeError):
                pass
        self.statusChanged.emit(f"Following {len(self.layers)} applied layer(s)")

    def stop(self):
        self.revision += 1
        self.timer.stop()
        self.queue.clear()
        for layer_id in list(self.layers):
            self.unwatch(layer_id)
        if self.task:
            self.task.cancel()

    def remove_layers(self, layer_ids):
        for layer_id in layer_ids:
            self.unwatch(layer_id)

    def restore_project(self, *unused):
        candidates = []
        for layer in QgsProject.instance().mapLayers().values():
            if not isinstance(layer, QgsRasterLayer):
                continue
            try:
                state = json.loads(layer.customProperty("georamp/stretch", "{}"))
                if state.get("scope") == "follow" and state.get("dynamic_follow"):
                    candidates.append((layer, state))
            except (ValueError, TypeError):
                continue
        self.stop()
        for layer, state in candidates:
            self.watch(layer, state)

    def canvas_changed(self):
        if self.closed or not self.layers:
            return
        self.revision += 1
        if self.task:
            self.task.cancel()
        self.timer.start()

    def start_updates(self):
        if self.closed:
            return
        self.queue = list(self.layers)
        if self.task:
            self.task.cancel()
        else:
            self.start_next()

    def start_next(self):
        if self.closed or self.timer.isActive() or self.task:
            return
        while self.queue:
            layer_id = self.queue.pop(0)
            layer = QgsProject.instance().mapLayer(layer_id)
            state = self.layers.get(layer_id)
            if not isinstance(layer, QgsRasterLayer) or state is None:
                continue
            try:
                self.start_layer(layer, state)
            except (ValueError, RuntimeError, QgsCsException) as error:
                self.report_error(layer, str(error))
                continue
            break

    def start_layer(self, layer, state):
        from .plugin import TEXT, analyse_raster_task

        canvas = self.iface.mapCanvas()
        extent = canvas.extent()
        source_crs = canvas.mapSettings().destinationCrs()
        if source_crs != layer.crs():
            extent = QgsCoordinateTransform(
                source_crs, layer.crs(), QgsProject.instance().transformContext()
            ).transformBoundingBox(extent)
        band = int(state["band"])
        if not 1 <= band <= layer.bandCount():
            raise ValueError("The saved GeoRamp band is not available.")
        provider = layer.dataProvider()
        revision = self.revision
        layer_id = layer.id()

        def finished(error, result=None):
            self.task = None
            if self.closed:
                return
            target = QgsProject.instance().mapLayer(layer_id)
            if target and layer_id in self.layers and revision == self.revision:
                if error:
                    self.report_error(target, str(error))
                elif result:
                    try:
                        calculated = calculate_style(result, state)
                        self.applying = True
                        try:
                            next_state = apply_style(target, calculated, state)
                            self.layers[target.id()] = next_state
                            target.setCustomProperty("georamp/follow_status", "active")
                            self.iface.layerTreeView().refreshLayerSymbology(
                                target.id()
                            )
                        finally:
                            self.applying = False
                        self.updated.emit(target.id())
                        self.statusChanged.emit(
                            f"Updated canvas stretch: {target.name()}"
                        )
                    except (ValueError, RuntimeError) as failure:
                        self.report_error(target, str(failure))
            self.start_next()

        self.task = QgsTask.fromFunction(
            "GeoRamp — follow canvas",
            analyse_raster_task,
            on_finished=finished,
            source=layer.source(),
            provider_type=layer.providerType(),
            layer_id=layer.id(),
            band=band,
            manual=state.get("manual", False),
            manual_minimum=state["minimum"],
            manual_maximum=state["maximum"],
            use_percentiles=state.get("percentiles", False)
            and not state.get("manual", False),
            low_percentile=state.get("low_percentile", 2.0),
            high_percentile=state.get("high_percentile", 98.0),
            messages=TEXT["en"],
            sample_extent=(
                extent.xMinimum(),
                extent.yMinimum(),
                extent.xMaximum(),
                extent.yMaximum(),
            ),
            scope="follow",
            revision=revision,
            user_nodata=[
                (item.min(), item.max()) for item in provider.userNoDataValues(band)
            ],
            use_source_nodata=provider.useSourceNoDataValue(band),
        )
        QgsApplication.taskManager().addTask(self.task)

    def report_error(self, layer, message):
        layer.setCustomProperty("georamp/follow_status", message)
        self.statusChanged.emit(message)
        QgsMessageLog.logMessage(f"{layer.name()}: {message}", "GeoRamp", Qgis.Warning)

    def shutdown(self):
        self.closed = True
        self.stop()
        self.iface.mapCanvas().extentsChanged.disconnect(self.canvas_changed)
        QgsProject.instance().layersWillBeRemoved.disconnect(self.remove_layers)
        QgsProject.instance().readProject.disconnect(self.restore_project)
