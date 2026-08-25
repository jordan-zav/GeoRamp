/**
 * Statistical distributions and percentile range calculations for GeoRamp.
 */

// Rational approximation for inverse normal CDF (probit) by Peter J. Acklam
function standardNormalInvCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Coefficients in rational approximations
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const p_low = 0.02425;
  const p_high = 1 - p_low;
  let q: number, r: number;

  if (p < p_low) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= p_high) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

// Error function approximation for normal CDF
function standardNormalCdf(x: number): number {
  return 0.5 * (1 + errorFunction(x / Math.SQRT2));
}

function errorFunction(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export function histogramQuantiles(
  positions: number[],
  minimum: number,
  maximum: number,
  counts: number[]
): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (!counts.length || total <= 0) {
    throw new Error("No se pudo calcular el histograma.");
  }
  return positions.map((p) => {
    if (p <= 0) return minimum;
    if (p >= 1) return maximum;
    const target = p * total;
    let cumulative = 0;
    let index = 0;
    while (index < counts.length - 1 && cumulative + counts[index] < target) {
      cumulative += counts[index];
      index++;
    }
    const within = counts[index] ? (target - cumulative) / counts[index] : 0.5;
    const fraction = (index + Math.min(1, Math.max(0, within))) / counts.length;
    return minimum + fraction * (maximum - minimum);
  });
}

export function calculateValues(
  positions: number[],
  method: string,
  minimum: number,
  maximum: number,
  mean = 0,
  stddev = 1,
  counts: number[] = [],
  sigma = 2,
  shiftLog = false
): number[] {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) {
    throw new Error("El rango de datos no es válido.");
  }

  if (method === "linear") {
    return positions.map((p) => minimum + p * (maximum - minimum));
  }

  if (method === "normal") {
    if (!Number.isFinite(mean) || !Number.isFinite(stddev) || stddev <= 0) {
      throw new Error("La desviación estándar no es válida.");
    }
    const low = standardNormalCdf(-sigma);
    const high = standardNormalCdf(sigma);
    return positions.map((p) => {
      const p_norm = low + p * (high - low);
      const val = mean + stddev * standardNormalInvCdf(p_norm);
      return Math.min(maximum, Math.max(minimum, val));
    });
  }

  if (method === "log_linear") {
    let offset = 0;
    if (minimum <= 0) {
      if (!shiftLog) {
        throw new Error("Log-Linear requiere datos positivos. Activa el desplazamiento para ceros/negativos.");
      }
      offset = 1 - minimum;
    }
    const low = Math.log(minimum + offset);
    const high = Math.log(maximum + offset);
    return positions.map((p) => Math.exp(low + p * (high - low)) - offset);
  }

  if (method === "equal_area") {
    return histogramQuantiles(positions, minimum, maximum, counts);
  }

  throw new Error("Distribución desconocida.");
}

export function percentileRange(
  counts: number[],
  minimum: number,
  maximum: number,
  lowPercentile: number,
  highPercentile: number
): { low: number; high: number } {
  if (!(0 <= lowPercentile && lowPercentile < highPercentile && highPercentile <= 100)) {
    throw new Error("Los percentiles deben cumplir 0 ≤ inferior < superior ≤ 100.");
  }
  const [low, high] = histogramQuantiles(
    [lowPercentile / 100, highPercentile / 100],
    minimum,
    maximum,
    counts
  );
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    throw new Error("El rango calculado por percentiles no es válido.");
  }
  return { low, high };
}
