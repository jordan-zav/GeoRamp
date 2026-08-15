import math
from statistics import NormalDist


def calculate_values(positions, method, minimum, maximum, mean=0, stddev=1,
                     counts=None, sigma=2, shift_log=False):
    if not math.isfinite(minimum) or not math.isfinite(maximum) or maximum <= minimum:
        raise ValueError("El rango de datos no es válido.")
    if method == "linear":
        return [minimum + p * (maximum - minimum) for p in positions]
    if method == "normal":
        if not math.isfinite(mean) or not math.isfinite(stddev) or stddev <= 0:
            raise ValueError("La desviación estándar no es válida.")
        normal = NormalDist()
        low, high = normal.cdf(-sigma), normal.cdf(sigma)
        return [
            min(maximum, max(minimum, mean + stddev * normal.inv_cdf(low + p * (high - low))))
            for p in positions
        ]
    if method == "log_linear":
        offset = 0
        if minimum <= 0:
            if not shift_log:
                raise ValueError("Log-Linear requiere datos positivos. Activa el desplazamiento para ceros/negativos.")
            offset = 1 - minimum
        low, high = math.log(minimum + offset), math.log(maximum + offset)
        return [math.exp(low + p * (high - low)) - offset for p in positions]
    if method != "equal_area":
        raise ValueError("Distribución desconocida.")
    return histogram_quantiles(positions, minimum, maximum, counts or [])


def histogram_quantiles(positions, minimum, maximum, counts):
    total = sum(counts)
    if not counts or total <= 0:
        raise ValueError("No se pudo calcular el histograma.")
    values = []
    for p in positions:
        if p <= 0:
            values.append(minimum)
            continue
        if p >= 1:
            values.append(maximum)
            continue
        target, cumulative, index = p * total, 0, 0
        while index < len(counts) - 1 and cumulative + counts[index] < target:
            cumulative += counts[index]
            index += 1
        within = (target - cumulative) / counts[index] if counts[index] else 0.5
        fraction = (index + min(1, max(0, within))) / len(counts)
        values.append(minimum + fraction * (maximum - minimum))
    return values
