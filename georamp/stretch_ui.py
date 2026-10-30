"""Extent selection, curve manipulation and portable style metadata for the GUI."""

import bisect
import json
import math

from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsProject,
    QgsRasterRange,
    QgsRectangle,
)
from qgis.gui import QgsExtentWidget
from qgis.PyQt.QtCore import QSignalBlocker
from qgis.PyQt.QtGui import QColor
from qgis.PyQt.QtWidgets import (
    QCheckBox,
    QComboBox,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QPushButton,
)

from .areas import PolygonAreaMixin
from .curves import validate_curve
from .styling import result_style_state

TRANSLATIONS = {
    "en": {
        "stats_extent": "Statistics extent:",
        "extent_whole": "Whole raster",
        "extent_canvas": "Current map canvas (fixed)",
        "extent_follow": "Follow map canvas",
        "follow_stop": "Stop automatic stretching",
        "follow_hint": "Apply starts live canvas stretching for that layer. It remains active after closing this window; stop it here or from the Raster menu.",
        "extent_custom": "Custom rectangle",
        "extent_polygon": "Polygon area",
        "area_selected": "Use selected polygon features only",
        "area_draw": "Draw polygon on map",
        "area_layer_hint": "Choose a polygon layer or draw an area. Right-click/Enter finishes; Esc cancels. Holes and outside pixels are excluded.",
        "area_invalid": "Choose a valid, nonempty polygon area or selection with a defined CRS.",
        "area_drawn": "Using drawn/saved polygon area.",
        "capture_extent": "Capture current canvas",
        "extent_hint": "Only statistics and stretch limits use this area; the raster is not cropped.",
        "extent_empty": "The statistics extent does not overlap this raster, or contains no valid varying data.",
        "custom": "Custom stretch curve",
        "custom_help": "Monotone input-to-colour curve. Continuous rendering uses exact control/palette knots; intervals control discrete rendering.",
        "edit_curve": "Edit stretch curve",
        "reset_curve": "Reset curve",
        "curve_hint": "Double-click to add a point (bottom/top sets min/max); drag handles. Double-click a handle or Enter for exact values. Right-click/Delete removes an interior point. Arrow keys move the selected handle.",
        "input_value": "Raster input value:",
        "colour_position": "Colour position (%):",
        "curve_axis": "Green curve: input → colour position (right axis). Histogram: frequency (left axis).",
        "extent_sample": "Statistics area: {mode} · {extent}",
    },
    "es": {
        "stats_extent": "Extensión estadística:",
        "extent_whole": "Ráster completo",
        "extent_canvas": "Lienzo actual (fijo)",
        "extent_follow": "Seguir el lienzo",
        "follow_stop": "Detener estiramiento automático",
        "follow_hint": "Aplicar activa el estiramiento con el lienzo para esa capa. Continúa al cerrar esta ventana; detenlo aquí o en el menú Ráster.",
        "extent_custom": "Rectángulo personalizado",
        "extent_polygon": "Área poligonal",
        "area_selected": "Usar solo los polígonos seleccionados",
        "area_draw": "Dibujar polígono en el mapa",
        "area_layer_hint": "Elige una capa poligonal o dibuja el área. Clic derecho/Intro termina; Esc cancela. Se excluyen huecos y muestras exteriores.",
        "area_invalid": "Elige un área o selección poligonal válida, no vacía y con CRS definido.",
        "area_drawn": "Usando un área poligonal dibujada/guardada.",
        "capture_extent": "Capturar lienzo actual",
        "extent_hint": "El área solo determina estadísticas y límites del estiramiento; no recorta el ráster.",
        "extent_empty": "La extensión estadística no se superpone al ráster, o no contiene datos válidos variables.",
        "custom": "Curva de estiramiento personalizada",
        "custom_help": "Curva monótona de entrada a color. En continuo usa los nodos exactos de curva/rampa; los intervalos controlan las zonas discretas.",
        "edit_curve": "Editar curva de estiramiento",
        "reset_curve": "Restablecer curva",
        "curve_hint": "Doble clic añade un punto (abajo/arriba define mín./máx.); arrastra los nodos. Doble clic en un nodo o Intro permite valores exactos. Clic derecho/Supr elimina un punto interior. Las flechas mueven el nodo seleccionado.",
        "input_value": "Valor de entrada del ráster:",
        "colour_position": "Posición de color (%):",
        "curve_axis": "Curva verde: entrada → posición de color (eje derecho). Histograma: frecuencia (eje izquierdo).",
        "extent_sample": "Área estadística: {mode} · {extent}",
    },
}


class StretchControlsMixin(PolygonAreaMixin):
    def init_stretch_state(self):
        self.custom_curve = [(0.0, 0.0), (1.0, 1.0)]
        self._base_method = "linear"
        self._frozen_extent = None
        self._scope_connected = False
        self._stretch_updating = False
        self._closed = False
        self._revision = 0

    def build_extent_controls(self, form):
        self.extent_combo = QComboBox()
        for mode in ("whole", "canvas", "follow", "custom", "polygon"):
            self.extent_combo.addItem(self.t("extent_" + mode), mode)
        self.add_row(form, "stats_extent", self.extent_combo)
        self.capture_extent_button = QPushButton()
        self.capture_extent_button.clicked.connect(self.capture_canvas_extent)
        form.addRow(self.capture_extent_button)
        self.extent_widget = QgsExtentWidget(self)
        self.extent_widget.setMapCanvas(self.iface.mapCanvas())
        self.extent_widget.toggleDialogVisibility.connect(
            self.set_extent_dialog_visible
        )
        form.addRow(self.extent_widget)
        self.extent_hint = QLabel()
        self.extent_hint.setWordWrap(True)
        form.addRow(self.extent_hint)
        self.follow_status = QLabel()
        self.follow_status.setWordWrap(True)
        form.addRow(self.follow_status)
        self.follow_stop_button = QPushButton()
        self.follow_stop_button.clicked.connect(self.follow_manager.stop)
        form.addRow(self.follow_stop_button)
        self.follow_manager.statusChanged.connect(self.follow_status.setText)
        self.build_polygon_controls(form)
        self.extent_combo.currentIndexChanged.connect(self.extent_mode_changed)
        self.extent_widget.extentChanged.connect(self.custom_extent_changed)

    def set_extent_dialog_visible(self, visible):
        self.setVisible(visible)
        if visible:
            self.queue_live_analysis()

    def build_curve_controls(self, layout):
        row = QHBoxLayout()
        self.edit_curve_check = QCheckBox()
        self.curve_reset_button = QPushButton()
        self.edit_curve_check.toggled.connect(self.toggle_curve_edit)
        self.curve_reset_button.clicked.connect(self.reset_curve)
        row.addWidget(self.edit_curve_check)
        row.addWidget(self.curve_reset_button)
        row.addStretch()
        layout.addLayout(row)
        self.curve_hint = QLabel()
        self.curve_hint.setWordWrap(True)
        layout.addWidget(self.curve_hint)
        self.curve_axis_label = QLabel()
        self.curve_axis_label.setWordWrap(True)
        layout.addWidget(self.curve_axis_label)
        self.histogram_label.pointAdded.connect(self.add_curve_point)
        self.histogram_label.pointMoved.connect(self.move_curve_point)
        self.histogram_label.pointRemoved.connect(self.remove_curve_point)
        self.histogram_label.pointEditRequested.connect(self.edit_curve_point)

    def translate_stretch_controls(self):
        self.update_combo_text(
            self.extent_combo,
            {
                mode: self.t("extent_" + mode)
                for mode in ("whole", "canvas", "follow", "custom", "polygon")
            },
        )
        self.capture_extent_button.setText(self.t("capture_extent"))
        self.extent_hint.setText(self.t("extent_hint"))
        self.follow_stop_button.setText(self.t("follow_stop"))
        self.area_selected.setText(self.t("area_selected"))
        self.draw_polygon_button.setText(self.t("area_draw"))
        self.area_status.setText(
            self.t("area_drawn") if self._drawn_polygon else self.t("area_layer_hint")
        )
        self.edit_curve_check.setText(self.t("edit_curve"))
        self.curve_reset_button.setText(self.t("reset_curve"))
        self.curve_hint.setText(self.t("curve_hint"))
        self.curve_axis_label.setText(self.t("curve_axis"))
        self.update_extent_widgets()

    def connect_extent_canvas(self):
        if not self._scope_connected:
            self.iface.mapCanvas().extentsChanged.connect(self.canvas_extent_changed)
            self._scope_connected = True

    def disconnect_extent_canvas(self):
        if self._scope_connected:
            try:
                self.iface.mapCanvas().extentsChanged.disconnect(
                    self.canvas_extent_changed
                )
            except (TypeError, RuntimeError):
                pass
            self._scope_connected = False

    def canvas_extent_changed(self):
        if self.extent_combo.currentData() == "follow":
            self.queue_live_analysis()

    def update_extent_widgets(self):
        mode = self.extent_combo.currentData()
        self.capture_extent_button.setVisible(mode == "canvas")
        self.extent_widget.setVisible(mode == "custom")
        for widget in (
            self.area_layer,
            self.area_selected,
            self.draw_polygon_button,
            self.area_status,
        ):
            widget.setVisible(mode == "polygon")
        self.follow_status.setVisible(
            mode == "follow" or bool(self.follow_manager.layers)
        )
        self.follow_stop_button.setVisible(
            mode == "follow" or bool(self.follow_manager.layers)
        )
        self.follow_stop_button.setToolTip(self.t("follow_hint"))

    def capture_canvas_extent(self):
        canvas = self.iface.mapCanvas()
        self._frozen_extent = (
            QgsRectangle(canvas.extent()),
            canvas.mapSettings().destinationCrs(),
        )
        self.queue_live_analysis()

    def extent_mode_changed(self, *unused):
        if self._stretch_updating:
            return
        mode = self.extent_combo.currentData()
        if mode == "canvas":
            self.capture_canvas_extent()
        elif mode == "custom":
            canvas = self.iface.mapCanvas()
            layer = self.current_layer()
            if layer:
                self.extent_widget.setOutputCrs(layer.crs())
                self.extent_widget.setOriginalExtent(layer.extent(), layer.crs())
            self.extent_widget.setCurrentExtent(
                canvas.extent(), canvas.mapSettings().destinationCrs()
            )
            if self.extent_widget.outputExtent().isEmpty():
                self.extent_widget.setOutputExtentFromCurrent()
        self.update_extent_widgets()
        self.queue_live_analysis()

    def custom_extent_changed(self, *unused):
        if not self._stretch_updating and self.extent_combo.currentData() == "custom":
            self.queue_live_analysis()

    def extent_request(self, layer):
        mode = self.extent_combo.currentData()
        if mode == "whole":
            return None
        canvas = self.iface.mapCanvas()
        if mode == "custom":
            extent, crs = (
                self.extent_widget.outputExtent(),
                self.extent_widget.outputCrs(),
            )
        elif mode == "canvas" and self._frozen_extent:
            extent, crs = self._frozen_extent
        else:
            extent, crs = canvas.extent(), canvas.mapSettings().destinationCrs()
        if not crs.isValid() or not layer.crs().isValid() or extent.isEmpty():
            raise ValueError(self.t("extent_empty"))
        if crs != layer.crs():
            extent = QgsCoordinateTransform(
                crs, layer.crs(), QgsProject.instance().transformContext()
            ).transformBoundingBox(extent)
        return (
            extent.xMinimum(),
            extent.yMinimum(),
            extent.xMaximum(),
            extent.yMaximum(),
        )

    def seed_curve(self):
        if not hasattr(self, "_histogram_calculated"):
            self.custom_curve = [(0.0, 0.0), (1.0, 1.0)]
            return
        result, values, _, _ = self._histogram_calculated
        lo, hi = result["minimum"], result["maximum"]
        if hi <= lo or len(values) < 2:
            return
        # Use the actual rendered break-to-colour relationship, not raw PDF counts.
        candidates = {0.0: 0.0, 1.0: 1.0}
        for i, value in enumerate(values):
            x = (value - lo) / (hi - lo)
            if 0 < x < 1:
                candidates[x] = i / (len(values) - 1)
        points = sorted(candidates.items())
        if len(points) > 64:
            points = [points[round(i * (len(points) - 1) / 63)] for i in range(64)]
        self.custom_curve = validate_curve(points)

    def toggle_curve_edit(self, checked):
        if self._stretch_updating:
            return
        if checked and self.method_combo.currentData() != "custom":
            self.seed_curve()
            self.method_combo.setCurrentIndex(self.method_combo.findData("custom"))
        self.histogram_label.editable = checked
        self.histogram_label.update()

    def distribution_changed(self, *unused):
        if self.method_combo.currentData() == "custom" and not self._stretch_updating:
            if not self.edit_curve_check.isChecked():
                self.seed_curve()
            with QSignalBlocker(self.edit_curve_check):
                self.edit_curve_check.setChecked(True)
        self.update_controls()

    def reset_curve(self):
        self.custom_curve = [(0.0, 0.0), (1.0, 1.0)]
        with QSignalBlocker(self.edit_curve_check):
            self.edit_curve_check.setChecked(False)
        self.histogram_label.editable = False
        self.method_combo.setCurrentIndex(self.method_combo.findData(self._base_method))
        self.refresh_live_style()

    def refresh_curve_preview(self):
        if not self.last_analysis:
            return
        calculated = self.calculate_breaks(self.last_analysis)
        self.show_preview(calculated, activate=False)
        self.show_live_preview(calculated)

    def add_curve_point(self, value, colour):
        if not self.last_analysis or len(self.custom_curve) >= 64:
            return
        if colour <= 0.04:
            self.move_curve_point(0, value, 0)
            return
        if colour >= 0.96:
            self.move_curve_point(len(self.custom_curve) - 1, value, 1)
            return
        lo, hi = self.last_analysis["minimum"], self.last_analysis["maximum"]
        x = (value - lo) / (hi - lo)
        index = bisect.bisect_left([p[0] for p in self.custom_curve], x)
        if not 0 < index < len(self.custom_curve):
            return
        a, b = self.custom_curve[index - 1], self.custom_curve[index]
        if min(x - a[0], b[0] - x) < 1e-7:
            return
        colour = max(a[1], min(b[1], colour))
        self.custom_curve.insert(index, (x, colour))
        self.histogram_label.selected = index
        self.refresh_curve_preview()

    def move_curve_point(self, index, value, colour):
        if not self.last_analysis or not 0 <= index < len(self.custom_curve):
            return
        lo, hi = self.last_analysis["minimum"], self.last_analysis["maximum"]
        eps = (hi - lo) * 1e-7
        if index in (0, len(self.custom_curve) - 1):
            absolute = [(lo + x * (hi - lo), y) for x, y in self.custom_curve]
            if index == 0:
                lo = min(value, absolute[1][0] - eps)
            else:
                hi = max(value, absolute[-2][0] + eps)
            if not math.isfinite(hi - lo) or hi <= lo:
                return
            self.custom_curve = (
                [(0.0, 0.0)]
                + [((x - lo) / (hi - lo), y) for x, y in absolute[1:-1]]
                + [(1.0, 1.0)]
            )
            self._stretch_updating = True
            try:
                for widget, new_value in (
                    (self.minimum_spin, lo),
                    (self.maximum_spin, hi),
                ):
                    with QSignalBlocker(widget):
                        widget.setValue(new_value)
                with QSignalBlocker(self.manual_check):
                    self.manual_check.setChecked(True)
                from .plugin import HISTOGRAM_BINS, sampled_histogram

                self.last_analysis = dict(
                    self.last_analysis,
                    minimum=lo,
                    maximum=hi,
                    counts=sampled_histogram(
                        self.last_analysis["sorted_samples"], lo, hi, HISTOGRAM_BINS
                    ),
                )
            finally:
                self._stretch_updating = False
            self.update_controls()
        else:
            previous, next_point = (
                self.custom_curve[index - 1],
                self.custom_curve[index + 1],
            )
            x = max(
                previous[0] + 1e-7, min(next_point[0] - 1e-7, (value - lo) / (hi - lo))
            )
            y = max(previous[1], min(next_point[1], colour))
            self.custom_curve[index] = (x, y)
        validate_curve(self.custom_curve)
        self.refresh_curve_preview()

    def remove_curve_point(self, index):
        if 0 < index < len(self.custom_curve) - 1:
            self.custom_curve.pop(index)
            self.histogram_label.selected = None
            self.refresh_curve_preview()

    def edit_curve_point(self, index):
        if not self.last_analysis or not 0 <= index < len(self.custom_curve):
            return
        lo, hi = self.last_analysis["minimum"], self.last_analysis["maximum"]
        x, y = self.custom_curve[index]
        value, ok = QInputDialog.getDouble(
            self,
            self.t("edit_curve"),
            self.t("input_value"),
            lo + x * (hi - lo),
            -1e100,
            1e100,
            8,
        )
        if not ok:
            return
        if index not in (0, len(self.custom_curve) - 1):
            colour, ok = QInputDialog.getDouble(
                self,
                self.t("edit_curve"),
                self.t("colour_position"),
                y * 100,
                0,
                100,
                3,
            )
            if not ok:
                return
            y = colour / 100
        self.move_curve_point(index, value, y)

    def style_parameters(self):
        return {
            "method": self.method_combo.currentData(),
            "base_method": self._base_method,
            "curve": list(self.custom_curve),
            "band": self.band_spin.value(),
            "minimum": self.minimum_spin.value(),
            "maximum": self.maximum_spin.value(),
            "manual": self.manual_check.isChecked(),
            "percentiles": self.percentile_check.isChecked(),
            "low_percentile": self.low_percentile_spin.value(),
            "high_percentile": self.high_percentile_spin.value(),
            "render": self.render_combo.currentData(),
            "bins": self.zones_spin.value(),
            "sigma": self.sigma_spin.value(),
            "shift_log": self.log_shift.isChecked(),
            "compact_legend": self.compact_legend_check.isChecked(),
            "dynamic_follow": self.extent_combo.currentData() == "follow",
            "palette": [
                [x, colour.name(QColor.HexArgb)] for x, colour in self.active_stops()
            ],
        }

    def stretch_style_state(self, result):
        return result_style_state(self.style_parameters(), result)

    def restore_stretch_style(self, layer):
        from qgis.PyQt.QtGui import QColor

        raw = layer.customProperty("georamp/stretch", "")
        if not raw:
            return False
        try:
            state = json.loads(raw)
            if state.get("format") != "georamp-stretch" or state.get("version") != 1:
                return False
            points = validate_curve(state["curve"])
            lo, hi = float(state["minimum"]), float(state["maximum"])
            if not math.isfinite(hi - lo) or hi <= lo:
                return False
            palette = [(float(x), QColor(colour)) for x, colour in state["palette"]]
            if len(palette) < 2 or any(not c.isValid() for _, c in palette):
                return False
            widgets = (
                self.method_combo,
                self.manual_check,
                self.minimum_spin,
                self.maximum_spin,
                self.render_combo,
                self.zones_spin,
                self.band_spin,
                self.sigma_spin,
                self.log_shift,
                self.reverse_check,
                self.extent_combo,
                self.edit_curve_check,
                self.percentile_check,
                self.low_percentile_spin,
                self.high_percentile_spin,
            )
            blockers = [QSignalBlocker(widget) for widget in widgets]
            self._stretch_updating = True
            try:
                self.custom_curve = points
                self._base_method = state.get("base_method", "linear")
                self.method_combo.setCurrentIndex(
                    max(0, self.method_combo.findData(state["method"]))
                )
                self.render_combo.setCurrentIndex(
                    max(0, self.render_combo.findData(state["render"]))
                )
                self.zones_spin.setValue(int(state["bins"]))
                self.band_spin.setValue(int(state["band"]))
                layer.dataProvider().setUserNoDataValue(
                    int(state["band"]),
                    [
                        QgsRasterRange(float(low), float(high))
                        for low, high in state.get("user_nodata", [])
                    ],
                )
                layer.dataProvider().setUseSourceNoDataValue(
                    int(state["band"]), bool(state.get("use_source_nodata", True))
                )
                self.sigma_spin.setValue(float(state["sigma"]))
                self.log_shift.setChecked(bool(state["shift_log"]))
                watching = layer.id() in self.follow_manager.layers
                self.manual_check.setChecked(
                    state.get("manual", True) if watching else True
                )
                self.percentile_check.setChecked(state.get("percentiles", False))
                self.low_percentile_spin.setValue(float(state.get("low_percentile", 2)))
                self.high_percentile_spin.setValue(
                    float(state.get("high_percentile", 98))
                )
                self.minimum_spin.setValue(lo)
                self.maximum_spin.setValue(hi)
                self.reverse_check.setChecked(False)
                self.palette_stops = palette
                self.custom_palette_stops = palette
                self.custom_palette_name = "QML"
                self.refresh_palette_list("custom")
                self.palette_stops = palette
                self.extent_combo.setCurrentIndex(0)
                if state.get("area_wkb_hex") and state.get("scope") == "polygon":
                    self._drawn_polygon = (
                        bytes.fromhex(state["area_wkb_hex"]),
                        QgsCoordinateReferenceSystem(state["crs"]),
                    )
                    self.extent_combo.setCurrentIndex(
                        self.extent_combo.findData("polygon")
                    )
                    self.area_status.setText(self.t("area_drawn"))
                elif state.get("scope") == "follow" and watching:
                    self.extent_combo.setCurrentIndex(
                        self.extent_combo.findData("follow")
                    )
                elif state.get("sample_extent") and state.get("scope") != "whole":
                    self._frozen_extent = (
                        QgsRectangle(*state["sample_extent"]),
                        QgsCoordinateReferenceSystem(state["crs"]),
                    )
                    self.extent_combo.setCurrentIndex(
                        self.extent_combo.findData("canvas")
                    )
                self.edit_curve_check.setChecked(state["method"] == "custom")
                self.histogram_label.editable = state["method"] == "custom"
            finally:
                self._stretch_updating = False
                del blockers
            self.update_controls()
            self.update_extent_widgets()
            self.update_ramp_preview()
            return True
        except (ValueError, TypeError, KeyError, IndexError):
            return False
