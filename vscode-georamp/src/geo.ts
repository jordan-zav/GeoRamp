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

/** Canvas affine mapping from source preview edges to reference preview edges. */
export function previewToReference(source: any, reference: any): number[] | null {
  if (source.sourceId === reference.sourceId) return [1,0,0,1,0,0];
  if (!source.geo?.transform || !reference.geo?.transform || !source.geo.epsg
    || source.geo.epsg !== reference.geo.epsg) return null;
  const [a,b,c,d,e,f] = reference.geo.transform;
  const determinant = a*e-b*d;
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const [sa,sb,sc,sd,se,sf] = source.geo.transform;
  const sourceOffset = source.geo.pixelIsArea === false ? -0.5 : 0;
  const referenceOffset = reference.geo.pixelIsArea === false ? 0.5 : 0;
  const point = (x:number,y:number): number[] => {
    const px=x*source.width/source.previewWidth+sourceOffset;
    const py=y*source.height/source.previewHeight+sourceOffset;
    const mx=sa*px+sb*py+sc-c, my=sd*px+se*py+sf-f;
    return [((e*mx-b*my)/determinant+referenceOffset)*reference.previewWidth/reference.width,
      ((a*my-d*mx)/determinant+referenceOffset)*reference.previewHeight/reference.height];
  };
  const origin=point(0,0), x=point(1,0), y=point(0,1);
  const result=[x[0]-origin[0],x[1]-origin[1],y[0]-origin[0],y[1]-origin[1],origin[0],origin[1]];
  return result.every(Number.isFinite) ? result : null;
}
