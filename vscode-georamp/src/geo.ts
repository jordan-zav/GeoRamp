export type AffineTransform = [number, number, number, number, number, number];

export function affineTransformFromFileDirectory(fileDirectory: any): AffineTransform | null {
  const matrix = fileDirectory?.ModelTransformation;
  if (matrix?.length >= 8) {
    const transform: AffineTransform = [
      Number(matrix[0]), Number(matrix[1]), Number(matrix[3]),
      Number(matrix[4]), Number(matrix[5]), Number(matrix[7]),
    ];
    return transform.every(Number.isFinite) ? transform : null;
  }

  const tiePoints = fileDirectory?.ModelTiepoint;
  const scale = fileDirectory?.ModelPixelScale;
  if (tiePoints?.length >= 6 && scale?.length >= 2) {
    const rasterX = Number(tiePoints[0]);
    const rasterY = Number(tiePoints[1]);
    const modelX = Number(tiePoints[3]);
    const modelY = Number(tiePoints[4]);
    const scaleX = Number(scale[0]);
    const scaleY = Number(scale[1]);
    const transform: AffineTransform = [
      scaleX,
      0,
      modelX - rasterX * scaleX,
      0,
      -scaleY,
      modelY + rasterY * scaleY,
    ];
    return transform.every(Number.isFinite) ? transform : null;
  }

  return null;
}

export function rasterPixelToModel(
  transform: AffineTransform,
  pixelX: number,
  pixelY: number,
  pixelIsArea: boolean,
): [number, number] {
  const offset = pixelIsArea ? 0.5 : 0;
  const rasterX = pixelX + offset;
  const rasterY = pixelY + offset;
  const [a, b, c, d, e, f] = transform;
  return [
    c + a * rasterX + b * rasterY,
    f + d * rasterX + e * rasterY,
  ];
}
