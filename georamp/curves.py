"""Monotone input-to-colour transfer curves, independent of QGIS/Qt."""

import bisect
import math
from itertools import pairwise


def validate_curve(points):
    points = [(float(x), float(y)) for x, y in points]
    if not 2 <= len(points) <= 64:
        raise ValueError("A stretch curve needs 2 to 64 control points.")
    if points[0] != (0.0, 0.0) or points[-1] != (1.0, 1.0):
        raise ValueError("Curve endpoints must be (0,0) and (1,1).")
    if any(
        not math.isfinite(x)
        or not math.isfinite(y)
        or not 0 <= x <= 1
        or not 0 <= y <= 1
        for x, y in points
    ):
        raise ValueError("Curve coordinates must be finite fractions in [0,1].")
    if any(b[0] <= a[0] or b[1] < a[1] for a, b in pairwise(points)):
        raise ValueError(
            "Input positions must increase; colour positions must not decrease."
        )
    return points


def curve_value(points, x):
    """Forward mapping, with saturated tails. Validate points at the boundary."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    index = min(len(points) - 1, bisect.bisect_right([p[0] for p in points], x))
    (a, b), (c, d) = points[index - 1 : index + 1]
    return b + (x - a) / (c - a) * (d - b)


def curve_quantiles(points, positions):
    """Inverse transfer for discrete class upper bounds, including flat spans."""
    points = validate_curve(points)
    output = []
    for y in positions:
        if not math.isfinite(y) or not 0 <= y <= 1:
            raise ValueError("Colour positions must be in [0,1].")
        if y == 0:
            output.append(0.0)
            continue
        if y == 1:
            output.append(1.0)
            continue
        for (a, b), (c, d) in pairwise(points):
            if d >= y and d > b:
                output.append(a + (y - b) / (d - b) * (c - a))
                break
    return output


def shader_knots(points, palette_positions):
    """All slope changes of the composed transfer + piecewise RGB palette.

    Including crossings of palette stops makes continuous QGIS interpolation
    exact, rather than approximating the manual curve with arbitrary bins.
    """
    points = validate_curve(points)
    xs = {x for x, _ in points}
    for (a, b), (c, d) in pairwise(points):
        if d > b:
            xs.update(
                a + (y - b) / (d - b) * (c - a) for y in palette_positions if b < y < d
            )
    return [(x, curve_value(points, x)) for x in sorted(xs)]
