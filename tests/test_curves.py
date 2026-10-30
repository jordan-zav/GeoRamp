import math
from itertools import pairwise

import pytest

from georamp.curves import curve_quantiles, curve_value, shader_knots, validate_curve


def test_forward_inverse_and_saturation():
    points = [(0, 0), (0.25, 0.7), (1, 1)]
    assert curve_value(points, -1) == 0
    assert curve_value(points, 2) == 1
    assert curve_value(points, 0.25) == 0.7
    xs = curve_quantiles(points, [0, 0.35, 0.7, 0.85, 1])
    assert xs == pytest.approx([0, 0.125, 0.25, 0.625, 1])
    for x, y in zip(xs, [0, 0.35, 0.7, 0.85, 1]):
        assert curve_value(points, x) == pytest.approx(y)


def test_flat_span_has_stable_ordered_inverse():
    points = [(0, 0), (0.25, 0.5), (0.75, 0.5), (1, 1)]
    assert curve_value(points, 0.6) == 0.5
    assert curve_quantiles(points, [0.25, 0.5, 0.75]) == pytest.approx(
        [0.125, 0.25, 0.875]
    )


def test_shader_knots_include_palette_stop_crossings_exactly():
    points = [(0, 0), (0.5, 0.8), (1, 1)]
    knots = shader_knots(points, [0, 0.25, 0.5, 0.75, 1])
    assert (0.5, 0.8) in knots
    assert any(math.isclose(x, 0.3125) and math.isclose(y, 0.5) for x, y in knots)
    # Interpolating the composed transfer between its knots recovers the curve.
    for (a, b), (c, d) in pairwise(knots):
        assert curve_value(points, (a + c) / 2) == pytest.approx((b + d) / 2)


@pytest.mark.parametrize(
    "points",
    [
        [(0, 0), (1, 0.9)],
        [(0, 0), (0.5, 0.8), (0.4, 0.9), (1, 1)],
        [(0, 0), (0.3, 0.8), (0.6, 0.7), (1, 1)],
        [(0, 0), (0.5, float("nan")), (1, 1)],
        [(0, 0), (0.5, 2), (1, 1)],
        [(0, 0)],
    ],
)
def test_invalid_curves_are_rejected(points):
    with pytest.raises(ValueError):
        validate_curve(points)
