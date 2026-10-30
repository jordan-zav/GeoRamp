"""Exercise the packaged GUI using real QGIS and synthetic raster data."""

import argparse
import faulthandler
import hashlib
import json
import os
import sys
import time
import zipfile
from pathlib import Path

faulthandler.enable()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("bundle", type=Path)
args = parser.parse_args()
session = Path(os.environ["DEVRESOURCES_SESSION"]) / (
    "qgis_smoke_" + str(time.time_ns())
)
session.mkdir()
os.environ["QT_QPA_PLATFORM"] = "offscreen"
os.environ["QGIS_CUSTOM_CONFIG_PATH"] = str(session / "profile")
os.environ["QGIS_AUTH_DB_DIR_PATH"] = str(session / "profile/auth")
with zipfile.ZipFile(args.bundle) as archive:
    assert all(
        name.startswith("georamp/") and ".." not in Path(name).parts
        for name in archive.namelist()
    )
    archive.extractall(session / "plugins")
sys.path.insert(0, str(session / "plugins"))

import numpy as np
from osgeo import gdal, osr
from qgis.core import (
    Qgis,
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsGeometry,
    QgsProject,
    QgsRasterLayer,
    QgsRasterRange,
    QgsRectangle,
    QgsSettings,
    QgsVectorLayer,
)
from qgis.gui import QgsMapCanvas
from qgis.PyQt.QtCore import QEvent, QPoint, QPointF, Qt, QTimer
from qgis.PyQt.QtGui import QColor, QFont, QFontDatabase, QMouseEvent
from qgis.PyQt.QtTest import QTest
from qgis.PyQt.QtWidgets import QApplication, QDoubleSpinBox, QMainWindow, QMessageBox

gdal.UseExceptions()
osr.UseExceptions()
app = QgsApplication([], True)
app.initQgis()
font = Path("C:/Windows/Fonts/arial.ttf")
if font.is_file():
    QFontDatabase.addApplicationFont(str(font))
    app.setFont(QFont("Arial", 10))
QgsSettings().setValue("georamp/language", "en")
QgsSettings().setValue("georamp/render", "continuous")
warnings = []
QMessageBox.warning = lambda *args: warnings.append(str(args[-1]))
QMessageBox.information = lambda *args: None
from georamp import classFactory
from georamp.curves import validate_curve

source = session / "synthetic_dem.tif"
y, x = np.mgrid[:192, :256]
dem = (
    200
    + 0.35 * x
    - 0.6 * y
    + 70 * np.sin(x / 28)
    + 35 * np.cos(y / 19)
    + 850 * np.exp(-((x - 205) ** 2 + (y - 45) ** 2) / 900)
).astype(np.float32)
dem[:15, :30] = -9999
dem[25:35, 50:70] = -1234  # User-defined NoData, not the file's source sentinel.
dem[40:45, 90:100] = np.nan
ds = gdal.GetDriverByName("GTiff").Create(str(source), 256, 192, 2, gdal.GDT_Float32)
crs_osr = osr.SpatialReference()
crs_osr.ImportFromEPSG(32718)
ds.SetProjection(crs_osr.ExportToWkt())
ds.SetGeoTransform((400000, 10, 0, 8601920, 0, -10))
second_band = dem * 2 + 500
second_band[dem == -9999] = -9999
second_band[dem == -1234] = -1234
for band, array in ((1, dem), (2, second_band)):
    ds.GetRasterBand(band).WriteArray(array)
    ds.GetRasterBand(band).SetNoDataValue(-9999)
ds = None
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
layer = QgsRasterLayer(str(source), "Synthetic DEM with local high and NoData", "gdal")
assert layer.isValid()
layer.dataProvider().setUserNoDataValue(1, [QgsRasterRange(-1234, -1234)])
layer.dataProvider().setUserNoDataValue(2, [QgsRasterRange(-1234, -1234)])
project = QgsProject.instance()
project.addMapLayer(layer)
project.setCrs(layer.crs())


class Interface:
    def __init__(self):
        self.window = QMainWindow()
        self.window.resize(1450, 900)
        self.canvas = QgsMapCanvas(self.window)
        self.window.setCentralWidget(self.canvas)
        self.canvas.setDestinationCrs(layer.crs())
        self.canvas.setLayers([layer])
        self.canvas.setExtent(layer.extent())
        self.window.show()

    def mainWindow(self):
        return self.window

    def mapCanvas(self):
        return self.canvas

    def layerTreeView(self):
        return self

    def refreshLayerSymbology(self, *args):
        pass

    def addPluginToRasterMenu(self, *args):
        pass

    def removePluginRasterMenu(self, *args):
        pass

    def addToolBarIcon(self, *args):
        pass

    def removeToolBarIcon(self, *args):
        pass


def wait_until(predicate, seconds=90):
    limit = time.monotonic() + seconds
    while time.monotonic() < limit:
        app.processEvents()
        if predicate():
            return
        time.sleep(0.02)
    raise AssertionError("Timed out waiting for GeoRamp")


iface = Interface()
plugin = classFactory(iface)
plugin.initGui()
plugin.run()
dialog = plugin.dialog
dialog.resize(1560, 1040)


def settled():
    wait_until(
        lambda: (
            dialog.active_task is None
            and not dialog.live_timer.isActive()
            and dialog.last_analysis is not None
        )
    )
    assert not warnings, warnings


settled()
whole = dict(dialog.last_analysis)
assert whole["minimum"] > -1234
assert whole["sample_count"] < 512 * 512
assert whole["sample_count"] > 200000
assert dialog.preview_layer.dataProvider().userNoDataValues(1)
print("PASS whole-raster statistics, source/user NoData and live GUI", flush=True)

dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("canvas"))
iface.canvas.setExtent(QgsRectangle(400100, 8600300, 400900, 8601400))
dialog.capture_canvas_extent()
settled()
fixed = dict(dialog.last_analysis)
assert fixed["maximum"] < whole["maximum"] - 100
iface.canvas.setExtent(QgsRectangle(401700, 8600700, 402400, 8601700))
app.processEvents()
time.sleep(0.45)
app.processEvents()
assert dialog.last_analysis["sample_extent"] == fixed["sample_extent"]
dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("follow"))
settled()
assert dialog.last_analysis["maximum"] > fixed["maximum"] + 100
assert dialog.last_analysis["sample_extent"] != fixed["sample_extent"]
old_revision = dialog.last_analysis["revision"]
iface.canvas.setExtent(QgsRectangle(400100, 8600200, 400850, 8601000))
settled()
assert dialog.last_analysis["revision"] > old_revision
print("PASS fixed canvas versus follow-canvas updates", flush=True)

# Apply arms following for project layers, independently of dialog visibility.
dialog.start_calculation("apply")
settled()
manager = plugin.follow_manager
assert layer.id() in manager.layers
before_follow = json.loads(layer.customProperty("georamp/stretch"))
second_layer = QgsRasterLayer(str(source), "Second followed DEM", "gdal")
project.addMapLayer(second_layer)
gray_state = dict(
    before_follow, palette=[[0.0, "#ff000000"], [1.0, "#ffffffff"]], bins=16
)
manager.watch(second_layer, gray_state)
dialog.close()
iface.canvas.setExtent(QgsRectangle(401700, 8600700, 402400, 8601700))
wait_until(
    lambda: (
        json.loads(layer.customProperty("georamp/stretch"))["sample_extent"]
        != before_follow["sample_extent"]
    )
)
wait_until(
    lambda: (
        second_layer.customProperty("georamp/follow_status") == "active"
        and second_layer.renderer().type() == "singlebandpseudocolor"
        and manager.task is None
    )
)
gray_metadata = json.loads(second_layer.customProperty("georamp/stretch"))
color = (
    second_layer.renderer()
    .shader()
    .rasterShaderFunction()
    .shade((gray_metadata["minimum"] + gray_metadata["maximum"]) / 2)
)
assert color[1] == color[2] == color[3]
assert manager.layers
assert not dialog.isVisible()
assert layer.renderer().classificationMax() != before_follow["maximum"]
plugin.run()
settled()
assert dialog.extent_combo.currentData() == "follow"
dialog.follow_stop_button.click()
assert not manager.layers
stopped = layer.renderer().classificationMax()
iface.canvas.setExtent(QgsRectangle(400100, 8600200, 400850, 8601000))
settled()
assert layer.renderer().classificationMax() == stopped
project.removeMapLayer(second_layer.id())
print(
    "PASS automatic applied-layer stretch after closing the GUI and explicit stop",
    flush=True,
)

dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("custom"))
custom = QgsRectangle(400150, 8600300, 400750, 8601100)
dialog.extent_widget.setOutputExtentFromUser(custom, layer.crs())
settled()
np.testing.assert_allclose(
    dialog.last_analysis["sample_extent"], [400150, 8600300, 400750, 8601100], atol=1e-6
)
geographic = QgsCoordinateReferenceSystem("EPSG:4326")
transform = QgsCoordinateTransform(layer.crs(), geographic, project.transformContext())
dialog.extent_widget.setOutputExtentFromUser(
    transform.transformBoundingBox(custom), geographic
)
settled()
expected = QgsCoordinateTransform(
    geographic, layer.crs(), project.transformContext()
).transformBoundingBox(transform.transformBoundingBox(custom))
np.testing.assert_allclose(
    dialog.last_analysis["sample_extent"],
    [
        expected.xMinimum(),
        expected.yMinimum(),
        expected.xMaximum(),
        expected.yMaximum(),
    ],
    atol=0.01,
    rtol=0,
)
dialog.extent_widget.setOutputExtentFromUser(QgsRectangle(0, 0, 10, 10), layer.crs())
wait_until(lambda: dialog.active_task is None and not dialog.live_timer.isActive())
assert dialog.last_analysis is None
assert "overlap" in dialog.viewer_message.text()

# Use QGIS's actual draw-on-canvas map tool, including hide/show of the dialog.
dialog.extent_widget.setOutputExtentFromDrawOnCanvas()
app.processEvents()
assert not dialog.isVisible()
canvas = iface.canvas
start = QPoint(canvas.width() // 4, canvas.height() // 4)
end = QPoint(canvas.width() * 3 // 4, canvas.height() * 3 // 4)
QTest.mousePress(canvas.viewport(), Qt.LeftButton, pos=start)
QTest.mouseMove(canvas.viewport(), end, delay=30)
app.processEvents()
QTest.mouseRelease(canvas.viewport(), Qt.LeftButton, pos=end)
wait_until(dialog.isVisible)
settled()
assert dialog.last_analysis["scope"] == "custom"
assert dialog.last_analysis["sample_extent"] != whole["sample_extent"]
print("PASS native draw-on-canvas rectangle", flush=True)
dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("whole"))
settled()
print("PASS custom extent, CRS transform and no-overlap rejection", flush=True)

# An ROI triangle has the same bounding box as the DEM but excludes its high.
area = QgsVectorLayer("Polygon?crs=EPSG:32718", "Triangle ROI", "memory")
feature = QgsFeature()
feature.setGeometry(
    QgsGeometry.fromWkt(
        "POLYGON((400000 8600000,402560 8600000,400000 8601920,400000 8600000))"
    )
)
area.dataProvider().addFeatures([feature])
project.addMapLayer(area)
dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("polygon"))
dialog.area_layer.setLayer(area)
settled()
assert dialog.last_analysis["maximum"] < whole["maximum"] - 100
assert dialog.last_analysis["sample_count"] < whole["sample_count"] * 0.6
assert dialog.last_analysis["area_wkb_hex"]
dialog.area_selected.setChecked(True)
wait_until(lambda: dialog.active_task is None and not dialog.live_timer.isActive())
assert dialog.last_analysis is None
area.selectAll()
settled()
assert dialog.last_analysis["area_wkb_hex"]
geo_area = QgsVectorLayer("Polygon?crs=EPSG:4326", "Geographic ROI", "memory")
geo_feature = QgsFeature()
geo_geometry = QgsGeometry(next(area.getFeatures()).geometry())
geo_geometry.transform(transform)
geo_feature.setGeometry(geo_geometry)
geo_area.dataProvider().addFeatures([geo_feature])
project.addMapLayer(geo_area)
dialog.area_selected.setChecked(False)
dialog.area_layer.setLayer(geo_area)
settled()
assert dialog.last_analysis["maximum"] < whole["maximum"] - 100
assert dialog.last_analysis["sample_count"] < whole["sample_count"] * 0.6
dialog.area_layer.setLayer(area)
settled()
dialog.start_calculation("apply")
settled()
polygon_style = session / "polygon_roi.qml"
message, ok = layer.saveNamedStyle(str(polygon_style))
assert ok, message
polygon_state = json.loads(layer.customProperty("georamp/stretch"))
dialog.extent_combo.setCurrentIndex(0)
settled()
assert dialog.restore_stretch_style(layer)
assert dialog.extent_combo.currentData() == "polygon"
assert dialog._drawn_polygon[0].hex() == polygon_state["area_wkb_hex"]
dialog.manual_check.setChecked(False)
dialog.queue_live_analysis()
settled()
assert dialog.last_analysis["maximum"] < whole["maximum"] - 100

holes = QgsVectorLayer("Polygon?crs=EPSG:32718", "ROI with a hole", "memory")
feature = QgsFeature()
feature.setGeometry(
    QgsGeometry.fromWkt(
        "POLYGON((400000 8600000,402560 8600000,402560 8601920,400000 8601920,400000 8600000),(401700 8601000,401700 8601750,402400 8601750,402400 8601000,401700 8601000))"
    )
)
holes.dataProvider().addFeatures([feature])
project.addMapLayer(holes)
dialog.area_selected.setChecked(False)
dialog.area_layer.setLayer(holes)
settled()
assert dialog.last_analysis["maximum"] < whole["maximum"] - 100
assert dialog.last_analysis["sample_count"] < whole["sample_count"]
dialog.start_polygon_draw()
app.processEvents()
assert not dialog.isVisible()
for point in (
    QPoint(canvas.width() // 4, canvas.height() * 3 // 4),
    QPoint(canvas.width() * 3 // 4, canvas.height() * 3 // 4),
    QPoint(canvas.width() // 4, canvas.height() // 4),
):
    QTest.mouseClick(canvas.viewport(), Qt.LeftButton, pos=point)
QTest.mouseClick(
    canvas.viewport(),
    Qt.RightButton,
    pos=QPoint(canvas.width() // 4, canvas.height() // 4),
)
wait_until(dialog.isVisible)
settled()
assert dialog._drawn_polygon
assert dialog._polygon_tool is None
dialog.start_polygon_draw()
QTest.keyClick(canvas, Qt.Key_Escape)
wait_until(dialog.isVisible)
assert dialog._polygon_tool is None
dialog.tabs.setCurrentIndex(0)
dialog.resize(1120, 700)
app.processEvents()
assert dialog.controls_scroll.verticalScrollBar().maximum() > 0
dialog.controls_scroll.ensureWidgetVisible(dialog.draw_polygon_button)
dialog.resize(1560, 1040)
dialog.extent_combo.setCurrentIndex(0)
settled()
print(
    "PASS real polygon mask, holes, selection, ROI QML and draw/cancel controls",
    flush=True,
)

dialog.log_shift.setChecked(True)
dialog.method_combo.setCurrentIndex(dialog.method_combo.findData("log_linear"))
assert dialog.histogram_label.transfer
before = list(dialog.histogram_label.transfer)
dialog.method_combo.setCurrentIndex(dialog.method_combo.findData("equal_area"))
assert dialog.histogram_label.transfer != before
dialog.method_combo.setCurrentIndex(dialog.method_combo.findData("normal"))
assert dialog.histogram_label.transfer
dialog.method_combo.setCurrentIndex(dialog.method_combo.findData("linear"))
dialog.tabs.setCurrentIndex(1)
app.processEvents()
dialog.edit_curve_check.setChecked(True)
assert dialog.method_combo.currentData() == "custom"
hist = dialog.histogram_label
start_count = len(dialog.custom_curve)
lo, hi = dialog.last_analysis["minimum"], dialog.last_analysis["maximum"]
position = hist.to_pixel(lo + 0.37 * (hi - lo), 0.42).toPoint()
QTest.mouseDClick(hist, Qt.LeftButton, pos=position)
app.processEvents()
assert len(dialog.custom_curve) == start_count + 1
selected = hist.selected
old = dialog.custom_curve[selected]
start = hist.to_pixel(*hist.controls[selected]).toPoint()
QTest.mousePress(hist, Qt.LeftButton, pos=start)
assert hist.dragging == selected, (
    hist.dragging,
    selected,
    start,
    hist.controls[selected],
)
QTest.mouseMove(hist, start + QPoint(8, -6), delay=30)
QApplication.sendEvent(
    hist,
    QMouseEvent(
        QEvent.MouseMove,
        QPointF(start + QPoint(8, -6)),
        Qt.NoButton,
        Qt.LeftButton,
        Qt.NoModifier,
    ),
)
app.processEvents()
QTest.mouseRelease(hist, Qt.LeftButton, pos=start + QPoint(8, -6))
assert dialog.custom_curve[selected] != old
validate_curve(dialog.custom_curve)
before_key = dialog.custom_curve[selected]
QTest.keyClick(hist, Qt.Key_Left)
assert dialog.custom_curve[selected] != before_key
QTest.keyClick(hist, Qt.Key_Delete)
assert len(dialog.custom_curve) == start_count

# Set a simple curve to exercise endpoint repositioning and exact numeric entry.
dialog.custom_curve = [(0.0, 0.0), (0.5, 0.75), (1.0, 1.0)]
dialog.refresh_curve_preview()
dialog.edit_curve_check.setChecked(False)
dialog.refresh_live_style()
assert not hist.editable
dialog.edit_curve_check.setChecked(True)
old_minimum = dialog.last_analysis["minimum"]
point = hist.to_pixel(lo + 0.1 * (hi - lo), 0.02).toPoint()
QTest.mouseDClick(hist, Qt.LeftButton, pos=point)
assert dialog.manual_check.isChecked()
assert dialog.last_analysis["minimum"] > old_minimum


def enter_exact_value():
    active = QApplication.activeModalWidget()
    assert active is not None
    spin = active.findChild(QDoubleSpinBox)
    spin.setValue(dialog.last_analysis["maximum"] - 5)
    active.accept()


QTimer.singleShot(50, enter_exact_value)
QTest.mouseDClick(hist, Qt.LeftButton, pos=hist.to_pixel(*hist.controls[-1]).toPoint())
validate_curve(dialog.custom_curve)
assert dialog.histogram_label.transfer
print(
    "PASS GUI double-click, drag, delete, min/max and numeric curve editing", flush=True
)

dialog.start_calculation("apply")
settled()
state = json.loads(layer.customProperty("georamp/stretch"))
assert state["method"] == "custom"
qml = session / "custom_stretch.qml"
message, ok = layer.saveNamedStyle(str(qml))
assert ok, message
restored = QgsRasterLayer(str(source), "QML restored", "gdal")
message, ok = restored.loadNamedStyle(str(qml))
assert ok, message
assert restored.customProperty("georamp/stretch")
restored_block = restored.renderer().block(1, restored.extent(), 256, 192)
assert QColor.fromRgba(restored_block.color(28, 55)).alpha() == 0
native = layer.renderer().shader().rasterShaderFunction()
roundtrip = restored.renderer().shader().rasterShaderFunction()
for value in (
    state["minimum"] - 100,
    state["minimum"],
    (state["minimum"] + state["maximum"]) / 2,
    state["maximum"],
    state["maximum"] + 100,
):
    assert native.shade(value) == roundtrip.shade(value)
assert dialog.restore_stretch_style(restored)
assert restored.dataProvider().userNoDataValues(1)
assert dialog.custom_curve == [tuple(point) for point in state["curve"]]
block = layer.renderer().block(1, layer.extent(), 256, 192)
assert QColor.fromRgba(block.color(2, 2)).alpha() == 0
assert QColor.fromRgba(block.color(28, 55)).alpha() == 0
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
print(
    "PASS QML renderer/curve round trip, NoData transparency and unchanged source",
    flush=True,
)

# Exercise discrete classes and repeat an extent calculation after QML restore.
dialog.render_combo.setCurrentIndex(dialog.render_combo.findData("discrete"))
calculated = dialog.calculate_breaks(dialog.last_analysis)
assert len(calculated[1]) == dialog.zones_spin.value()
renderer = dialog.create_renderer(layer, calculated)
assert renderer.shader().rasterShaderFunction().shade(state["maximum"] + 100)[0]
dialog.render_combo.setCurrentIndex(dialog.render_combo.findData("continuous"))
dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("canvas"))
settled()
dialog.band_spin.setValue(2)
settled()
assert dialog.last_analysis["band"] == 2
dialog.band_spin.setValue(1)
settled()
print("PASS discrete saturation, successive extent tasks and band changes", flush=True)

dialog.manual_check.setChecked(False)
dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("custom"))
dialog.extent_widget.setOutputExtentFromUser(custom, layer.crs())
settled()
dialog.custom_curve = [(0.0, 0.0), (0.22, 0.55), (0.68, 0.85), (1.0, 1.0)]
dialog.refresh_curve_preview()
images = Path(__file__).resolve().parents[1] / "assets/screenshots"
images.mkdir(parents=True, exist_ok=True)
dialog.tabs.setCurrentIndex(0)
dialog.viewer_canvas.refresh()
dialog.viewer_canvas.waitWhileRendering()
app.processEvents()
assert dialog.grab().save(str(images / "extent_stretch_configuration.png"))
dialog.tabs.setCurrentIndex(1)
dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("whole"))
settled()
dialog.refresh_curve_preview()
app.processEvents()
# An open transfer path must never inherit the histogram bar brush and fill
# a spurious polygon over the frequency data.
lo, hi = hist.plot_data[2:4]
pixel = hist.to_pixel(lo + 0.53 * (hi - lo), 0.62).toPoint()
assert hist.grab().toImage().pixelColor(pixel).lightness() > 240
assert dialog.grab().save(str(images / "editable_stretch_curve.png"))
dialog.language_combo.setCurrentIndex(dialog.language_combo.findData("es"))
assert dialog.edit_curve_check.text() == "Editar curva de estiramiento"
dialog.language_combo.setCurrentIndex(dialog.language_combo.findData("en"))

dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("follow"))
dialog.start_live_preview()
plugin.unload()
wait_until(lambda: not QgsApplication.taskManager().activeTasks())
assert not dialog._scope_connected
assert not dialog.live_timer.isActive()
print("PASS close/unload during active calculation and bilingual controls", flush=True)
report = {
    "status": "passed",
    "qgis_version": Qgis.QGIS_VERSION,
    "session": str(session),
    "bundle": str(args.bundle.resolve()),
    "source_sha256": source_hash,
    "screenshots": str(images),
}
(session / "validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print("VALIDATION", session / "validation.json", flush=True)
iface.window.close()
iface.canvas.stopRendering()
iface.canvas.setLayers([])
dialog.deleteLater()
iface.window.deleteLater()
app.processEvents()
QApplication.sendPostedEvents(None, QEvent.DeferredDelete)
restored = None
renderer = None
block = None
restored_block = None
native = None
roundtrip = None
project.clear()
layer = None
app.processEvents()
app.exitQgis()
