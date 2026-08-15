import math
import os
import re

from qgis.PyQt.QtCore import Qt
from qgis.PyQt.QtGui import QColor, QIcon, QLinearGradient, QPainter, QPixmap
from qgis.PyQt.QtWidgets import (
    QAction, QCheckBox, QComboBox, QDialog, QDialogButtonBox,
    QDoubleSpinBox, QFileDialog, QFormLayout, QGroupBox, QHBoxLayout,
    QLabel, QMessageBox, QPushButton, QSpinBox, QTabWidget, QTableWidget,
    QTableWidgetItem, QVBoxLayout, QWidget,
)
from qgis.core import (
    QgsColorRampShader, QgsMapLayerType, QgsProject, QgsRasterBandStats,
    QgsRasterLayer, QgsRasterShader, QgsSettings,
    QgsSingleBandPseudoColorRenderer,
)

from .distributions import calculate_values

SAMPLE_SIZE = 250000
HISTOGRAM_BINS = 256
DEFAULT_BINS = 39
SETTINGS_PREFIX = "oasis_montaj_colour"


TEXT = {
    "es": {
        "window_title": "Oasis Montaj Colour",
        "plugin_group": "Plugin",
        "language": "Idioma:",
        "spanish": "Español",
        "english": "Inglés",
        "data_group": "1. Datos",
        "raster_layer": "Capa ráster:",
        "band": "Banda:",
        "refresh": "Actualizar",
        "ramp_group": "2. Rampa",
        "reverse": "Invertir",
        "import_table": "Importar tabla...",
        "method_group": "3. Distribución",
        "distribution": "Distribución:",
        "zones": "N\u00famero de intervalos:",
        "rendering": "Representación:",
        "normal_range": "Rango normal:",
        "log_linear": "Log-Linear:",
        "log_shift": "Desplazar datos si contienen ceros o negativos",
        "limits_group": "4. Límites",
        "manual_limits": "Usar límites manuales",
        "minimum": "Mínimo:",
        "maximum": "Máximo:",
        "read_band": "Leer de la banda",
        "config_tab": "Configuración",
        "preview_tab": "Histograma y cortes",
        "stats_ready": "Pulsa Previsualizar para calcular estadísticas.",
        "zone": "Zona",
        "minimum_bin": "M\u00ednimo",
        "maximum_bin": "M\u00e1ximo",
        "color": "Color",
        "preview": "Previsualizar",
        "continuous": "Continuo (interpolado)",
        "discrete": "Zonas discretas",
        "apply": "Aplicar",
        "close": "Cerrar",
        "palette_classic_geophysics": "Geof\u00edsica cl\u00e1sica",
        "palette_intense_geophysics": "Geof\u00edsica intensa",
        "palette_full_spectrum": "Espectro completo",
        "palette_viridis": "Viridis",
        "palette_terrain": "Terreno",
        "palette_blue_white_red": "Anomal\u00edas azul-blanco-rojo",
        "palette_grayscale": "Escala de grises",
        "linear": "Distribuci\u00f3n lineal",
        "normal": "Distribuci\u00f3n normal",
        "equal_area": "Distribuci\u00f3n de \u00e1rea igual (histograma)",
        "log_method": "Distribuci\u00f3n log-lineal",
        "linear_help": "Intervalos uniformes entre mínimo y máximo.",
        "normal_help": "Cortes según media, desviación estándar y rango sigma.",
        "equal_area_help": "Una cantidad similar de píxeles por intervalo.",
        "log_help": "Intervalos uniformes en escala logarítmica.",
        "no_raster_title": "Sin ráster",
        "no_raster": "Selecciona una capa ráster.",
        "preview_failed": "No se pudo previsualizar",
        "apply_failed": "No se pudo aplicar",
        "invalid_range": "El máximo debe ser mayor que el mínimo.",
        "histogram_failed": "No se pudo calcular el histograma en el rango indicado.",
        "stats": "Mínimo: {minimum:.8g}   Máximo: {maximum:.8g}   Media: {mean:.8g}   Desv.: {stddev:.8g}",
        "import_title": "Importar tabla",
        "table_filter": "Tablas (*.csv *.txt *.tbl *.zon *.clr *.lut);;Todos (*.*)",
        "invalid_table": "Tabla no válida",
        "imported": "Importada: {name}",
        "not_enough_rgb": "No se encontraron al menos dos filas RGB.",
        "rgb_range": "RGB debe estar entre 0 y 255.",
        "invalid_positions": "Las posiciones no son válidas.",
        "mixed_format": "Todas las filas deben tener el mismo formato.",
        "menu": "Oasis Montaj Colour",
    },
    "en": {
        "window_title": "Oasis Montaj Colour",
        "plugin_group": "Plugin",
        "language": "Language:",
        "spanish": "Spanish",
        "english": "English",
        "data_group": "1. Data",
        "raster_layer": "Raster layer:",
        "band": "Band:",
        "refresh": "Refresh",
        "ramp_group": "2. Ramp",
        "reverse": "Reverse",
        "import_table": "Import table...",
        "method_group": "3. Distribution",
        "distribution": "Distribution:",
        "zones": "Number of bins:",
        "rendering": "Rendering:",
        "normal_range": "Normal range:",
        "log_linear": "Log-Linear:",
        "log_shift": "Shift data if zeros or negatives are present",
        "limits_group": "4. Limits",
        "manual_limits": "Use manual limits",
        "minimum": "Minimum:",
        "maximum": "Maximum:",
        "read_band": "Read from band",
        "config_tab": "Configuration",
        "preview_tab": "Histogram and breaks",
        "stats_ready": "Click Preview to calculate statistics.",
        "zone": "Zone",
        "minimum_bin": "Minimum",
        "maximum_bin": "Maximum",
        "color": "Colour",
        "preview": "Preview",
        "continuous": "Continuous (interpolated)",
        "discrete": "Discrete zones",
        "apply": "Apply",
        "close": "Close",
        "palette_classic_geophysics": "Classic geophysics",
        "palette_intense_geophysics": "Intense geophysics",
        "palette_full_spectrum": "Full spectrum",
        "palette_viridis": "Viridis",
        "palette_terrain": "Terrain",
        "palette_blue_white_red": "Blue-white-red anomalies",
        "palette_grayscale": "Grayscale",
        "linear": "Linear Distribution",
        "normal": "Normal Distribution",
        "equal_area": "Equal Area (Histogram) Distribution",
        "log_method": "Log-Linear Distribution",
        "linear_help": "Uniform intervals between minimum and maximum.",
        "normal_help": "Breaks based on mean, standard deviation and sigma range.",
        "equal_area_help": "A similar number of pixels per interval.",
        "log_help": "Uniform intervals on a logarithmic scale.",
        "no_raster_title": "No raster",
        "no_raster": "Select a raster layer.",
        "preview_failed": "Preview failed",
        "apply_failed": "Apply failed",
        "invalid_range": "Maximum must be greater than minimum.",
        "histogram_failed": "The histogram could not be calculated for the selected range.",
        "stats": "Minimum: {minimum:.8g}   Maximum: {maximum:.8g}   Mean: {mean:.8g}   Std.: {stddev:.8g}",
        "import_title": "Import table",
        "table_filter": "Tables (*.csv *.txt *.tbl *.zon *.clr *.lut);;All (*.*)",
        "invalid_table": "Invalid table",
        "imported": "Imported: {name}",
        "not_enough_rgb": "At least two RGB rows were not found.",
        "rgb_range": "RGB values must be between 0 and 255.",
        "invalid_positions": "The positions are not valid.",
        "mixed_format": "All rows must use the same format.",
        "menu": "Oasis Montaj Colour",
    },
}


def make_palette(colours):
    return [(i / (len(colours) - 1), QColor(c)) for i, c in enumerate(colours)]


PALETTES = {
    "Geofísica clásica": make_palette([
        "#0000ff", "#0055ff", "#007fff", "#00aaff", "#00d4ff", "#00e9ff", "#00ffff",
        "#00ffc8", "#00ff91", "#00ff3f", "#00ff31", "#00ff24", "#00ff00", "#48ff00",
        "#63ff00", "#6dff00", "#8eff00", "#b6ff00", "#c9ff00", "#f4ff00", "#ffec00",
        "#ffd500", "#ffcb00", "#ffbc00", "#ffaf00", "#ffaa00", "#ff9400", "#ff8700",
        "#ff7700", "#ff6a00", "#ff5500", "#ff3500", "#ff1500", "#ff0000", "#ff0037",
        "#ff006d", "#ff00b6", "#ff0bda", "#ff41ec", "#ff79ff", "#ff9fff",
    ]),
    "Geofísica intensa": make_palette(["#000000", "#0000a0", "#006cff", "#00ffff", "#00c800", "#ffff00", "#ff7800", "#d00000", "#ffffff"]),
    "Espectro completo": make_palette(["#6a00a8", "#0000ff", "#00bfff", "#00ff80", "#ffff00", "#ff8000", "#ff0000"]),
    "Viridis": make_palette(["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"]),
    "Terreno": make_palette(["#0033a0", "#18a6a6", "#4caf50", "#d8c477", "#8c5a32", "#ffffff"]),
    "Anomalías azul-blanco-rojo": make_palette(["#053061", "#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b", "#67001f"]),
    "Escala de grises": make_palette(["#000000", "#ffffff"]),
}

PALETTE_TEXT_KEYS = (
    "palette_classic_geophysics",
    "palette_intense_geophysics",
    "palette_full_spectrum",
    "palette_viridis",
    "palette_terrain",
    "palette_blue_white_red",
    "palette_grayscale",
)


class ColourDialog(QDialog):
    def __init__(self, iface, parent=None):
        super().__init__(parent)
        self.iface = iface
        self.settings = QgsSettings()
        self.language = self.settings.value(f"{SETTINGS_PREFIX}/language", "es")
        if self.language not in TEXT:
            self.language = "es"
        self.palette_stops = list(PALETTES["Geofísica clásica"])
        self.form_labels = {}
        self._building_language = False

        self.setWindowTitle(self.t("window_title"))
        self.resize(760, 680)

        self.language_combo = QComboBox()
        self.language_combo.addItem(self.t("spanish"), "es")
        self.language_combo.addItem(self.t("english"), "en")
        self.language_combo.currentIndexChanged.connect(self.change_language)
        plugin_form = QFormLayout()
        self.add_row(plugin_form, "language", self.language_combo)
        self.plugin_group = QGroupBox()
        self.plugin_group.setLayout(plugin_form)

        self.layer_combo, self.band_spin = QComboBox(), QSpinBox()
        self.band_spin.setMinimum(1)
        self.refresh_button = QPushButton()
        self.refresh_button.clicked.connect(self.refresh_layers)
        layer_row = QHBoxLayout()
        layer_row.addWidget(self.layer_combo, 1)
        layer_row.addWidget(self.refresh_button)
        data_form = QFormLayout()
        self.add_row(data_form, "raster_layer", layer_row)
        self.add_row(data_form, "band", self.band_spin)
        self.data_group = QGroupBox()
        self.data_group.setLayout(data_form)

        self.palette_combo, self.reverse_check = QComboBox(), QCheckBox()
        for index, key in enumerate(PALETTE_TEXT_KEYS):
            self.palette_combo.addItem(self.t(key), index)
        self.palette_combo.currentIndexChanged.connect(self.select_palette)
        self.reverse_check.toggled.connect(self.update_ramp_preview)
        self.import_button = QPushButton()
        self.import_button.clicked.connect(self.import_palette)
        ramp_row = QHBoxLayout()
        ramp_row.addWidget(self.palette_combo, 1)
        ramp_row.addWidget(self.reverse_check)
        ramp_row.addWidget(self.import_button)
        self.ramp_preview = QLabel()
        self.ramp_preview.setFixedHeight(28)
        ramp_layout = QVBoxLayout()
        ramp_layout.addLayout(ramp_row)
        ramp_layout.addWidget(self.ramp_preview)
        self.ramp_group = QGroupBox()
        self.ramp_group.setLayout(ramp_layout)

        self.method_combo, self.render_combo = QComboBox(), QComboBox()
        for key in ("linear", "normal", "equal_area", "log_method"):
            method = "log_linear" if key == "log_method" else key
            self.method_combo.addItem(self.t(key), method)
        self.render_combo.addItem(self.t("continuous"), "continuous")
        self.render_combo.addItem(self.t("discrete"), "discrete")
        self.zones_spin = QSpinBox()
        self.zones_spin.setRange(2, 255)
        self.zones_spin.setValue(DEFAULT_BINS)
        self.sigma_spin = QDoubleSpinBox()
        self.sigma_spin.setRange(.5, 6)
        self.sigma_spin.setValue(2)
        self.sigma_spin.setSuffix(" sigma")
        self.log_shift = QCheckBox()
        self.method_help = QLabel()
        self.method_help.setWordWrap(True)
        method_form = QFormLayout()
        self.add_row(method_form, "distribution", self.method_combo)
        method_form.addRow("", self.method_help)
        self.add_row(method_form, "zones", self.zones_spin)
        self.add_row(method_form, "rendering", self.render_combo)
        self.add_row(method_form, "normal_range", self.sigma_spin)
        self.add_row(method_form, "log_linear", self.log_shift)
        self.method_group = QGroupBox()
        self.method_group.setLayout(method_form)

        self.manual_check = QCheckBox()
        self.minimum_spin, self.maximum_spin = self.value_spin(), self.value_spin()
        self.read_button = QPushButton()
        self.read_button.clicked.connect(self.read_limits)
        limits_form = QFormLayout()
        limits_form.addRow(self.manual_check)
        self.add_row(limits_form, "minimum", self.minimum_spin)
        self.add_row(limits_form, "maximum", self.maximum_spin)
        limits_form.addRow("", self.read_button)
        self.limits_group = QGroupBox()
        self.limits_group.setLayout(limits_form)

        config = QVBoxLayout()
        config.addWidget(self.plugin_group)
        config.addWidget(self.data_group)
        config.addWidget(self.ramp_group)
        config.addWidget(self.method_group)
        config.addWidget(self.limits_group)
        config.addStretch()
        config_page = QWidget()
        config_page.setLayout(config)

        self.stats_label = QLabel()
        self.histogram_label = QLabel()
        self.histogram_label.setMinimumHeight(150)
        self.histogram_label.setAlignment(Qt.AlignCenter)
        self.table = QTableWidget(0, 4)
        self.table.horizontalHeader().setStretchLastSection(True)
        preview_layout = QVBoxLayout()
        preview_layout.addWidget(self.stats_label)
        preview_layout.addWidget(self.histogram_label)
        preview_layout.addWidget(self.table, 1)
        preview_page = QWidget()
        preview_page.setLayout(preview_layout)

        self.tabs = QTabWidget()
        self.tabs.addTab(config_page, "")
        self.tabs.addTab(preview_page, "")

        self.buttons = QDialogButtonBox(QDialogButtonBox.Apply | QDialogButtonBox.Close)
        self.preview_button = self.buttons.addButton("", QDialogButtonBox.ActionRole)
        self.preview_button.clicked.connect(self.preview)
        self.buttons.button(QDialogButtonBox.Apply).clicked.connect(self.apply)
        self.buttons.rejected.connect(self.close)

        main_layout = QVBoxLayout(self)
        main_layout.addWidget(self.tabs, 1)
        main_layout.addWidget(self.buttons)

        self.layer_combo.currentIndexChanged.connect(self.update_band)
        self.method_combo.currentIndexChanged.connect(self.update_controls)
        self.manual_check.toggled.connect(self.update_controls)
        self.connect_setting_signals()
        self.load_settings()
        self.refresh_layers()
        self.apply_language()
        self.update_controls()
        self.update_ramp_preview()

    def t(self, key):
        return TEXT.get(self.language, TEXT["es"]).get(key, key)

    def add_row(self, form, key, widget_or_layout):
        label = QLabel()
        self.form_labels[key] = label
        form.addRow(label, widget_or_layout)

    @staticmethod
    def value_spin():
        spin = QDoubleSpinBox()
        spin.setRange(-1e100, 1e100)
        spin.setDecimals(8)
        return spin

    def connect_setting_signals(self):
        self.palette_combo.currentIndexChanged.connect(self.save_settings)
        self.reverse_check.toggled.connect(self.save_settings)
        self.method_combo.currentIndexChanged.connect(self.save_settings)
        self.render_combo.currentIndexChanged.connect(self.save_settings)
        self.zones_spin.valueChanged.connect(self.save_settings)
        self.sigma_spin.valueChanged.connect(self.save_settings)
        self.log_shift.toggled.connect(self.save_settings)
        self.manual_check.toggled.connect(self.save_settings)
        self.minimum_spin.valueChanged.connect(self.save_settings)
        self.maximum_spin.valueChanged.connect(self.save_settings)
        self.band_spin.valueChanged.connect(self.save_settings)

    def load_settings(self):
        self._building_language = True
        self.language_combo.setCurrentIndex(max(0, self.language_combo.findData(self.language)))
        self._building_language = False

        palette = self.settings.value(f"{SETTINGS_PREFIX}/palette", 0)
        try:
            index = self.palette_combo.findData(int(palette))
        except (TypeError, ValueError):
            index = self.palette_combo.findText(palette)
        if index < 0 and palette in PALETTES:
            index = list(PALETTES).index(palette)
        if index >= 0:
            self.palette_combo.setCurrentIndex(index)
        self.reverse_check.setChecked(self.as_bool(self.settings.value(f"{SETTINGS_PREFIX}/reverse", False)))
        self.method_combo.setCurrentIndex(max(0, self.method_combo.findData(self.settings.value(f"{SETTINGS_PREFIX}/method", "linear"))))
        self.render_combo.setCurrentIndex(max(0, self.render_combo.findData(self.settings.value(f"{SETTINGS_PREFIX}/render", "discrete"))))
        self.zones_spin.setValue(int(self.settings.value(
            f"{SETTINGS_PREFIX}/bins",
            self.settings.value(f"{SETTINGS_PREFIX}/zones", DEFAULT_BINS)
        )))
        self.sigma_spin.setValue(float(self.settings.value(f"{SETTINGS_PREFIX}/sigma", 2)))
        self.log_shift.setChecked(self.as_bool(self.settings.value(f"{SETTINGS_PREFIX}/log_shift", False)))
        self.manual_check.setChecked(self.as_bool(self.settings.value(f"{SETTINGS_PREFIX}/manual_limits", False)))
        self.minimum_spin.setValue(float(self.settings.value(f"{SETTINGS_PREFIX}/minimum", 0)))
        self.maximum_spin.setValue(float(self.settings.value(f"{SETTINGS_PREFIX}/maximum", 1)))
        self.band_spin.setValue(int(self.settings.value(f"{SETTINGS_PREFIX}/band", 1)))

    @staticmethod
    def as_bool(value):
        if isinstance(value, bool):
            return value
        return str(value).lower() in ("1", "true", "yes")

    def save_settings(self, *unused):
        if self._building_language:
            return
        self.settings.setValue(f"{SETTINGS_PREFIX}/language", self.language)
        self.settings.setValue(f"{SETTINGS_PREFIX}/palette", self.palette_combo.currentData())
        self.settings.setValue(f"{SETTINGS_PREFIX}/reverse", self.reverse_check.isChecked())
        self.settings.setValue(f"{SETTINGS_PREFIX}/method", self.method_combo.currentData())
        self.settings.setValue(f"{SETTINGS_PREFIX}/render", self.render_combo.currentData())
        self.settings.setValue(f"{SETTINGS_PREFIX}/bins", self.zones_spin.value())
        self.settings.setValue(f"{SETTINGS_PREFIX}/sigma", self.sigma_spin.value())
        self.settings.setValue(f"{SETTINGS_PREFIX}/log_shift", self.log_shift.isChecked())
        self.settings.setValue(f"{SETTINGS_PREFIX}/manual_limits", self.manual_check.isChecked())
        self.settings.setValue(f"{SETTINGS_PREFIX}/minimum", self.minimum_spin.value())
        self.settings.setValue(f"{SETTINGS_PREFIX}/maximum", self.maximum_spin.value())
        self.settings.setValue(f"{SETTINGS_PREFIX}/band", self.band_spin.value())

    def change_language(self):
        language = self.language_combo.currentData()
        if language not in TEXT or language == self.language:
            return
        self.language = language
        self.apply_language()
        self.save_settings()

    def apply_language(self):
        self.setWindowTitle(self.t("window_title"))
        self.plugin_group.setTitle(self.t("plugin_group"))
        self.data_group.setTitle(self.t("data_group"))
        self.ramp_group.setTitle(self.t("ramp_group"))
        self.method_group.setTitle(self.t("method_group"))
        self.limits_group.setTitle(self.t("limits_group"))

        for key, label in self.form_labels.items():
            label.setText(self.t(key))
        self.refresh_button.setText(self.t("refresh"))
        self.reverse_check.setText(self.t("reverse"))
        self.import_button.setText(self.t("import_table"))
        self.log_shift.setText(self.t("log_shift"))
        self.manual_check.setText(self.t("manual_limits"))
        self.read_button.setText(self.t("read_band"))
        self.tabs.setTabText(0, self.t("config_tab"))
        self.tabs.setTabText(1, self.t("preview_tab"))
        self.stats_label.setText(self.t("stats_ready"))
        self.table.setHorizontalHeaderLabels([
            self.t("zone"), self.t("minimum_bin"), self.t("maximum_bin"), self.t("color")
        ])
        self.preview_button.setText(self.t("preview"))
        self.buttons.button(QDialogButtonBox.Apply).setText(self.t("apply"))
        self.buttons.button(QDialogButtonBox.Close).setText(self.t("close"))
        self.update_combo_text(self.method_combo, {
            "linear": self.t("linear"),
            "normal": self.t("normal"),
            "equal_area": self.t("equal_area"),
            "log_linear": self.t("log_method"),
        })
        self.update_combo_text(self.render_combo, {
            "continuous": self.t("continuous"),
            "discrete": self.t("discrete"),
        })
        self.update_combo_text(self.language_combo, {
            "es": self.t("spanish"),
            "en": self.t("english"),
        })
        self.update_combo_text(self.palette_combo, {
            index: self.t(key) for index, key in enumerate(PALETTE_TEXT_KEYS)
        })
        self.update_controls()

    @staticmethod
    def update_combo_text(combo, labels):
        current = combo.currentData()
        blocked = combo.blockSignals(True)
        for row in range(combo.count()):
            combo.setItemText(row, labels.get(combo.itemData(row), combo.itemText(row)))
        combo.setCurrentIndex(max(0, combo.findData(current)))
        combo.blockSignals(blocked)

    def refresh_layers(self):
        current = self.layer_combo.currentData()
        self.layer_combo.clear()
        for layer in QgsProject.instance().mapLayers().values():
            if layer.type() == QgsMapLayerType.RasterLayer:
                self.layer_combo.addItem(layer.name(), layer.id())
        index = self.layer_combo.findData(current)
        if index >= 0:
            self.layer_combo.setCurrentIndex(index)
        self.update_band()

    def current_layer(self):
        layer = QgsProject.instance().mapLayer(self.layer_combo.currentData())
        return layer if isinstance(layer, QgsRasterLayer) else None

    def update_band(self):
        layer = self.current_layer()
        self.band_spin.setMaximum(max(1, layer.bandCount() if layer else 1))

    def update_controls(self):
        method = self.method_combo.currentData()
        if method is None:
            return
        self.method_help.setText(self.t(f"{method}_help") if method != "log_linear" else self.t("log_help"))
        self.sigma_spin.setEnabled(method == "normal")
        self.log_shift.setEnabled(method == "log_linear")
        enabled = self.manual_check.isChecked()
        self.minimum_spin.setEnabled(enabled)
        self.maximum_spin.setEnabled(enabled)

    def select_palette(self, unused=None):
        index = self.palette_combo.currentData()
        if isinstance(index, int) and 0 <= index < len(PALETTES):
            self.palette_stops = list(list(PALETTES.values())[index])
            self.update_ramp_preview()

    def active_stops(self):
        colours = [c for _, c in self.palette_stops]
        if self.reverse_check.isChecked():
            colours.reverse()
        return [(i / (len(colours) - 1), colour) for i, colour in enumerate(colours)]

    def update_ramp_preview(self):
        pixmap = QPixmap(600, 24)
        gradient = QLinearGradient(0, 0, 600, 0)
        for position, colour in self.active_stops():
            gradient.setColorAt(position, colour)
        painter = QPainter(pixmap)
        painter.fillRect(pixmap.rect(), gradient)
        painter.end()
        self.ramp_preview.setPixmap(pixmap)
        self.ramp_preview.setScaledContents(True)

    def stats(self, layer):
        return layer.dataProvider().bandStatistics(
            self.band_spin.value(), QgsRasterBandStats.All, layer.extent(), SAMPLE_SIZE
        )

    def read_limits(self):
        layer = self.current_layer()
        if not layer:
            return QMessageBox.warning(self, self.t("no_raster_title"), self.t("no_raster"))
        stats = self.stats(layer)
        self.minimum_spin.setValue(stats.minimumValue)
        self.maximum_spin.setValue(stats.maximumValue)

    def calculate(self):
        layer = self.current_layer()
        if not layer:
            raise ValueError(self.t("no_raster"))
        stats = self.stats(layer)
        minimum = self.minimum_spin.value() if self.manual_check.isChecked() else stats.minimumValue
        maximum = self.maximum_spin.value() if self.manual_check.isChecked() else stats.maximumValue
        if not math.isfinite(minimum) or not math.isfinite(maximum) or maximum <= minimum:
            raise ValueError(self.t("invalid_range"))
        histogram = layer.dataProvider().histogram(
            self.band_spin.value(), HISTOGRAM_BINS, minimum, maximum,
            layer.extent(), SAMPLE_SIZE, False
        )
        counts = list(histogram.histogramVector)
        if not counts or sum(counts) <= 0:
            raise ValueError(self.t("histogram_failed"))
        bins = self.zones_spin.value()
        method = self.method_combo.currentData()
        if method == "equal_area":
            edges = calculate_values(
                [i / bins for i in range(bins + 1)], method, minimum, maximum,
                stats.mean, stats.stdDev, counts, self.sigma_spin.value(),
                self.log_shift.isChecked(),
            )
            values = edges[1:]
        else:
            positions = (
                [(i + 1) / bins for i in range(bins)]
                if self.render_combo.currentData() == "discrete"
                else [i / (bins - 1) for i in range(bins)]
            )
            values = calculate_values(
                positions, method, minimum, maximum,
                stats.mean, stats.stdDev, counts, self.sigma_spin.value(),
                self.log_shift.isChecked(),
            )
            edges = [minimum] + values if self.render_combo.currentData() == "discrete" else values
        colours = [interpolate_colour(self.active_stops(), i / (bins - 1)) for i in range(bins)]
        return layer, stats, minimum, maximum, counts, values, colours, edges

    def preview(self):
        try:
            _, stats, minimum, maximum, counts, values, colours, edges = self.calculate()
        except ValueError as error:
            return QMessageBox.warning(self, self.t("preview_failed"), str(error))
        self.stats_label.setText(self.t("stats").format(
            minimum=minimum, maximum=maximum, mean=stats.mean, stddev=stats.stdDev
        ))
        self.histogram_label.setPixmap(histogram_pixmap(counts, values, minimum, maximum))
        self.table.setRowCount(len(values))
        for row, (value, colour) in enumerate(zip(values, colours)):
            self.table.setItem(row, 0, QTableWidgetItem(str(row + 1)))
            lower = edges[row] if row < len(edges) else minimum
            self.table.setItem(row, 1, QTableWidgetItem(f"{lower:.10g}" if row > 0 else ""))
            self.table.setItem(row, 2, QTableWidgetItem(f"{value:.10g}"))
            item = QTableWidgetItem(colour.name())
            item.setBackground(colour)
            self.table.setItem(row, 3, item)
        self.tabs.setCurrentIndex(1)
        self.save_settings()

    def apply(self):
        try:
            layer, _, minimum, maximum, _, values, colours, _ = self.calculate()
        except ValueError as error:
            return QMessageBox.warning(self, self.t("apply_failed"), str(error))
        items = [QgsColorRampShader.ColorRampItem(v, c, f"{v:.8g}") for v, c in zip(values, colours)]
        ramp = QgsColorRampShader()
        ramp.setColorRampType(
            QgsColorRampShader.Discrete
            if self.render_combo.currentData() == "discrete"
            else QgsColorRampShader.Interpolated
        )
        ramp.setColorRampItemList(items)
        shader = QgsRasterShader()
        shader.setRasterShaderFunction(ramp)
        renderer = QgsSingleBandPseudoColorRenderer(
            layer.dataProvider(), self.band_spin.value(), shader
        )
        renderer.setClassificationMin(minimum)
        renderer.setClassificationMax(maximum)
        layer.setRenderer(renderer)
        layer.emitStyleChanged()
        layer.triggerRepaint()
        self.iface.layerTreeView().refreshLayerSymbology(layer.id())
        self.save_settings()

    def import_palette(self):
        path, _ = QFileDialog.getOpenFileName(
            self, self.t("import_title"), "", self.t("table_filter")
        )
        if not path:
            return
        try:
            self.palette_stops = read_palette(path, self.t)
        except (OSError, UnicodeError, ValueError) as error:
            return QMessageBox.warning(self, self.t("invalid_table"), str(error))
        self.zones_spin.setValue(min(self.zones_spin.maximum(), max(self.zones_spin.minimum(), len(self.palette_stops))))
        self.palette_combo.addItem(self.t("imported").format(name=os.path.basename(path)), "custom")
        self.palette_combo.setCurrentIndex(self.palette_combo.count() - 1)
        self.update_ramp_preview()
        self.save_settings()

    def closeEvent(self, event):
        self.save_settings()
        super().closeEvent(event)


def interpolate_colour(stops, position):
    for i in range(len(stops) - 1):
        lp, left = stops[i]
        rp, right = stops[i + 1]
        if position <= rp:
            f = (position - lp) / (rp - lp) if rp > lp else 0
            return QColor(
                round(left.red() + f * (right.red() - left.red())),
                round(left.green() + f * (right.green() - left.green())),
                round(left.blue() + f * (right.blue() - left.blue())),
            )
    return QColor(stops[-1][1])


def histogram_pixmap(counts, values, minimum, maximum):
    pixmap = QPixmap(640, 150)
    pixmap.fill(QColor("white"))
    painter = QPainter(pixmap)
    peak = max(counts) if counts else 1
    width = pixmap.width() / max(1, len(counts))
    painter.setPen(Qt.NoPen)
    painter.setBrush(QColor("#718096"))
    for i, count in enumerate(counts):
        height = count / peak * 145
        painter.drawRect(round(i * width), round(148 - height), max(1, math.ceil(width)), round(height))
    painter.setPen(QColor("#e53e3e"))
    for value in values:
        x = round((value - minimum) / (maximum - minimum) * 639)
        painter.drawLine(x, 0, x, 149)
    painter.end()
    return pixmap


def read_palette(path, translate=None):
    tr = translate or (lambda key: TEXT["es"].get(key, key))
    rows = []
    with open(path, "r", encoding="utf-8-sig") as source:
        for line in source:
            line = line.strip()
            if not line or line.startswith(("#", "//", "!")):
                continue
            tokens = re.findall(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?", line)
            if len(tokens) >= 3:
                numbers = [float(token) for token in tokens]
                rows.append((None, numbers) if len(numbers) == 3 else (numbers[0], numbers[-3:]))
    if len(rows) < 2:
        raise ValueError(tr("not_enough_rgb"))
    if any(any(c < 0 or c > 255 for c in rgb) for _, rgb in rows):
        raise ValueError(tr("rgb_range"))
    if all(p is not None for p, _ in rows):
        rows.sort()
        low, high = rows[0][0], rows[-1][0]
        if high <= low or any(rows[i][0] == rows[i + 1][0] for i in range(len(rows) - 1)):
            raise ValueError(tr("invalid_positions"))
        positions = [(p - low) / (high - low) for p, _ in rows]
    elif all(p is None for p, _ in rows):
        positions = [i / (len(rows) - 1) for i in range(len(rows))]
    else:
        raise ValueError(tr("mixed_format"))
    return [(p, QColor(round(rgb[0]), round(rgb[1]), round(rgb[2]))) for p, (_, rgb) in zip(positions, rows)]


class OasisMontajColourPlugin:
    def __init__(self, iface):
        self.iface, self.action, self.dialog = iface, None, None

    def initGui(self):
        self.action = QAction(
            QIcon(os.path.join(os.path.dirname(__file__), "icon.svg")),
            TEXT["es"]["menu"],
            self.iface.mainWindow(),
        )
        self.action.triggered.connect(self.run)
        self.iface.addPluginToRasterMenu(TEXT["es"]["menu"], self.action)
        self.iface.addToolBarIcon(self.action)

    def unload(self):
        self.iface.removePluginRasterMenu(TEXT["es"]["menu"], self.action)
        self.iface.removeToolBarIcon(self.action)

    def run(self):
        if self.dialog is None:
            self.dialog = ColourDialog(self.iface, self.iface.mainWindow())
        self.dialog.refresh_layers()
        self.dialog.show()
        self.dialog.raise_()
        self.dialog.activateWindow()
