import math
import os
import re
import bisect

from qgis.PyQt.QtCore import QSize, Qt, QTimer
from qgis.PyQt.QtGui import QColor, QIcon, QLinearGradient, QPainter, QPixmap
from qgis.PyQt.QtWidgets import (
    QAction, QAbstractItemView, QCheckBox, QComboBox, QDialog, QDialogButtonBox,
    QDoubleSpinBox, QFileDialog, QFormLayout, QGroupBox, QHBoxLayout,
    QLabel, QLineEdit, QListWidget, QListWidgetItem, QMenu, QMessageBox,
    QProgressDialog, QPushButton, QSpinBox, QTabWidget, QTableWidget,
    QTableWidgetItem, QToolButton, QTreeWidget, QTreeWidgetItem, QSplitter,
    QVBoxLayout, QWidget, QWidgetAction,
)
from qgis.core import (
    QgsApplication, QgsColorRampLegendNodeSettings, QgsColorRampShader,
    QgsLayerTreeGroup, QgsLayerTreeLayer, QgsMapLayerType, QgsProject,
    QgsRasterLayer, QgsRasterShader, QgsSettings, QgsTask,
    QgsSingleBandPseudoColorRenderer,
)
from qgis.gui import QgsMapCanvas, QgsMapToolPan

from .distributions import calculate_values, percentile_range

SAMPLE_GRID_SIZE = 512
HISTOGRAM_BINS = 256
PERCENTILE_BINS = 1024
DEFAULT_BINS = 39
SETTINGS_PREFIX = "georamp"


TEXT = {
    "es": {
        "window_title": "GeoRamp",
        "plugin_group": "Plugin",
        "language": "Idioma:",
        "spanish": "Español",
        "english": "Inglés",
        "data_group": "1. Datos",
        "raster_layer": "Capa ráster:",
        "band": "Banda:",
        "multi_mode": "Aplicar a varias capas",
        "multi_select": "Seleccionar capas...",
        "multi_alpha": "Alfabético",
        "multi_layer_manager": "Administrador de capas",
        "multi_help": "Arrastra, o usa Ctrl/Shift, para seleccionar varias. En Administrador de capas, seleccionar un grupo incluye todos sus rásteres.",
        "multi_all": "Seleccionar todas",
        "multi_none": "Quitar selección",
        "multi_required": "Selecciona al menos una capa para el modo múltiple.",
        "multi_processing": "Aplicando {current} de {total}: {name}",
        "multi_done": "Configuración aplicada a {success} capas. Fallos: {failed}.",
        "multi_cancelled": "Aplicación múltiple cancelada. Capas completadas: {success}.",
        "refresh": "Actualizar",
        "ramp_group": "2. Rampa",
        "reverse": "Invertir",
        "import_table": "Importar tabla...",
        "palette_search": "Buscar rampa:",
        "palette_category": "Categoría:",
        "category_all": "Todas",
        "category_geophysics": "Geofísica",
        "category_scientific": "Científica",
        "category_diverging": "Divergente",
        "category_topographic": "Topográfica",
        "category_classic": "Clásica",
        "category_custom": "Importada",
        "import_style": "Importar QML...",
        "export_style": "Exportar QML...",
        "method_group": "3. Distribución",
        "distribution": "Distribución:",
        "zones": "N\u00famero de intervalos:",
        "rendering": "Representación:",
        "compact_legend": "Leyenda compacta",
        "compact_legend_help": "Muestra en Capas una sola barra con los valores mínimo y máximo. QGIS solo permite esta leyenda con representación continua; al activarla, GeoRamp cambiará la representación a Continuo.",
        "normal_range": "Rango normal:",
        "log_linear": "Log-Linear:",
        "log_shift": "Desplazar datos si contienen ceros o negativos",
        "limits_group": "4. Límites",
        "manual_limits": "Usar límites manuales",
        "minimum": "Mínimo:",
        "maximum": "Máximo:",
        "read_band": "Leer de la banda",
        "percentile_stretch": "Recortar valores extremos por percentiles",
        "low_percentile": "Percentil inferior:",
        "high_percentile": "Percentil superior:",
        "config_tab": "Configuración",
        "preview_tab": "Histograma y cortes",
        "viewer_group": "Visor en tiempo real",
        "viewer_waiting": "Selecciona una capa ráster para iniciar el visor.",
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
        "palette_turbo": "Turbo",
        "palette_plasma": "Plasma",
        "palette_inferno": "Inferno",
        "palette_magma": "Magma",
        "palette_cividis": "Cividis",
        "palette_cubehelix": "Cubehelix",
        "palette_spectral": "Espectral",
        "palette_coolwarm": "Frío-cálido",
        "palette_seismic": "Sísmica",
        "palette_jet": "Jet",
        "palette_rainbow": "Arcoíris",
        "palette_ocean": "Océano",
        "palette_bathymetry": "Batimetría",
        "palette_elevation": "Elevación",
        "palette_hot": "Caliente",
        "palette_copper": "Cobre",
        "palette_blue_green": "Azul-verde",
        "palette_green_magenta": "Verde-magenta",
        "palette_ice_fire": "Hielo-fuego",
        "palette_earth": "Tierra",
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
        "stats_nodata": "   NoData: {nodata}",
        "import_title": "Importar tabla",
        "table_filter": "Tablas (*.csv *.txt *.tbl *.zon *.clr *.lut);;Todos (*.*)",
        "invalid_table": "Tabla no válida",
        "imported": "Importada: {name}",
        "not_enough_rgb": "No se encontraron al menos dos filas RGB.",
        "rgb_range": "RGB debe estar entre 0 y 255.",
        "invalid_positions": "Las posiciones no son válidas.",
        "mixed_format": "Todas las filas deben tener el mismo formato.",
        "invalid_percentiles": "Los percentiles deben cumplir 0 ≤ inferior < superior ≤ 100.",
        "invalid_percentile_range": "El rango calculado por percentiles no es válido.",
        "style_filter": "Estilos QGIS (*.qml)",
        "style_imported": "Estilo QML aplicado correctamente.",
        "style_exported": "Estilo QML guardado correctamente.",
        "style_failed": "No se pudo procesar el estilo QML",
        "processing": "Procesando ráster...",
        "cancel": "Cancelar",
        "task_failed": "No se pudo procesar el ráster",
        "task_cancelled": "El cálculo fue cancelado.",
        "invalid_stddev": "La desviación estándar no es válida.",
        "log_positive_required": "Log-Linear requiere datos positivos. Activa el desplazamiento para ceros o negativos.",
        "unknown_distribution": "Distribución desconocida.",
        "menu": "GeoRamp",
    },
    "en": {
        "window_title": "GeoRamp",
        "plugin_group": "Plugin",
        "language": "Language:",
        "spanish": "Spanish",
        "english": "English",
        "data_group": "1. Data",
        "raster_layer": "Raster layer:",
        "band": "Band:",
        "multi_mode": "Apply to multiple layers",
        "multi_select": "Select layers...",
        "multi_alpha": "Alphabetical",
        "multi_layer_manager": "Layer Manager",
        "multi_help": "Drag, or use Ctrl/Shift, to select several. In Layer Manager, selecting a group includes all of its rasters.",
        "multi_all": "Select all",
        "multi_none": "Clear selection",
        "multi_required": "Select at least one layer for multiple mode.",
        "multi_processing": "Applying {current} of {total}: {name}",
        "multi_done": "Configuration applied to {success} layers. Failures: {failed}.",
        "multi_cancelled": "Multiple application cancelled. Completed layers: {success}.",
        "refresh": "Refresh",
        "ramp_group": "2. Ramp",
        "reverse": "Reverse",
        "import_table": "Import table...",
        "palette_search": "Search ramp:",
        "palette_category": "Category:",
        "category_all": "All",
        "category_geophysics": "Geophysics",
        "category_scientific": "Scientific",
        "category_diverging": "Diverging",
        "category_topographic": "Topographic",
        "category_classic": "Classic",
        "category_custom": "Imported",
        "import_style": "Import QML...",
        "export_style": "Export QML...",
        "method_group": "3. Distribution",
        "distribution": "Distribution:",
        "zones": "Number of bins:",
        "rendering": "Rendering:",
        "compact_legend": "Compact legend",
        "compact_legend_help": "Shows a single ramp with minimum and maximum values in Layers. QGIS only supports this legend with continuous rendering; enabling it changes rendering to Continuous.",
        "normal_range": "Normal range:",
        "log_linear": "Log-Linear:",
        "log_shift": "Shift data if zeros or negatives are present",
        "limits_group": "4. Limits",
        "manual_limits": "Use manual limits",
        "minimum": "Minimum:",
        "maximum": "Maximum:",
        "read_band": "Read from band",
        "percentile_stretch": "Clip outliers by percentile",
        "low_percentile": "Lower percentile:",
        "high_percentile": "Upper percentile:",
        "config_tab": "Configuration",
        "preview_tab": "Histogram and breaks",
        "viewer_group": "Live viewer",
        "viewer_waiting": "Select a raster layer to start the viewer.",
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
        "palette_turbo": "Turbo",
        "palette_plasma": "Plasma",
        "palette_inferno": "Inferno",
        "palette_magma": "Magma",
        "palette_cividis": "Cividis",
        "palette_cubehelix": "Cubehelix",
        "palette_spectral": "Spectral",
        "palette_coolwarm": "Cool to warm",
        "palette_seismic": "Seismic",
        "palette_jet": "Jet",
        "palette_rainbow": "Rainbow",
        "palette_ocean": "Ocean",
        "palette_bathymetry": "Bathymetry",
        "palette_elevation": "Elevation",
        "palette_hot": "Hot",
        "palette_copper": "Copper",
        "palette_blue_green": "Blue to green",
        "palette_green_magenta": "Green to magenta",
        "palette_ice_fire": "Ice to fire",
        "palette_earth": "Earth",
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
        "stats_nodata": "   NoData: {nodata}",
        "import_title": "Import table",
        "table_filter": "Tables (*.csv *.txt *.tbl *.zon *.clr *.lut);;All (*.*)",
        "invalid_table": "Invalid table",
        "imported": "Imported: {name}",
        "not_enough_rgb": "At least two RGB rows were not found.",
        "rgb_range": "RGB values must be between 0 and 255.",
        "invalid_positions": "The positions are not valid.",
        "mixed_format": "All rows must use the same format.",
        "invalid_percentiles": "Percentiles must satisfy 0 ≤ lower < upper ≤ 100.",
        "invalid_percentile_range": "The percentile range is not valid.",
        "style_filter": "QGIS styles (*.qml)",
        "style_imported": "QML style applied successfully.",
        "style_exported": "QML style saved successfully.",
        "style_failed": "The QML style could not be processed",
        "processing": "Processing raster...",
        "cancel": "Cancel",
        "task_failed": "The raster could not be processed",
        "task_cancelled": "The calculation was cancelled.",
        "invalid_stddev": "Standard deviation is not valid.",
        "log_positive_required": "Log-Linear requires positive data. Enable shifting for zero or negative values.",
        "unknown_distribution": "Unknown distribution.",
        "menu": "GeoRamp",
    },
}


def make_palette(colours):
    return [(i / (len(colours) - 1), QColor(c)) for i, c in enumerate(colours)]


def palette_icon(stops, width=150, height=18):
    pixmap = QPixmap(width, height)
    gradient = QLinearGradient(0, 0, width, 0)
    for position, colour in stops:
        gradient.setColorAt(position, colour)
    painter = QPainter(pixmap)
    painter.fillRect(pixmap.rect(), gradient)
    painter.end()
    return QIcon(pixmap)


PALETTES = {
    "classic_geophysics": make_palette([
        "#0000ff", "#0055ff", "#007fff", "#00aaff", "#00d4ff", "#00e9ff", "#00ffff",
        "#00ffc8", "#00ff91", "#00ff3f", "#00ff31", "#00ff24", "#00ff00", "#48ff00",
        "#63ff00", "#6dff00", "#8eff00", "#b6ff00", "#c9ff00", "#f4ff00", "#ffec00",
        "#ffd500", "#ffcb00", "#ffbc00", "#ffaf00", "#ffaa00", "#ff9400", "#ff8700",
        "#ff7700", "#ff6a00", "#ff5500", "#ff3500", "#ff1500", "#ff0000", "#ff0037",
        "#ff006d", "#ff00b6", "#ff0bda", "#ff41ec", "#ff79ff", "#ff9fff",
    ]),
    "intense_geophysics": make_palette(["#000000", "#0000a0", "#006cff", "#00ffff", "#00c800", "#ffff00", "#ff7800", "#d00000", "#ffffff"]),
    "full_spectrum": make_palette(["#6a00a8", "#0000ff", "#00bfff", "#00ff80", "#ffff00", "#ff8000", "#ff0000"]),
    "viridis": make_palette(["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"]),
    "terrain": make_palette(["#0033a0", "#18a6a6", "#4caf50", "#d8c477", "#8c5a32", "#ffffff"]),
    "blue_white_red": make_palette(["#053061", "#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b", "#67001f"]),
    "grayscale": make_palette(["#000000", "#ffffff"]),
    "turbo": make_palette(["#30123b", "#4662d7", "#35abf8", "#1ae4b6", "#72fe5e", "#c8ef34", "#faba39", "#f66b19", "#ca2a04", "#7a0403"]),
    "plasma": make_palette(["#0d0887", "#6a00a8", "#b12a90", "#e16462", "#fca636", "#f0f921"]),
    "inferno": make_palette(["#000004", "#320a5f", "#781c6d", "#bb3754", "#ed6925", "#fbb61a", "#fcffa4"]),
    "magma": make_palette(["#000004", "#2c115f", "#721f81", "#b73779", "#f1605d", "#feb078", "#fcfdbf"]),
    "cividis": make_palette(["#00204c", "#31446b", "#666970", "#958f78", "#c8b866", "#ffea46"]),
    "cubehelix": make_palette(["#000000", "#1a2441", "#154e4b", "#5a6a3a", "#a07963", "#c29abd", "#c6d3f1", "#ffffff"]),
    "spectral": make_palette(["#9e0142", "#d53e4f", "#f46d43", "#fee08b", "#ffffbf", "#e6f598", "#66c2a5", "#3288bd", "#5e4fa2"]),
    "coolwarm": make_palette(["#3b4cc0", "#7092f3", "#aac7fd", "#dddddd", "#f7b89c", "#e7755b", "#b40426"]),
    "seismic": make_palette(["#00004c", "#0000ff", "#00ffff", "#ffffff", "#ffff00", "#ff0000", "#4c0000"]),
    "jet": make_palette(["#00007f", "#0000ff", "#007fff", "#00ffff", "#7fff7f", "#ffff00", "#ff7f00", "#ff0000", "#7f0000"]),
    "rainbow": make_palette(["#6e40aa", "#417de0", "#1ac7c2", "#6ee263", "#d5e21a", "#ffb31a", "#f75c2f", "#d62f8c"]),
    "ocean": make_palette(["#00112b", "#003f5c", "#007f8b", "#29b6a8", "#a8e6cf", "#f5ffff"]),
    "bathymetry": make_palette(["#081d58", "#253494", "#225ea8", "#1d91c0", "#41b6c4", "#7fcdbb", "#c7e9b4", "#edf8b1"]),
    "elevation": make_palette(["#0b5d1e", "#4c9a2a", "#b7c95b", "#d9c28f", "#9b7653", "#6b4f3a", "#ffffff"]),
    "hot": make_palette(["#000000", "#7f0000", "#ff0000", "#ff7f00", "#ffff00", "#ffffff"]),
    "copper": make_palette(["#000000", "#3d2618", "#7a4b2f", "#b8734a", "#e8a878", "#ffd8b1"]),
    "blue_green": make_palette(["#081d58", "#225ea8", "#1d91c0", "#41b6c4", "#7fcdbb", "#c7e9b4", "#ffffcc"]),
    "green_magenta": make_palette(["#276419", "#7fbc41", "#d9f0d3", "#f7f7f7", "#fde0ef", "#de77ae", "#8e0152"]),
    "ice_fire": make_palette(["#001f4d", "#0066cc", "#66ccff", "#e8f8ff", "#fff2d8", "#ff9933", "#cc2200", "#4d0000"]),
    "earth": make_palette(["#1b4332", "#52734d", "#9b8b5a", "#c2a878", "#8d6e63", "#5d4037", "#eeeeee"]),
}

PALETTE_TEXT_KEYS = (
    "palette_classic_geophysics",
    "palette_intense_geophysics",
    "palette_full_spectrum",
    "palette_viridis",
    "palette_terrain",
    "palette_blue_white_red",
    "palette_grayscale",
    "palette_turbo",
    "palette_plasma",
    "palette_inferno",
    "palette_magma",
    "palette_cividis",
    "palette_cubehelix",
    "palette_spectral",
    "palette_coolwarm",
    "palette_seismic",
    "palette_jet",
    "palette_rainbow",
    "palette_ocean",
    "palette_bathymetry",
    "palette_elevation",
    "palette_hot",
    "palette_copper",
    "palette_blue_green",
    "palette_green_magenta",
    "palette_ice_fire",
    "palette_earth",
)

PALETTE_IDS = tuple(PALETTES)
PALETTE_CATEGORIES = {
    "classic_geophysics": "geophysics", "intense_geophysics": "geophysics",
    "full_spectrum": "geophysics", "blue_white_red": "geophysics",
    "viridis": "scientific", "turbo": "scientific", "plasma": "scientific",
    "inferno": "scientific", "magma": "scientific", "cividis": "scientific",
    "cubehelix": "scientific", "grayscale": "scientific",
    "spectral": "diverging", "coolwarm": "diverging", "seismic": "diverging",
    "green_magenta": "diverging", "ice_fire": "diverging",
    "terrain": "topographic", "ocean": "topographic", "bathymetry": "topographic",
    "elevation": "topographic", "earth": "topographic", "blue_green": "topographic",
    "jet": "classic", "rainbow": "classic", "hot": "classic", "copper": "classic",
}
CATEGORY_IDS = ("all", "geophysics", "scientific", "diverging", "topographic", "classic", "custom")


def sampled_raster_statistics(task, provider, band, extent, invalid_range_message):
    block = provider.block(band, extent, SAMPLE_GRID_SIZE, SAMPLE_GRID_SIZE)
    values = []
    minimum, maximum = math.inf, -math.inf
    mean, m2, count = 0.0, 0.0, 0
    for row in range(SAMPLE_GRID_SIZE):
        if task.isCanceled():
            return None
        for column in range(SAMPLE_GRID_SIZE):
            if block.isNoData(row, column):
                continue
            value = float(block.value(row, column))
            if not math.isfinite(value):
                continue
            values.append(value)
            minimum, maximum = min(minimum, value), max(maximum, value)
            count += 1
            delta = value - mean
            mean += delta / count
            m2 += delta * (value - mean)
        task.setProgress(10 + 30 * (row + 1) / SAMPLE_GRID_SIZE)
    if not count or maximum <= minimum:
        raise ValueError(invalid_range_message)
    stddev = math.sqrt(m2 / (count - 1)) if count > 1 else 0.0
    return values, minimum, maximum, mean, stddev


def sampled_histogram(values, minimum, maximum, bins):
    counts = [0] * bins
    span = maximum - minimum
    if not math.isfinite(span) or span <= 0:
        return counts
    for value in values:
        if minimum <= value <= maximum:
            index = min(bins - 1, max(0, int(((value - minimum) / span) * bins)))
            counts[index] += 1
    return counts


def analyse_raster_task(task, source, provider_type, layer_id, band, manual,
                        manual_minimum, manual_maximum, use_percentiles,
                        low_percentile, high_percentile, messages):
    tr = lambda key: messages.get(key, key)
    layer = QgsRasterLayer(source, "GeoRamp", provider_type)
    if not layer.isValid() or band < 1 or band > layer.bandCount():
        raise ValueError(tr("no_raster"))
    provider = layer.dataProvider()
    task.setProgress(10)
    sample = sampled_raster_statistics(
        task, provider, band, layer.extent(), tr("invalid_range")
    )
    if sample is None:
        return None
    values, data_minimum, data_maximum, mean, stddev = sample
    if not math.isfinite(data_minimum) or not math.isfinite(data_maximum):
        raise ValueError(tr("invalid_range"))
    if task.isCanceled():
        return None
    task.setProgress(45)

    minimum = manual_minimum if manual else data_minimum
    maximum = manual_maximum if manual else data_maximum
    if use_percentiles:
        preliminary_counts = sampled_histogram(
            values, data_minimum, data_maximum, PERCENTILE_BINS
        )
        minimum, maximum = percentile_range(
            preliminary_counts, data_minimum, data_maximum,
            low_percentile, high_percentile, tr,
        )
    if not math.isfinite(minimum) or not math.isfinite(maximum) or maximum <= minimum:
        raise ValueError(tr("invalid_range"))
    if task.isCanceled():
        return None
    task.setProgress(70)

    counts = sampled_histogram(values, minimum, maximum, HISTOGRAM_BINS)
    if not counts or sum(counts) <= 0:
        raise ValueError(tr("histogram_failed"))
    task.setProgress(100)
    sorted_samples = sorted(values)
    middle = len(sorted_samples) // 2
    median = (sorted_samples[middle] if len(sorted_samples) % 2 else
              (sorted_samples[middle - 1] + sorted_samples[middle]) / 2)
    return {
        "layer_id": layer_id, "band": band,
        "data_minimum": data_minimum, "data_maximum": data_maximum,
        "minimum": minimum, "maximum": maximum, "mean": mean,
        "stddev": stddev, "counts": counts, "sample_count": len(values),
        "median": median, "sorted_samples": sorted_samples,
        "nodata": provider.sourceNoDataValue(band) if provider.sourceHasNoDataValue(band) else None,
    }


class HistogramView(QWidget):
    """Render at the available size instead of stretching a fixed bitmap."""

    def __init__(self):
        super().__init__()
        self.plot_data = None
        self.sigma_range = None
        self.hover = None
        self.readout = None
        self.setMouseTracking(True)
        self.setMinimumSize(320, 220)

    def paintEvent(self, event):
        if self.plot_data is None:
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.TextAntialiasing)
        draw_histogram(painter, *self.plot_data, width=self.width(),
                       height=self.height(), sigma_range=self.sigma_range)
        if self.hover:
            x, y = self.hover
            painter.setPen(QColor("#475569"))
            painter.drawLine(x, 52, x, self.height() - 58)
            painter.drawLine(78, y, self.width() - 35, y)
        painter.end()

    def mouseMoveEvent(self, event):
        if self.plot_data is None:
            return
        counts, _, minimum, maximum, language = self.plot_data
        x, y = event.pos().x(), event.pos().y()
        width, height = self.width() - 113, self.height() - 110
        if not (78 <= x <= self.width() - 35 and 52 <= y <= self.height() - 58):
            self.leaveEvent(event)
            return
        self.hover = (x, y)
        value = minimum + (x - 78) / width * (maximum - minimum)
        frequency = (self.height() - 58 - y) / height * max(counts)
        index = min(len(counts) - 1, int((x - 78) / width * len(counts)))
        step = (maximum - minimum) / len(counts)
        label = "Intervalo / muestras" if language == "es" else "Bin / samples"
        if self.readout:
            self.readout.setText(f"X: {value:.8g} · Y: {frequency:.2f} · {label}: "
                                 f"[{minimum + index * step:.6g}, "
                                 f"{minimum + (index + 1) * step:.6g}] → {counts[index]:,}")
        self.update()

    def leaveEvent(self, event):
        self.hover = None
        if self.readout:
            self.readout.setText("X: — · Y: —")
        self.update()


class ColourDialog(QDialog):
    def __init__(self, iface, parent=None):
        super().__init__(parent)
        self.iface = iface
        self.settings = QgsSettings()
        self.language = self.settings.value(f"{SETTINGS_PREFIX}/language", "es")
        if self.language not in TEXT:
            self.language = "es"
        self.palette_stops = list(PALETTES["classic_geophysics"])
        self.custom_palette_stops = None
        self.custom_palette_name = None
        self.custom_palette_path = None
        self.active_task = None
        self.progress_dialog = None
        self.pending_action = None
        self.last_analysis = None
        self.preview_layer = None
        self.preview_source_key = None
        self.live_restart = False
        self.queued_action = None
        self.multi_apply_queue = []
        self.multi_apply_total = 0
        self.multi_apply_success = 0
        self.multi_apply_failures = []
        self.live_timer = QTimer(self)
        self.live_timer.setSingleShot(True)
        self.live_timer.setInterval(350)
        self.live_timer.timeout.connect(self.start_live_preview)
        self.form_labels = {}
        self._building_language = False

        self.setWindowTitle(self.t("window_title"))
        self.setWindowFlags(
            self.windowFlags() | Qt.WindowMinMaxButtonsHint | Qt.WindowSystemMenuHint
        )
        self.resize(1380, 700)
        self.setMinimumSize(1050, 580)

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
        self.multi_check = QCheckBox()
        self.multi_select_button = QPushButton()
        self.multi_select_button.setEnabled(False)
        self.multi_check.toggled.connect(self.toggle_multi_mode)
        self.multi_select_button.clicked.connect(self.show_multi_menu)
        self.multi_menu = QMenu(self)
        self.multi_tabs = QTabWidget()
        self.multi_list = QListWidget()
        self.multi_list.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.multi_list.setMinimumSize(420, 280)
        self.multi_tree = QTreeWidget()
        self.multi_tree.setHeaderHidden(True)
        self.multi_tree.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.multi_tree.setMinimumSize(420, 280)
        self.multi_tabs.addTab(self.multi_list, self.t("multi_alpha"))
        self.multi_tabs.addTab(self.multi_tree, self.t("multi_layer_manager"))
        self._multi_tab_index = 0
        self._multi_selection_order = []
        self._syncing_multi = False
        self.multi_list.itemSelectionChanged.connect(self.multi_selection_changed)
        self.multi_tree.itemSelectionChanged.connect(self.multi_selection_changed)
        self.multi_tabs.currentChanged.connect(self.change_multi_selection_view)
        self.multi_help_label = QLabel(self.t("multi_help"))
        self.multi_help_label.setWordWrap(True)
        self.multi_all_button, self.multi_none_button = QPushButton(), QPushButton()
        self.multi_all_button.clicked.connect(lambda: self.set_all_multi_layers(Qt.Checked))
        self.multi_none_button.clicked.connect(lambda: self.set_all_multi_layers(Qt.Unchecked))
        multi_buttons = QHBoxLayout()
        multi_buttons.addWidget(self.multi_all_button)
        multi_buttons.addWidget(self.multi_none_button)
        multi_widget_layout = QVBoxLayout()
        multi_widget_layout.addWidget(self.multi_tabs)
        multi_widget_layout.addWidget(self.multi_help_label)
        multi_widget_layout.addLayout(multi_buttons)
        multi_widget = QWidget()
        multi_widget.setLayout(multi_widget_layout)
        multi_action = QWidgetAction(self.multi_menu)
        multi_action.setDefaultWidget(multi_widget)
        self.multi_menu.addAction(multi_action)
        layer_row = QHBoxLayout()
        layer_row.addWidget(self.layer_combo, 1)
        layer_row.addWidget(self.multi_select_button, 1)
        self.multi_select_button.hide()
        layer_row.addWidget(self.refresh_button)
        data_form = QFormLayout()
        self.add_row(data_form, "raster_layer", layer_row)
        self.add_row(data_form, "band", self.band_spin)
        multi_row = QHBoxLayout()
        multi_row.addWidget(self.multi_check)
        data_form.addRow("", multi_row)
        self.data_group = QGroupBox()
        self.data_group.setLayout(data_form)

        self.palette_combo, self.reverse_check = QComboBox(), QCheckBox()
        self.palette_combo.setIconSize(QSize(150, 18))
        self.palette_combo.hide()
        self.palette_search, self.category_combo = QLineEdit(), QComboBox()
        self.palette_gallery = QListWidget()
        self.palette_gallery.setViewMode(QListWidget.IconMode)
        self.palette_gallery.setResizeMode(QListWidget.Adjust)
        self.palette_gallery.setMovement(QListWidget.Static)
        self.palette_gallery.setWrapping(True)
        self.palette_gallery.setIconSize(QSize(170, 18))
        self.palette_gallery.setGridSize(QSize(205, 44))
        self.palette_gallery.setMinimumHeight(145)
        self.palette_gallery.setSpacing(3)
        self.palette_gallery.itemClicked.connect(self.choose_palette_from_gallery)
        self.active_palette_swatch = QLabel()
        self.active_palette_swatch.setFixedSize(180, 20)
        self.active_palette_name = QLabel()
        active_palette_layout = QHBoxLayout()
        active_palette_layout.setContentsMargins(3, 2, 3, 2)
        active_palette_layout.addWidget(self.active_palette_swatch)
        active_palette_layout.addWidget(self.active_palette_name, 1)
        self.active_palette_widget = QWidget()
        self.active_palette_widget.setLayout(active_palette_layout)
        for category in CATEGORY_IDS:
            self.category_combo.addItem(self.t(f"category_{category}"), category)
        self.refresh_palette_list("classic_geophysics")
        self.palette_combo.currentIndexChanged.connect(self.select_palette)
        self.palette_search.textChanged.connect(self.refresh_palette_list)
        self.category_combo.currentIndexChanged.connect(self.refresh_palette_list)
        self.reverse_check.toggled.connect(self.update_ramp_preview)
        self.import_button = QPushButton()
        self.import_button.clicked.connect(self.import_palette)
        self.import_style_button, self.export_style_button = QPushButton(), QPushButton()
        self.import_style_button.clicked.connect(self.import_qml)
        self.export_style_button.clicked.connect(self.export_qml)
        ramp_row = QHBoxLayout()
        ramp_row.addWidget(self.active_palette_widget, 1)
        ramp_row.addWidget(self.reverse_check)
        ramp_row.addWidget(self.import_button)
        style_row = QHBoxLayout()
        style_row.addWidget(self.import_style_button)
        style_row.addWidget(self.export_style_button)
        ramp_form = QFormLayout()
        self.add_row(ramp_form, "palette_search", self.palette_search)
        self.add_row(ramp_form, "palette_category", self.category_combo)
        ramp_form.addRow(ramp_row)
        self.ramp_preview = QLabel()
        self.ramp_preview.setFixedHeight(28)
        ramp_layout = QVBoxLayout()
        ramp_layout.addLayout(ramp_form)
        ramp_layout.addWidget(self.palette_gallery, 1)
        ramp_layout.addWidget(self.ramp_preview)
        ramp_layout.addLayout(style_row)
        self.ramp_group = QGroupBox()
        self.ramp_group.setLayout(ramp_layout)

        self.method_combo, self.render_combo = QComboBox(), QComboBox()
        for key in ("linear", "normal", "equal_area", "log_method"):
            method = "log_linear" if key == "log_method" else key
            self.method_combo.addItem(self.t(key), method)
        self.render_combo.addItem(self.t("continuous"), "continuous")
        self.render_combo.addItem(self.t("discrete"), "discrete")
        self.compact_legend_check = QCheckBox()
        self.compact_legend_info = QToolButton()
        self.compact_legend_info.setText("i")
        self.compact_legend_info.setAutoRaise(True)
        self.compact_legend_info.clicked.connect(self.show_compact_legend_help)
        legend_row = QHBoxLayout()
        legend_row.addWidget(self.compact_legend_check)
        legend_row.addWidget(self.compact_legend_info)
        legend_row.addStretch()
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
        method_form.addRow("", legend_row)
        self.add_row(method_form, "normal_range", self.sigma_spin)
        self.add_row(method_form, "log_linear", self.log_shift)
        self.method_group = QGroupBox()
        self.method_group.setLayout(method_form)

        self.manual_check = QCheckBox()
        self.minimum_spin, self.maximum_spin = self.value_spin(), self.value_spin()
        self.percentile_check = QCheckBox()
        self.low_percentile_spin, self.high_percentile_spin = QDoubleSpinBox(), QDoubleSpinBox()
        for spin, value in ((self.low_percentile_spin, 2), (self.high_percentile_spin, 98)):
            spin.setRange(0, 100)
            spin.setDecimals(2)
            spin.setValue(value)
            spin.setSuffix(" %")
        self.read_button = QPushButton()
        self.read_button.clicked.connect(self.read_limits)
        limits_form = QFormLayout()
        limits_form.addRow(self.manual_check)
        self.add_row(limits_form, "minimum", self.minimum_spin)
        self.add_row(limits_form, "maximum", self.maximum_spin)
        limits_form.addRow(self.percentile_check)
        self.add_row(limits_form, "low_percentile", self.low_percentile_spin)
        self.add_row(limits_form, "high_percentile", self.high_percentile_spin)
        limits_form.addRow("", self.read_button)
        self.limits_group = QGroupBox()
        self.limits_group.setLayout(limits_form)

        left_column, right_column = QVBoxLayout(), QVBoxLayout()
        left_column.addWidget(self.data_group)
        left_column.addWidget(self.ramp_group, 1)
        right_column.addWidget(self.method_group)
        right_column.addWidget(self.limits_group)
        right_column.addStretch()

        columns = QHBoxLayout()
        columns.addLayout(left_column, 1)
        columns.addLayout(right_column, 1)

        config = QVBoxLayout()
        config.addWidget(self.plugin_group)
        config.addLayout(columns, 1)
        controls_widget = QWidget()
        controls_widget.setLayout(config)

        self.viewer_canvas = QgsMapCanvas()
        self.viewer_canvas.setCanvasColor(QColor("#20242b"))
        self.viewer_canvas.enableAntiAliasing(True)
        self.viewer_pan_tool = QgsMapToolPan(self.viewer_canvas)
        self.viewer_canvas.setMapTool(self.viewer_pan_tool)
        self.viewer_message = QLabel(self.t("viewer_waiting"))
        self.viewer_message.setWordWrap(True)
        self.viewer_message.setAlignment(Qt.AlignCenter)
        viewer_layout = QVBoxLayout()
        viewer_layout.addWidget(self.viewer_message)
        viewer_layout.addWidget(self.viewer_canvas, 1)
        self.viewer_group = QGroupBox()
        self.viewer_group.setLayout(viewer_layout)

        config_page = QWidget()
        config_page_layout = QHBoxLayout(config_page)
        config_page_layout.addWidget(controls_widget, 2)
        config_page_layout.addWidget(self.viewer_group, 1)

        self.stats_label = QLabel()
        self.stats_label.setWordWrap(True)
        self.stats_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        self.histogram_label = HistogramView()
        self.sigma_overlay = QCheckBox("Media ± nσ" if self.language == "es" else "Mean ± nσ")
        self.histogram_sigma = QDoubleSpinBox()
        self.histogram_sigma.setRange(0.1, 10.0)
        self.histogram_sigma.setSingleStep(0.1)
        self.histogram_sigma.setValue(1.0)
        self.sigma_summary = QLabel()
        self.sigma_summary.setWordWrap(True)
        self.histogram_cursor = QLabel("X: — · Y: —")
        self.histogram_label.readout = self.histogram_cursor
        self.sigma_overlay.toggled.connect(self.update_histogram_sigma)
        self.histogram_sigma.valueChanged.connect(self.update_histogram_sigma)
        self.table = QTableWidget(0, 4)
        self.table.horizontalHeader().setStretchLastSection(True)
        preview_layout = QVBoxLayout()
        preview_layout.addWidget(self.stats_label)
        sigma_row = QHBoxLayout()
        sigma_row.addWidget(self.sigma_overlay)
        sigma_row.addWidget(self.histogram_sigma)
        sigma_row.addWidget(self.sigma_summary, 1)
        preview_layout.addLayout(sigma_row)
        preview_layout.addWidget(self.histogram_cursor)
        histogram_splitter = QSplitter(Qt.Vertical)
        histogram_splitter.addWidget(self.histogram_label)
        histogram_splitter.addWidget(self.table)
        histogram_splitter.setChildrenCollapsible(False)
        histogram_splitter.setStretchFactor(0, 3)
        histogram_splitter.setStretchFactor(1, 2)
        histogram_splitter.setSizes([360, 240])
        preview_layout.addWidget(histogram_splitter, 1)
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
        self.percentile_check.toggled.connect(self.update_controls)
        self.compact_legend_check.toggled.connect(self.compact_legend_changed)
        self.connect_setting_signals()
        self.load_settings()
        self.refresh_layers()
        self.apply_language()
        self.update_controls()
        self.update_ramp_preview()
        self.connect_live_signals()
        QTimer.singleShot(0, self.queue_live_analysis)

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
        self.compact_legend_check.toggled.connect(self.save_settings)
        self.zones_spin.valueChanged.connect(self.save_settings)
        self.sigma_spin.valueChanged.connect(self.save_settings)
        self.log_shift.toggled.connect(self.save_settings)
        self.manual_check.toggled.connect(self.save_settings)
        self.percentile_check.toggled.connect(self.save_settings)
        self.low_percentile_spin.valueChanged.connect(self.save_settings)
        self.high_percentile_spin.valueChanged.connect(self.save_settings)
        self.minimum_spin.valueChanged.connect(self.save_settings)
        self.maximum_spin.valueChanged.connect(self.save_settings)
        self.band_spin.valueChanged.connect(self.save_settings)

    def connect_live_signals(self):
        self.layer_combo.currentIndexChanged.connect(self.queue_live_analysis)
        self.band_spin.valueChanged.connect(self.queue_live_analysis)
        self.manual_check.toggled.connect(self.queue_live_analysis)
        self.minimum_spin.valueChanged.connect(self.queue_live_analysis)
        self.maximum_spin.valueChanged.connect(self.queue_live_analysis)
        self.percentile_check.toggled.connect(self.queue_live_analysis)
        self.low_percentile_spin.valueChanged.connect(self.queue_live_analysis)
        self.high_percentile_spin.valueChanged.connect(self.queue_live_analysis)
        self.palette_combo.currentIndexChanged.connect(self.refresh_live_style)
        self.reverse_check.toggled.connect(self.refresh_live_style)
        self.method_combo.currentIndexChanged.connect(self.refresh_live_style)
        self.render_combo.currentIndexChanged.connect(self.refresh_live_style)
        self.zones_spin.valueChanged.connect(self.refresh_live_style)
        self.sigma_spin.valueChanged.connect(self.refresh_live_style)
        self.log_shift.toggled.connect(self.refresh_live_style)

    def load_settings(self):
        self._building_language = True
        self.language_combo.setCurrentIndex(max(0, self.language_combo.findData(self.language)))
        self._building_language = False

        custom_path = self.settings.value(f"{SETTINGS_PREFIX}/custom_palette_path", "")
        if custom_path and os.path.isfile(custom_path):
            try:
                self.custom_palette_stops = read_palette(custom_path, self.t)
                self.custom_palette_path = custom_path
                self.custom_palette_name = os.path.basename(custom_path)
            except (OSError, UnicodeError, ValueError):
                self.custom_palette_stops = None

        palette = self.settings.value(f"{SETTINGS_PREFIX}/palette", "classic_geophysics")
        try:
            legacy_index = int(palette)
        except (TypeError, ValueError):
            legacy_index = -1
        if 0 <= legacy_index < len(PALETTE_IDS):
            palette = PALETTE_IDS[legacy_index]
        legacy_names = {
            "Geofísica clásica": "classic_geophysics", "Geofísica intensa": "intense_geophysics",
            "Espectro completo": "full_spectrum", "Viridis": "viridis", "Terreno": "terrain",
            "Anomalías azul-blanco-rojo": "blue_white_red", "Escala de grises": "grayscale",
        }
        palette = legacy_names.get(palette, palette)
        self.refresh_palette_list(palette if palette in PALETTES or palette == "custom" else "classic_geophysics")
        self.reverse_check.setChecked(self.as_bool(self.settings.value(f"{SETTINGS_PREFIX}/reverse", False)))
        self.method_combo.setCurrentIndex(max(0, self.method_combo.findData(self.settings.value(f"{SETTINGS_PREFIX}/method", "linear"))))
        self.render_combo.setCurrentIndex(max(0, self.render_combo.findData(self.settings.value(f"{SETTINGS_PREFIX}/render", "discrete"))))
        self.compact_legend_check.setChecked(self.as_bool(self.settings.value(f"{SETTINGS_PREFIX}/compact_legend", False)))
        self.zones_spin.setValue(int(self.settings.value(
            f"{SETTINGS_PREFIX}/bins",
            self.settings.value(f"{SETTINGS_PREFIX}/zones", DEFAULT_BINS)
        )))
        self.sigma_spin.setValue(float(self.settings.value(f"{SETTINGS_PREFIX}/sigma", 2)))
        self.log_shift.setChecked(self.as_bool(self.settings.value(f"{SETTINGS_PREFIX}/log_shift", False)))
        self.manual_check.setChecked(self.as_bool(self.settings.value(f"{SETTINGS_PREFIX}/manual_limits", False)))
        self.percentile_check.setChecked(self.as_bool(self.settings.value(f"{SETTINGS_PREFIX}/percentile_stretch", False)))
        self.low_percentile_spin.setValue(float(self.settings.value(f"{SETTINGS_PREFIX}/low_percentile", 2)))
        self.high_percentile_spin.setValue(float(self.settings.value(f"{SETTINGS_PREFIX}/high_percentile", 98)))
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
        self.settings.setValue(f"{SETTINGS_PREFIX}/compact_legend", self.compact_legend_check.isChecked())
        self.settings.setValue(f"{SETTINGS_PREFIX}/bins", self.zones_spin.value())
        self.settings.setValue(f"{SETTINGS_PREFIX}/sigma", self.sigma_spin.value())
        self.settings.setValue(f"{SETTINGS_PREFIX}/log_shift", self.log_shift.isChecked())
        self.settings.setValue(f"{SETTINGS_PREFIX}/manual_limits", self.manual_check.isChecked())
        self.settings.setValue(f"{SETTINGS_PREFIX}/percentile_stretch", self.percentile_check.isChecked())
        self.settings.setValue(f"{SETTINGS_PREFIX}/low_percentile", self.low_percentile_spin.value())
        self.settings.setValue(f"{SETTINGS_PREFIX}/high_percentile", self.high_percentile_spin.value())
        self.settings.setValue(f"{SETTINGS_PREFIX}/custom_palette_path", self.custom_palette_path or "")
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
        self.viewer_group.setTitle(self.t("viewer_group"))
        if self.preview_layer is None:
            self.viewer_message.setText(self.t("viewer_waiting"))

        for key, label in self.form_labels.items():
            label.setText(self.t(key))
        self.refresh_button.setText(self.t("refresh"))
        self.multi_check.setText(self.t("multi_mode"))
        self.multi_select_button.setText(self.t("multi_select"))
        self.multi_tabs.setTabText(0, self.t("multi_alpha"))
        self.multi_tabs.setTabText(1, self.t("multi_layer_manager"))
        self.multi_help_label.setText(self.t("multi_help"))
        self.multi_all_button.setText(self.t("multi_all"))
        self.multi_none_button.setText(self.t("multi_none"))
        self.reverse_check.setText(self.t("reverse"))
        self.import_button.setText(self.t("import_table"))
        self.import_style_button.setText(self.t("import_style"))
        self.export_style_button.setText(self.t("export_style"))
        self.log_shift.setText(self.t("log_shift"))
        self.compact_legend_check.setText(self.t("compact_legend"))
        self.compact_legend_info.setToolTip(self.t("compact_legend_help"))
        self.manual_check.setText(self.t("manual_limits"))
        self.percentile_check.setText(self.t("percentile_stretch"))
        self.read_button.setText(self.t("read_band"))
        self.tabs.setTabText(0, self.t("config_tab"))
        self.tabs.setTabText(1, self.t("preview_tab"))
        if hasattr(self, "_histogram_calculated"):
            self.show_preview(self._histogram_calculated, activate=False)
        else:
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
        self.update_combo_text(self.category_combo, {
            category: self.t(f"category_{category}") for category in CATEGORY_IDS
        })
        self.refresh_palette_list(self.palette_combo.currentData())
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
        self.refresh_multi_layers()

    def toggle_multi_mode(self, checked):
        self.multi_select_button.setEnabled(checked)
        self.layer_combo.setVisible(not checked)
        self.multi_select_button.setVisible(checked)
        if checked:
            self.refresh_multi_layers()
            if not self.selected_multi_layer_ids():
                current_id = self.layer_combo.currentData()
                self.set_multi_layer_selection({current_id} if current_id else set())
            self.multi_selection_changed()
            QTimer.singleShot(0, self.show_multi_menu)
        else:
            self.multi_menu.hide()
            self.update_band()
            self.queue_live_analysis()

    def show_multi_menu(self):
        if not self.multi_check.isChecked():
            return
        self.refresh_multi_layers()
        position = self.multi_select_button.mapToGlobal(
            self.multi_select_button.rect().bottomLeft()
        )
        self.multi_menu.popup(position)

    def refresh_multi_layers(self):
        if not hasattr(self, "multi_list"):
            return
        selected = set(self.selected_multi_layer_ids())
        self._syncing_multi = True
        self.multi_list.clear()
        layers = [
            layer for layer in QgsProject.instance().mapLayers().values()
            if layer.type() == QgsMapLayerType.RasterLayer
        ]
        for layer in sorted(layers, key=lambda item: item.name().casefold()):
            item = QListWidgetItem(layer.name())
            item.setData(Qt.UserRole, layer.id())
            self.multi_list.addItem(item)
        self.multi_tree.clear()
        self.add_multi_layer_tree_items(
            self.multi_tree.invisibleRootItem(),
            QgsProject.instance().layerTreeRoot(),
        )
        self.set_multi_layer_selection(selected)
        self._syncing_multi = False
        self.multi_selection_changed()

    def add_multi_layer_tree_items(self, parent_item, parent_node):
        """Copy the QGIS Layer Manager hierarchy, keeping raster branches only."""
        for node in parent_node.children():
            if isinstance(node, QgsLayerTreeGroup):
                item = QTreeWidgetItem(parent_item, [node.name()])
                item.setData(0, Qt.UserRole, None)
                self.add_multi_layer_tree_items(item, node)
                if item.childCount() == 0:
                    parent_item.removeChild(item)
                    continue
                item.setExpanded(node.isExpanded())
            elif isinstance(node, QgsLayerTreeLayer):
                layer = node.layer()
                if layer is None or layer.type() != QgsMapLayerType.RasterLayer:
                    continue
                item = QTreeWidgetItem(parent_item, [layer.name()])
                item.setData(0, Qt.UserRole, layer.id())

    @staticmethod
    def multi_tree_item_layer_ids(item):
        layer_id = item.data(0, Qt.UserRole)
        if layer_id:
            return [layer_id]
        layer_ids = []
        for index in range(item.childCount()):
            layer_ids.extend(ColourDialog.multi_tree_item_layer_ids(item.child(index)))
        return layer_ids

    def selected_multi_layer_ids_from_view(self, view_index):
        if view_index == 0:
            return [item.data(Qt.UserRole) for item in self.multi_list.selectedItems()]
        layer_ids, seen = [], set()
        for item in self.multi_tree.selectedItems():
            for layer_id in self.multi_tree_item_layer_ids(item):
                if layer_id not in seen:
                    seen.add(layer_id)
                    layer_ids.append(layer_id)
        return layer_ids

    def selected_multi_layer_ids(self):
        if not hasattr(self, "multi_list"):
            return []
        selected = self.selected_multi_layer_ids_from_view(self.multi_tabs.currentIndex())
        order = getattr(self, "_multi_selection_order", [])
        return [key for key in order if key in selected] + [
            key for key in selected if key not in order
        ]

    def multi_selection_changed(self):
        if self._syncing_multi:
            return
        selected = self.selected_multi_layer_ids_from_view(self.multi_tabs.currentIndex())
        self._multi_selection_order = [
            key for key in self._multi_selection_order if key in selected
        ] + [key for key in selected if key not in self._multi_selection_order]
        if self.multi_check.isChecked():
            self.multi_select_button.setText(
                f"{self.t('multi_select')} ({len(selected)})"
            )
            self.update_band()
            self.queue_live_analysis()

    def set_multi_layer_selection(self, layer_ids, view_index=None):
        was_syncing = self._syncing_multi
        self._syncing_multi = True
        layer_ids = set(layer_ids)
        targets = (0, 1) if view_index is None else (view_index,)
        if 0 in targets:
            for row in range(self.multi_list.count()):
                item = self.multi_list.item(row)
                item.setSelected(item.data(Qt.UserRole) in layer_ids)
        if 1 in targets:
            def select_tree_item(item):
                layer_id = item.data(0, Qt.UserRole)
                item.setSelected(bool(layer_id and layer_id in layer_ids))
                for index in range(item.childCount()):
                    select_tree_item(item.child(index))
            root = self.multi_tree.invisibleRootItem()
            for index in range(root.childCount()):
                select_tree_item(root.child(index))
        self._syncing_multi = was_syncing
        self.multi_selection_changed()

    def change_multi_selection_view(self, view_index):
        if not hasattr(self, "_multi_tab_index"):
            self._multi_tab_index = view_index
            return
        layer_ids = self.selected_multi_layer_ids_from_view(self._multi_tab_index)
        self.set_multi_layer_selection(layer_ids, view_index)
        self._multi_tab_index = view_index

    def set_all_multi_layers(self, state):
        view = self.multi_list if self.multi_tabs.currentIndex() == 0 else self.multi_tree
        if state == Qt.Checked:
            view.selectAll()
        else:
            view.clearSelection()

    def current_layer(self):
        layer_id = self.layer_combo.currentData()
        if self.multi_check.isChecked():
            selected = self.selected_multi_layer_ids()
            layer_id = selected[0] if selected else None
        layer = QgsProject.instance().mapLayer(layer_id) if layer_id else None
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
        percentile_enabled = self.percentile_check.isChecked() and not enabled
        self.percentile_check.setEnabled(not enabled)
        self.low_percentile_spin.setEnabled(percentile_enabled)
        self.high_percentile_spin.setEnabled(percentile_enabled)

    def compact_legend_changed(self, checked):
        if checked and self.render_combo.currentData() != "continuous":
            self.render_combo.setCurrentIndex(self.render_combo.findData("continuous"))

    def show_compact_legend_help(self):
        QMessageBox.information(
            self, self.t("compact_legend"), self.t("compact_legend_help")
        )

    def queue_live_analysis(self, unused=None):
        if not self.isVisible():
            return
        self.viewer_message.setText(self.t("processing"))
        self.viewer_message.show()
        self.live_timer.start()

    def start_live_preview(self):
        self.start_calculation("live")

    def refresh_live_style(self, unused=None):
        if not self.isVisible():
            return
        if not self.last_analysis:
            self.queue_live_analysis()
            return
        try:
            self.show_live_preview(self.calculate_breaks(self.last_analysis))
        except ValueError:
            self.queue_live_analysis()

    def refresh_palette_list(self, preferred=None):
        if not hasattr(self, "palette_combo"):
            return
        current = preferred if isinstance(preferred, str) else self.palette_combo.currentData()
        query = self.palette_search.text().strip().casefold() if hasattr(self, "palette_search") else ""
        category = self.category_combo.currentData() if hasattr(self, "category_combo") else "all"
        blocked = self.palette_combo.blockSignals(True)
        self.palette_combo.clear()
        self.palette_gallery.blockSignals(True)
        self.palette_gallery.clear()
        for palette_id, text_key in zip(PALETTE_IDS, PALETTE_TEXT_KEYS):
            label = self.t(text_key)
            if category not in ("all", PALETTE_CATEGORIES.get(palette_id)):
                continue
            if query and query not in label.casefold():
                continue
            icon = palette_icon(PALETTES[palette_id])
            self.palette_combo.addItem(icon, label, palette_id)
            gallery_item = QListWidgetItem(icon, label)
            gallery_item.setData(Qt.UserRole, palette_id)
            gallery_item.setToolTip(label)
            self.palette_gallery.addItem(gallery_item)
        if self.custom_palette_stops and category in ("all", "custom"):
            label = self.t("imported").format(name=self.custom_palette_name)
            if not query or query in label.casefold():
                self.palette_combo.addItem(
                    palette_icon(self.custom_palette_stops), label, "custom"
                )
                gallery_item = QListWidgetItem(
                    palette_icon(self.custom_palette_stops), label
                )
                gallery_item.setData(Qt.UserRole, "custom")
                gallery_item.setToolTip(label)
                self.palette_gallery.addItem(gallery_item)
        index = self.palette_combo.findData(current)
        self.palette_combo.setCurrentIndex(index if index >= 0 else (0 if self.palette_combo.count() else -1))
        self.palette_combo.blockSignals(blocked)
        selected_id = self.palette_combo.currentData()
        for row in range(self.palette_gallery.count()):
            item = self.palette_gallery.item(row)
            if item.data(Qt.UserRole) == selected_id:
                self.palette_gallery.setCurrentItem(item)
                break
        self.palette_gallery.blockSignals(False)
        self.select_palette()
        if hasattr(self, "viewer_canvas"):
            self.refresh_live_style()

    def select_palette(self, unused=None):
        palette_id = self.palette_combo.currentData()
        if palette_id in PALETTES:
            self.palette_stops = list(PALETTES[palette_id])
        elif palette_id == "custom" and self.custom_palette_stops:
            self.palette_stops = list(self.custom_palette_stops)
        else:
            return
        self.active_palette_name.setText(self.palette_combo.currentText())
        for row in range(self.palette_gallery.count()):
            item = self.palette_gallery.item(row)
            if item.data(Qt.UserRole) == palette_id:
                self.palette_gallery.setCurrentItem(item)
                break
        self.update_ramp_preview()

    def choose_palette_from_gallery(self, item):
        index = self.palette_combo.findData(item.data(Qt.UserRole))
        if index >= 0:
            self.palette_combo.setCurrentIndex(index)

    def active_stops(self):
        if self.reverse_check.isChecked():
            return [
                (1 - position, colour)
                for position, colour in reversed(self.palette_stops)
            ]
        return list(self.palette_stops)

    def update_ramp_preview(self):
        if not hasattr(self, "ramp_preview"):
            return
        pixmap = QPixmap(600, 24)
        gradient = QLinearGradient(0, 0, 600, 0)
        for position, colour in self.active_stops():
            gradient.setColorAt(position, colour)
        painter = QPainter(pixmap)
        painter.fillRect(pixmap.rect(), gradient)
        painter.end()
        self.ramp_preview.setPixmap(pixmap)
        self.ramp_preview.setScaledContents(True)
        active_pixmap = palette_icon(self.active_stops(), 180, 20).pixmap(QSize(180, 20))
        self.active_palette_swatch.setPixmap(active_pixmap)

    def read_limits(self):
        self.start_calculation("limits")

    def start_calculation(self, action, layer_id=None):
        layer = (
            QgsProject.instance().mapLayer(layer_id)
            if layer_id is not None else self.current_layer()
        )
        if not layer:
            if action == "multi_apply":
                self.multi_apply_failures.append(layer_id or "")
                QTimer.singleShot(0, self.start_next_multi_apply)
                return
            if action == "live":
                self.viewer_message.setText(self.t("viewer_waiting"))
                self.viewer_message.show()
                self.viewer_canvas.setLayers([])
                return
            return QMessageBox.warning(self, self.t("no_raster_title"), self.t("no_raster"))
        if self.active_task is not None:
            self.queued_action = (action, layer_id)
            self.active_task.cancel()
            return
        use_percentiles = (
            action != "limits" and self.percentile_check.isChecked()
            and not self.manual_check.isChecked()
        )
        if use_percentiles:
            if not 0 <= self.low_percentile_spin.value() < self.high_percentile_spin.value() <= 100:
                if action == "live":
                    self.viewer_message.setText(self.t("invalid_percentiles"))
                    self.viewer_message.show()
                    return
                return QMessageBox.warning(self, self.t("preview_failed"), self.t("invalid_percentiles"))

        messages = {key: self.t(key) for key in (
            "no_raster", "invalid_range", "invalid_percentiles",
            "invalid_percentile_range", "histogram_failed"
        )}
        self.pending_action = action
        if action != "live":
            progress_text = self.t("processing")
            if action == "multi_apply":
                progress_text = self.t("multi_processing").format(
                    current=self.multi_apply_total - len(self.multi_apply_queue),
                    total=self.multi_apply_total, name=layer.name(),
                )
            self.progress_dialog = QProgressDialog(
                progress_text, self.t("cancel"), 0, 100, self
            )
            self.progress_dialog.setWindowModality(Qt.WindowModal)
            self.progress_dialog.setMinimumDuration(0)
        self.active_task = QgsTask.fromFunction(
            self.t("processing"), analyse_raster_task,
            on_finished=self.calculation_finished,
            source=layer.source(), provider_type=layer.providerType(), layer_id=layer.id(),
            band=self.band_spin.value(), manual=self.manual_check.isChecked(),
            manual_minimum=self.minimum_spin.value(), manual_maximum=self.maximum_spin.value(),
            use_percentiles=use_percentiles,
            low_percentile=self.low_percentile_spin.value(),
            high_percentile=self.high_percentile_spin.value(), messages=messages,
        )
        if self.progress_dialog:
            self.active_task.progressChanged.connect(
                lambda value: self.progress_dialog.setValue(round(value)) if self.progress_dialog else None
            )
            self.progress_dialog.canceled.connect(self.active_task.cancel)
        QgsApplication.taskManager().addTask(self.active_task)

    def calculation_finished(self, exception, result=None):
        task = self.active_task
        action = self.pending_action
        queued_action = self.queued_action
        self.active_task = None
        self.pending_action = None
        self.queued_action = None
        if self.progress_dialog:
            self.progress_dialog.close()
            self.progress_dialog = None
        if task and task.isCanceled():
            if action == "multi_apply":
                self.multi_apply_queue.clear()
                self.finish_multi_apply(cancelled=True)
                return
            if queued_action:
                QTimer.singleShot(0, lambda queued=queued_action: self.start_calculation(*queued))
            return
        if exception is not None:
            if action == "multi_apply":
                self.multi_apply_failures.append(str(exception))
                QTimer.singleShot(0, self.start_next_multi_apply)
                return
            if action == "live":
                self.viewer_message.setText(str(exception))
                self.viewer_message.show()
                return
            return QMessageBox.warning(self, self.t("task_failed"), str(exception))
        if not result:
            if action == "multi_apply":
                self.multi_apply_failures.append(self.t("histogram_failed"))
                QTimer.singleShot(0, self.start_next_multi_apply)
                return
            if action == "live":
                return
            return QMessageBox.warning(self, self.t("task_failed"), self.t("histogram_failed"))
        self.last_analysis = result
        if action == "limits":
            self.minimum_spin.setValue(result["data_minimum"])
            self.maximum_spin.setValue(result["data_maximum"])
            return
        try:
            calculated = self.calculate_breaks(result)
        except ValueError as error:
            if action == "multi_apply":
                self.multi_apply_failures.append(str(error))
                QTimer.singleShot(0, self.start_next_multi_apply)
                return
            return QMessageBox.warning(self, self.t("task_failed"), str(error))
        if action == "preview":
            self.show_preview(calculated)
        elif action == "apply":
            self.apply_result(calculated)
        elif action == "multi_apply":
            self.apply_result(calculated)
            self.multi_apply_success += 1
            QTimer.singleShot(0, self.start_next_multi_apply)
        elif action == "live":
            self.show_live_preview(calculated)
        if queued_action:
            QTimer.singleShot(0, lambda queued=queued_action: self.start_calculation(*queued))

    def calculate_breaks(self, result):
        minimum, maximum, counts = result["minimum"], result["maximum"], result["counts"]
        bins = self.zones_spin.value()
        method = self.method_combo.currentData()
        if method == "equal_area":
            edges = calculate_values(
                [i / bins for i in range(bins + 1)], method, minimum, maximum,
                result["mean"], result["stddev"], counts, self.sigma_spin.value(),
                self.log_shift.isChecked(), translate=self.t,
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
                result["mean"], result["stddev"], counts, self.sigma_spin.value(),
                self.log_shift.isChecked(), translate=self.t,
            )
            edges = [minimum] + values if self.render_combo.currentData() == "discrete" else values
        colours = [interpolate_colour(self.active_stops(), i / (bins - 1)) for i in range(bins)]
        return result, values, colours, edges

    def preview(self):
        self.start_calculation("preview")

    def show_preview(self, calculated, activate=True):
        self._histogram_calculated = calculated
        result, values, colours, edges = calculated
        minimum, maximum, counts = result["minimum"], result["maximum"], result["counts"]
        stats_text = self.t("stats").format(
            minimum=minimum, maximum=maximum, mean=result["mean"], stddev=result["stddev"]
        )
        if result.get("nodata") is not None:
            stats_text += self.t("stats_nodata").format(nodata=result["nodata"])
        layer = QgsProject.instance().mapLayer(result["layer_id"])
        es = self.language == "es"
        name = layer.name() if layer else result["layer_id"]
        stats_text = (f"{name} · {'Banda' if es else 'Band'} {result['band']}\n"
                      + stats_text + "\n"
                      + ("Muestras válidas" if es else "Valid samples")
                      + f": {result.get('sample_count', sum(counts)):,} · "
                      + ("En rango" if es else "In range") + f": {sum(counts):,} · "
                      + ("Rango original" if es else "Original range")
                      + f": {result['data_minimum']:.8g} – {result['data_maximum']:.8g}")
        self.stats_label.setText(stats_text)
        peaks = [i for i, count in enumerate(counts) if count == max(counts)]
        mode = minimum + (peaks[0] + 0.5) * (maximum - minimum) / len(counts)
        median_text = f"{result['median']:.8g}" if 'median' in result else "—"
        extra = (f" · {'Mediana' if es else 'Median'}: {median_text} · "
                 + ("Moda ≈ (histograma en rango)" if es else "Mode ≈ (in-range histogram)")
                 + f": {mode:.8g}")
        if len(peaks) > 1:
            extra += f" ({len(peaks)} " + ("intervalos empatados" if es else "tied bins") + ")"
        self.stats_label.setText(stats_text + extra)
        self.histogram_label.plot_data = (counts, values, minimum, maximum, self.language)
        self.update_histogram_sigma()
        self.histogram_label.update()
        self.table.setRowCount(len(values))
        for row, (value, colour) in enumerate(zip(values, colours)):
            self.table.setItem(row, 0, QTableWidgetItem(str(row + 1)))
            lower = minimum if row == 0 else values[row - 1]
            self.table.setItem(row, 1, QTableWidgetItem(f"{lower:.10g}"))
            self.table.setItem(row, 2, QTableWidgetItem(f"{value:.10g}"))
            item = QTableWidgetItem(colour.name())
            item.setBackground(colour)
            luminance = 0.2126 * colour.red() + 0.7152 * colour.green() + 0.0722 * colour.blue()
            item.setForeground(QColor("white" if luminance < 140 else "black"))
            self.table.setItem(row, 3, item)
        if activate:
            self.tabs.setCurrentIndex(1)
        self.save_settings()

    def update_histogram_sigma(self, *unused):
        self.histogram_label.sigma_range = None
        es = self.language == "es"
        self.sigma_overlay.setText("Media ± nσ" if es else "Mean ± nσ")
        self.sigma_summary.clear()
        if self.sigma_overlay.isChecked() and hasattr(self, "_histogram_calculated"):
            result = self._histogram_calculated[0]
            spread = self.histogram_sigma.value() * result['stddev']
            low, high = result['mean'] - spread, result['mean'] + spread
            samples = result.get('sorted_samples', [])
            inside = bisect.bisect_right(samples, high) - bisect.bisect_left(samples, low)
            self.histogram_label.sigma_range = (low, high, result['mean'])
            if samples:
                self.sigma_summary.setText(
                    f"[{low:.6g}, {high:.6g}] · {inside:,}/{len(samples):,} "
                    f"({inside / len(samples):.1%}) · "
                    + ("de todas las muestras válidas; no modifica la rampa" if es else
                       "of all valid samples; does not change the ramp"))
        self.histogram_label.update()

    def apply(self):
        if self.multi_check.isChecked():
            self.start_multi_apply()
        else:
            self.start_calculation("apply")

    def start_multi_apply(self):
        layer_ids = self.selected_multi_layer_ids()
        if not layer_ids:
            return QMessageBox.warning(
                self, self.t("apply_failed"), self.t("multi_required")
            )
        self.multi_menu.hide()
        self.multi_apply_queue = list(layer_ids)
        self.multi_apply_total = len(layer_ids)
        self.multi_apply_success = 0
        self.multi_apply_failures = []
        self.start_next_multi_apply()

    def start_next_multi_apply(self):
        if not self.multi_apply_queue:
            self.finish_multi_apply()
            return
        layer_id = self.multi_apply_queue.pop(0)
        self.start_calculation("multi_apply", layer_id)

    def finish_multi_apply(self, cancelled=False):
        if cancelled:
            message = self.t("multi_cancelled").format(success=self.multi_apply_success)
        else:
            message = self.t("multi_done").format(
                success=self.multi_apply_success, failed=len(self.multi_apply_failures)
            )
        QMessageBox.information(self, self.t("window_title"), message)

    def create_renderer(self, layer, calculated):
        result, values, colours, _ = calculated
        minimum, maximum = result["minimum"], result["maximum"]
        items = [QgsColorRampShader.ColorRampItem(v, c, f"{v:.8g}") for v, c in zip(values, colours)]
        discrete = self.render_combo.currentData() == "discrete"
        if discrete and items:
            # Discrete entries are upper bounds. Extend the final zone so
            # percentile/manual limits saturate outliers instead of hiding them.
            # The first zone already includes all values below its upper bound.
            items[-1] = QgsColorRampShader.ColorRampItem(
                float("inf"), colours[-1], f"{maximum:.8g}"
            )
        ramp = QgsColorRampShader()
        ramp.setClip(False)
        ramp.setColorRampType(
            QgsColorRampShader.Discrete
            if discrete
            else QgsColorRampShader.Interpolated
        )
        ramp.setColorRampItemList(items)
        legend_settings = QgsColorRampLegendNodeSettings()
        legend_settings.setUseContinuousLegend(self.compact_legend_check.isChecked())
        legend_settings.setMinimumLabel(f"{minimum:.8g}")
        legend_settings.setMaximumLabel(f"{maximum:.8g}")
        ramp.setLegendSettings(legend_settings)
        shader = QgsRasterShader()
        shader.setRasterShaderFunction(ramp)
        renderer = QgsSingleBandPseudoColorRenderer(
            layer.dataProvider(), result["band"], shader
        )
        renderer.setClassificationMin(minimum)
        renderer.setClassificationMax(maximum)
        return renderer

    def show_live_preview(self, calculated):
        result = calculated[0]
        source_layer = QgsProject.instance().mapLayer(result["layer_id"])
        if not isinstance(source_layer, QgsRasterLayer):
            self.viewer_message.setText(self.t("viewer_waiting"))
            self.viewer_message.show()
            return
        source_key = (source_layer.id(), source_layer.source(), source_layer.providerType())
        if self.preview_layer is None or source_key != self.preview_source_key:
            self.preview_layer = QgsRasterLayer(
                source_layer.source(), f"GeoRamp preview - {source_layer.name()}",
                source_layer.providerType(),
            )
            if not self.preview_layer.isValid():
                self.viewer_message.setText(self.t("no_raster"))
                self.viewer_message.show()
                return
            self.preview_source_key = source_key
            self.viewer_canvas.setDestinationCrs(self.preview_layer.crs())
            self.viewer_canvas.setLayers([self.preview_layer])
            self.viewer_canvas.setExtent(self.preview_layer.extent())
        self.preview_layer.setRenderer(self.create_renderer(self.preview_layer, calculated))
        self.preview_layer.triggerRepaint()
        self.viewer_message.hide()
        self.viewer_canvas.refresh()

    def apply_result(self, calculated):
        result = calculated[0]
        layer = QgsProject.instance().mapLayer(result["layer_id"])
        if not isinstance(layer, QgsRasterLayer):
            return QMessageBox.warning(self, self.t("apply_failed"), self.t("no_raster"))
        renderer = self.create_renderer(layer, calculated)
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
            self.custom_palette_stops = read_palette(path, self.t)
        except (OSError, UnicodeError, ValueError) as error:
            return QMessageBox.warning(self, self.t("invalid_table"), str(error))
        self.palette_stops = list(self.custom_palette_stops)
        self.zones_spin.setValue(min(self.zones_spin.maximum(), max(self.zones_spin.minimum(), len(self.custom_palette_stops))))
        self.custom_palette_name = os.path.basename(path)
        self.custom_palette_path = path
        self.category_combo.setCurrentIndex(self.category_combo.findData("all"))
        self.palette_search.clear()
        self.refresh_palette_list("custom")
        self.save_settings()

    def import_qml(self):
        layer = self.current_layer()
        if not layer:
            return QMessageBox.warning(self, self.t("no_raster_title"), self.t("no_raster"))
        path, _ = QFileDialog.getOpenFileName(self, self.t("import_style"), "", self.t("style_filter"))
        if not path:
            return
        message, success = layer.loadNamedStyle(path)
        if not success:
            return QMessageBox.warning(self, self.t("style_failed"), message)
        layer.triggerRepaint()
        self.iface.layerTreeView().refreshLayerSymbology(layer.id())
        QMessageBox.information(self, self.t("window_title"), self.t("style_imported"))

    def export_qml(self):
        layer = self.current_layer()
        if not layer:
            return QMessageBox.warning(self, self.t("no_raster_title"), self.t("no_raster"))
        path, _ = QFileDialog.getSaveFileName(self, self.t("export_style"), "", self.t("style_filter"))
        if not path:
            return
        if not path.lower().endswith(".qml"):
            path += ".qml"
        message, success = layer.saveNamedStyle(path)
        if not success:
            return QMessageBox.warning(self, self.t("style_failed"), message)
        QMessageBox.information(self, self.t("window_title"), self.t("style_exported"))

    def closeEvent(self, event):
        if self.active_task:
            self.active_task.cancel()
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


def draw_histogram(painter, counts, values, minimum, maximum, language="es",
                   width=640, height=300, sigma_range=None):
    painter.fillRect(0, 0, width, height, QColor("white"))
    left, top, right, bottom = 78, 52, width - 35, height - 58
    plot_width, plot_height = max(1, right - left), max(1, bottom - top)
    peak = max(1, max(counts, default=0))
    es = language == "es"
    painter.setPen(QColor("#334155"))
    painter.drawText(left, 18, "Frecuencia (muestras)" if es else "Frequency (samples)")
    painter.fillRect(left, 29, 14, 10, QColor("#718096"))
    painter.drawText(left + 20, 39, "Histograma" if es else "Histogram")
    painter.setPen(QColor("#e53e3e"))
    painter.drawLine(left + 135, 29, left + 135, 41)
    painter.setPen(QColor("#334155"))
    painter.drawText(left + 144, 39, "Cortes de rampa" if es else "Ramp breaks")
    for tick in range(5):
        y = bottom - round(tick / 4 * plot_height)
        painter.setPen(QColor("#e2e8f0"))
        painter.drawLine(left, y, right, y)
        painter.setPen(QColor("#334155"))
        painter.drawText(2, y - 9, left - 10, 18, Qt.AlignRight | Qt.AlignVCenter,
                         f"{peak * tick / 4:,.0f}")
    bin_width = plot_width / max(1, len(counts))
    painter.setPen(Qt.NoPen)
    painter.setBrush(QColor("#718096"))
    for i, count in enumerate(counts):
        bar_height = count / peak * plot_height
        painter.drawRect(left + round(i * bin_width), bottom - round(bar_height),
                         max(1, math.ceil(bin_width)), round(bar_height))
    if sigma_range:
        low, high, mean = sigma_range
        x1 = left + round((max(minimum, min(maximum, low)) - minimum) / (maximum - minimum) * plot_width)
        x2 = left + round((max(minimum, min(maximum, high)) - minimum) / (maximum - minimum) * plot_width)
        painter.fillRect(x1, top, max(0, x2 - x1), plot_height, QColor(34, 197, 94, 65))
        painter.setPen(QColor("#15803d"))
        for marker in (low, mean, high):
            if minimum <= marker <= maximum:
                mx = left + round((marker - minimum) / (maximum - minimum) * plot_width)
                painter.drawLine(mx, top, mx, bottom)
    painter.setPen(QColor(229, 62, 62, 110))
    for value in values:
        if minimum <= value <= maximum:
            x = left + round((value - minimum) / (maximum - minimum) * plot_width)
            painter.drawLine(x, top, x, bottom)
    painter.setPen(QColor("#334155"))
    painter.drawLine(left, top, left, bottom)
    painter.drawLine(left, bottom, right, bottom)
    ticks = max(2, min(6, plot_width // 110))
    for tick in range(ticks + 1):
        x = left + round(tick / ticks * plot_width)
        value = minimum + tick / ticks * (maximum - minimum)
        painter.drawLine(x, bottom, x, bottom + 5)
        painter.drawText(x - 48, bottom + 8, 96, 20, Qt.AlignCenter, f"{value:.5g}")
    painter.drawText(left, height - 24, plot_width, 20, Qt.AlignCenter,
                     "Valor del ráster (unidades de la banda)" if es
                     else "Raster value (band units)")


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


class GeoRampPlugin:
    def __init__(self, iface):
        self.iface, self.action, self.dialog = iface, None, None

    def initGui(self):
        self.action = QAction(
            QIcon(os.path.join(os.path.dirname(__file__), "icon.png")),
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
        self.dialog.queue_live_analysis()
