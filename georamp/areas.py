"""Polygon ROI capture and main-thread geometry snapshots."""

from qgis.core import (
    QgsCoordinateTransform,
    QgsFeatureRequest,
    QgsGeometry,
    QgsMapLayerProxyModel,
    QgsPointXY,
    QgsProject,
    QgsWkbTypes,
)
from qgis.gui import QgsMapLayerComboBox, QgsMapTool, QgsRubberBand
from qgis.PyQt.QtCore import Qt, pyqtSignal
from qgis.PyQt.QtGui import QColor, QCursor
from qgis.PyQt.QtWidgets import QCheckBox, QLabel, QPushButton


class PolygonDrawTool(QgsMapTool):
    finished = pyqtSignal(object)
    cancelled = pyqtSignal()

    def __init__(self, canvas):
        super().__init__(canvas)
        self.vertices = []
        self.completed = False
        self.band = QgsRubberBand(canvas, QgsWkbTypes.PolygonGeometry)
        self.band.setColor(QColor(0, 160, 130, 70))
        self.band.setStrokeColor(QColor("#008577"))
        self.band.setWidth(2)
        self.setCursor(QCursor(Qt.CrossCursor))

    def draw(self, extra=None):
        points = self.vertices + ([extra] if extra else [])
        if len(points) >= 2:
            self.band.setToGeometry(
                QgsGeometry.fromPolygonXY([points + [points[0]]]), None
            )

    def finish(self):
        if len(self.vertices) < 3:
            self.cancel()
            return
        self.completed = True
        geometry = QgsGeometry.fromPolygonXY([self.vertices + [self.vertices[0]]])
        self.finished.emit(geometry)

    def cancel(self):
        if not self.completed:
            self.completed = True
            self.cancelled.emit()

    def canvasReleaseEvent(self, event):
        if event.button() == Qt.RightButton:
            self.finish()
        elif event.button() == Qt.LeftButton:
            self.vertices.append(QgsPointXY(self.toMapCoordinates(event.pos())))
            self.draw()

    def canvasMoveEvent(self, event):
        self.draw(QgsPointXY(self.toMapCoordinates(event.pos())))

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.cancel()
        elif event.key() in (Qt.Key_Return, Qt.Key_Enter):
            self.finish()
        elif event.key() == Qt.Key_Backspace and self.vertices:
            self.vertices.pop()
            self.draw()

    def deactivate(self):
        self.band.hide()
        self.cancel()
        super().deactivate()


class PolygonAreaMixin:
    def build_polygon_controls(self, form):
        self.area_layer = QgsMapLayerComboBox()
        self.area_layer.setFilters(QgsMapLayerProxyModel.PolygonLayer)
        self.area_layer.setAllowEmptyLayer(True)
        self.area_layer.setLayer(None)
        self.area_selected = QCheckBox()
        self.draw_polygon_button = QPushButton()
        self.area_status = QLabel()
        self.area_status.setWordWrap(True)
        self.area_layer.layerChanged.connect(self.area_layer_changed)
        self.area_selected.toggled.connect(self.queue_live_analysis)
        self.draw_polygon_button.clicked.connect(self.start_polygon_draw)
        for widget in (
            self.area_layer,
            self.area_selected,
            self.draw_polygon_button,
            self.area_status,
        ):
            form.addRow(widget)
        self._area_source_layer = None
        self._drawn_polygon = None
        self._polygon_tool = None
        self._previous_map_tool = None

    def area_layer_changed(self, layer):
        if self._area_source_layer:
            try:
                self._area_source_layer.selectionChanged.disconnect(
                    self.area_selection_changed
                )
                self._area_source_layer.dataChanged.disconnect(
                    self.area_selection_changed
                )
            except (RuntimeError, TypeError):
                pass
        self._area_source_layer = layer
        self._drawn_polygon = None
        if layer:
            layer.selectionChanged.connect(self.area_selection_changed)
            layer.dataChanged.connect(self.area_selection_changed)
        self.area_status.setText(self.t("area_layer_hint"))
        if self.extent_combo.currentData() == "polygon":
            self.queue_live_analysis()

    def area_selection_changed(self, *unused):
        if self.extent_combo.currentData() == "polygon":
            self._drawn_polygon = None
            self.queue_live_analysis()

    def start_polygon_draw(self):
        canvas = self.iface.mapCanvas()
        self._previous_map_tool = canvas.mapTool()
        self._polygon_tool = PolygonDrawTool(canvas)
        self._polygon_tool.finished.connect(self.polygon_drawn)
        self._polygon_tool.cancelled.connect(self.cancel_polygon_draw)
        canvas.setMapTool(self._polygon_tool)
        self.hide()

    def finish_polygon_tool(self, show=True):
        tool = self._polygon_tool
        if tool is not None:
            self._polygon_tool = None
            tool.completed = True
            tool.band.hide()
            canvas = self.iface.mapCanvas()
            if canvas.mapTool() == tool:
                if self._previous_map_tool is not None:
                    canvas.setMapTool(self._previous_map_tool)
                else:
                    canvas.unsetMapTool(tool)
            tool.deleteLater()
        if show:
            self.show()
            self.queue_live_analysis()

    def cancel_polygon_draw(self):
        self.finish_polygon_tool()

    def polygon_drawn(self, geometry):
        if geometry.isEmpty() or not geometry.isGeosValid():
            self.area_status.setText(self.t("area_invalid"))
        else:
            self._drawn_polygon = (
                bytes(geometry.asWkb()),
                self.iface.mapCanvas().mapSettings().destinationCrs(),
            )
            self.area_status.setText(self.t("area_drawn"))
        self.finish_polygon_tool()

    def area_geometry(self, target_layer):
        if not target_layer.crs().isValid():
            raise ValueError(self.t("area_invalid"))
        if self._drawn_polygon:
            data, crs = self._drawn_polygon
            geometry = QgsGeometry()
            geometry.fromWkb(data)
        else:
            source = self.area_layer.currentLayer()
            if not source or not source.crs().isValid():
                raise ValueError(self.t("area_invalid"))
            crs = source.crs()
            request = QgsFeatureRequest().setNoAttributes()
            features = (
                source.getSelectedFeatures(request)
                if self.area_selected.isChecked()
                else source.getFeatures(request)
            )
            geometries = []
            for feature in features:
                item = QgsGeometry(feature.geometry())
                if item.isNull() or item.isEmpty():
                    continue
                if not item.isGeosValid():
                    raise ValueError(self.t("area_invalid"))
                geometries.append(item)
            if not geometries:
                raise ValueError(self.t("area_invalid"))
            geometry = QgsGeometry.unaryUnion(geometries)
        if not crs.isValid() or geometry.isEmpty() or not geometry.isGeosValid():
            raise ValueError(self.t("area_invalid"))
        if geometry.requiresConversionToStraightSegments():
            geometry.convertToStraightSegment()
        if crs != target_layer.crs():
            geometry.transform(
                QgsCoordinateTransform(
                    crs, target_layer.crs(), QgsProject.instance().transformContext()
                )
            )
        if geometry.isEmpty() or not geometry.isGeosValid():
            raise ValueError(self.t("area_invalid"))
        return geometry

    def sampling_request(self, layer):
        if self.extent_combo.currentData() != "polygon":
            return self.extent_request(layer), None
        geometry = self.area_geometry(layer)
        rectangle = geometry.boundingBox()
        return (
            rectangle.xMinimum(),
            rectangle.yMinimum(),
            rectangle.xMaximum(),
            rectangle.yMaximum(),
        ), bytes(geometry.asWkb())
