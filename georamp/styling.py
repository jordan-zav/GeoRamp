"""Shared native-QGIS style construction for the dialog and canvas following."""

import json
from itertools import pairwise

from qgis.core import (
    QgsColorRampLegendNodeSettings,
    QgsColorRampShader,
    QgsRasterShader,
    QgsRasterTransparency,
    QgsSingleBandPseudoColorRenderer,
)
from qgis.PyQt.QtGui import QColor

from .curves import curve_quantiles, shader_knots, validate_curve
from .distributions import calculate_values


def interpolate_colour(stops, position):
    for (left_pos, left), (right_pos, right) in pairwise(stops):
        if position <= right_pos:
            fraction = (
                (position - left_pos) / (right_pos - left_pos)
                if right_pos > left_pos
                else 0
            )
            return QColor(
                *[
                    round(a + fraction * (b - a))
                    for a, b in zip(left.getRgb(), right.getRgb())
                ]
            )
    return QColor(stops[-1][1])


def calculate_style(result, settings, translate=None):
    result = dict(result)
    minimum, maximum, counts = result["minimum"], result["maximum"], result["counts"]
    bins, method = int(settings["bins"]), settings["method"]
    discrete = settings["render"] == "discrete"
    stops = [
        (float(position), QColor(colour)) for position, colour in settings["palette"]
    ]
    if method == "custom":
        points = validate_curve(settings["curve"])
        if not discrete:
            knots = shader_knots(points, [x for x, _ in stops])
            values = [minimum + x * (maximum - minimum) for x, _ in knots]
            positions = [y for _, y in knots]
            colours = [interpolate_colour(stops, y) for y in positions]
        else:
            values = [
                minimum + x * (maximum - minimum)
                for x in curve_quantiles(points, [(i + 1) / bins for i in range(bins)])
            ]
        result["curve"] = points
        edges = [minimum] + values if discrete else values
    else:
        arguments = (
            method,
            minimum,
            maximum,
            result["mean"],
            result["stddev"],
            counts,
            settings["sigma"],
            settings["shift_log"],
        )
        if method == "equal_area":
            edges = calculate_values(
                [i / bins for i in range(bins + 1)], *arguments, translate=translate
            )
            values = edges[1:]
        else:
            positions = (
                [(i + 1) / bins for i in range(bins)]
                if discrete
                else [i / (bins - 1) for i in range(bins)]
            )
            values = calculate_values(positions, *arguments, translate=translate)
            edges = [minimum] + values if discrete else values
    if method != "custom" or discrete:
        positions = [i / (len(values) - 1) for i in range(len(values))]
        colours = [interpolate_colour(stops, y) for y in positions]
    transfer = []
    if discrete:
        transfer.append((min(result["data_minimum"], values[0]), 0.0))
        for i, value in enumerate(values[:-1]):
            transfer.extend([(value, positions[i]), (value, positions[i + 1])])
        transfer.append((max(result["data_maximum"], values[-1]), 1.0))
    else:
        if result["data_minimum"] < values[0]:
            transfer.append((result["data_minimum"], 0.0))
        transfer.extend(zip(values, positions))
        if result["data_maximum"] > values[-1]:
            transfer.append((result["data_maximum"], 1.0))
    result["transfer"] = transfer
    return result, values, colours, edges


def create_renderer(layer, calculated, settings):
    result, values, colours, _ = calculated
    minimum, maximum = result["minimum"], result["maximum"]
    items = [
        QgsColorRampShader.ColorRampItem(value, colour, f"{value:.8g}")
        for value, colour in zip(values, colours)
    ]
    discrete = settings["render"] == "discrete"
    if discrete and items:
        items[-1] = QgsColorRampShader.ColorRampItem(
            float("inf"), colours[-1], f"{maximum:.8g}"
        )
    ramp = QgsColorRampShader()
    ramp.setClip(False)
    ramp.setColorRampType(
        QgsColorRampShader.Discrete if discrete else QgsColorRampShader.Interpolated
    )
    ramp.setColorRampItemList(items)
    legend = QgsColorRampLegendNodeSettings()
    legend.setUseContinuousLegend(settings.get("compact_legend", False))
    legend.setMinimumLabel(f"{minimum:.8g}")
    legend.setMaximumLabel(f"{maximum:.8g}")
    ramp.setLegendSettings(legend)
    shader = QgsRasterShader()
    shader.setRasterShaderFunction(ramp)
    renderer = QgsSingleBandPseudoColorRenderer(
        layer.dataProvider(), result["band"], shader
    )
    renderer.setClassificationMin(minimum)
    renderer.setClassificationMax(maximum)
    if result.get("user_nodata"):
        transparency = QgsRasterTransparency()
        ranges = []
        for low, high in result["user_nodata"]:
            item = QgsRasterTransparency.TransparentSingleValuePixel()
            item.min, item.max = low, high
            item.includeMinimum = item.includeMaximum = True
            item.percentTransparent = 100.0
            ranges.append(item)
        transparency.setTransparentSingleValuePixelList(ranges)
        renderer.setRasterTransparency(transparency)
    return renderer


def result_style_state(settings, result):
    state = dict(settings)
    state.update(
        format="georamp-stretch",
        version=1,
        minimum=result["minimum"],
        maximum=result["maximum"],
        band=result["band"],
        scope=result.get("scope", "whole"),
        sample_extent=result.get("sample_extent"),
        crs=result.get("sample_crs"),
        sample_count=result.get("sample_count"),
        user_nodata=result.get("user_nodata", []),
        use_source_nodata=result.get("use_source_nodata", True),
        area_wkb_hex=result.get("area_wkb_hex"),
    )
    return state


def apply_style(layer, calculated, settings):
    state = result_style_state(settings, calculated[0])
    layer.setRenderer(create_renderer(layer, calculated, settings))
    layer.setCustomProperty("georamp/stretch", json.dumps(state, allow_nan=False))
    layer.emitStyleChanged()
    layer.triggerRepaint()
    return state
