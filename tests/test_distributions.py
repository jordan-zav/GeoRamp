import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from georamp.distributions import calculate_values


class DistributionTests(unittest.TestCase):
    def test_linear(self):
        self.assertEqual(calculate_values([0, .5, 1], "linear", 0, 100), [0, 50, 100])

    def test_normal_is_ordered_and_clamped(self):
        values = calculate_values([0, .25, .5, .75, 1], "normal", 0, 100, 50, 10, sigma=2)
        self.assertEqual(values, sorted(values))
        self.assertAlmostEqual(values[2], 50)
        self.assertTrue(all(0 <= value <= 100 for value in values))

    def test_equal_area(self):
        self.assertEqual(calculate_values([0, .5, 1], "equal_area", 0, 4, counts=[1, 1, 1, 1]), [0, 2, 4])

    def test_log_linear(self):
        self.assertAlmostEqual(calculate_values([0, .5, 1], "log_linear", 1, 100)[1], 10)

    def test_log_rejects_non_positive_without_shift(self):
        with self.assertRaises(ValueError):
            calculate_values([0, 1], "log_linear", -1, 10)

    def test_log_shift_preserves_endpoints(self):
        values = calculate_values([0, 1], "log_linear", -1, 10, shift_log=True)
        self.assertTrue(math.isclose(values[0], -1))
        self.assertTrue(math.isclose(values[1], 10))

    def test_invalid_range(self):
        with self.assertRaises(ValueError):
            calculate_values([0, 1], "linear", 1, 1)


if __name__ == "__main__":
    unittest.main()
