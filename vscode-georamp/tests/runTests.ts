import * as projection from '../src/projection';
import { LayerTree } from '../src/layerTree';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { affineTransformFromFileDirectory, rasterPixelToModel, previewToReference } from '../src/geo';
import { loadGeoTiffBand, readGeoInfo, readGeoTiffWindow } from '../src/geoTiffLoader';
import { normalizePaletteStops, parseRgbTable } from '../src/palettes';

const palette = parseRgbTable(
  '0,0,0,255\n10,0,255,0\n100,255,0,0',
  'non-uniform',
);
assert.deepEqual(palette.stops.map((stop) => stop.position), [0, 0.1, 1]);
assert.deepEqual(
  normalizePaletteStops(palette.stops, true).map((stop) => stop.position),
  [0, 0.9, 1],
);
assert.deepEqual(
  normalizePaletteStops(palette.stops, true).map((stop) => stop.color),
  ['#ff0000', '#00ff00', '#0000ff'],
);

const matrixTransform = affineTransformFromFileDirectory({
  ModelTransformation: [2, 0.5, 0, 100, -0.25, -3, 0, 200, 0, 0, 1, 0, 0, 0, 0, 1],
});
assert.deepEqual(matrixTransform, [2, 0.5, 100, -0.25, -3, 200]);
assert.deepEqual(rasterPixelToModel(matrixTransform!, 4, 5, false), [110.5, 184]);
assert.deepEqual(rasterPixelToModel(matrixTransform!, 4, 5, true), [111.75, 182.375]);

const tiePointTransform = affineTransformFromFileDirectory({
  ModelTiepoint: [10, 20, 0, 500, 1000, 0],
  ModelPixelScale: [2, 3, 0],
});
assert.deepEqual(tiePointTransform, [2, 0, 480, 0, -3, 1060]);
assert.deepEqual(rasterPixelToModel(tiePointTransform!, 10, 20, false), [500, 1000]);

const projectedGeoInfo = readGeoInfo({
  fileDirectory: {
    ModelTiepoint: [0, 0, 0, -100, 100, 0],
    ModelPixelScale: [1, 1, 0],
  },
  getBoundingBox: () => [-100, -100, 100, 100],
  pixelIsArea: () => true,
  getGeoKeys: () => ({
    GTModelTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: 3857,
    GeographicTypeGeoKey: 4326,
  }),
});
assert.equal(projectedGeoInfo.isGeographic, false);
assert.equal(projectedGeoInfo.epsg, 3857);
assert.equal(projectedGeoInfo.hasGeo, true);

const geographicGeoInfo = readGeoInfo({
  fileDirectory: {
    ModelTransformation: [0.1, 0.02, 0, -75, -0.01, -0.1, 0, 12, 0, 0, 1, 0, 0, 0, 0, 1],
  },
  getBoundingBox: () => [-75, 11, -74, 12],
  pixelIsArea: () => false,
  getGeoKeys: () => ({ GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 4326 }),
});
assert.equal(geographicGeoInfo.isGeographic, true);
assert.deepEqual(geographicGeoInfo.transform, [0.1, 0.02, -75, -0.01, -0.1, 12]);

console.log('GeoRamp unit tests passed');

function findGeoTiffs(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return findGeoTiffs(candidate);
    return /\.tiff?$/i.test(entry.name) ? [candidate] : [];
  });
}

async function runSmokeTests(): Promise<void> {
  for (const layout of ['stripped', 'tiled']) {
    const file = path.resolve('tests/fixtures/float64-' + layout + '.tif');
    const raster = await loadGeoTiffBand(file, 0, 8);
    assert.equal(raster.previewWidth, 8);
    assert.ok(Number.isNaN(raster.previewData[0]));
    assert.equal(raster.previewData[1], 2.1234567890123);
    const probe = await readGeoTiffWindow(file, 0, [3,2,4,3], 1, 1);
    assert.equal(probe.data[0], 35.1234567890123);
    const nodata = await readGeoTiffWindow(file, 0, [0,0,2,1], 2, 1);
    assert.ok(Array.from(nodata.data).every(Number.isNaN));
    const detail = await readGeoTiffWindow(file, 0, [4,4,8,8], 4, 4);
    assert.equal(detail.data[0], 68.1234567890123);
    assert.equal(detail.data[15], 119.1234567890123);
    await assert.rejects(readGeoTiffWindow(file, 0, [-1,0,1,1], 1, 1));
    await assert.rejects(readGeoTiffWindow(file, 1, [0,0,1,1], 1, 1));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(readGeoTiffWindow(file, 0, [0,0,1,1], 1, 1, controller.signal));
  }
  console.log('Float64, NoData, overview, source-window and cancellation tests passed');
  const directory = process.env.GEORAMP_SMOKE_DIR;
  if (!directory) return;
  const files = findGeoTiffs(directory);
  assert.ok(files.length > 0, `No GeoTIFF files found in ${directory}`);
  for (const file of files) {
    const raster = await loadGeoTiffBand(file, 0, 512);
    assert.ok(raster.width > 0 && raster.height > 0, `Invalid dimensions: ${file}`);
    assert.ok(raster.stats.validCount > 0, `No valid values: ${file}`);
    assert.ok(Number.isFinite(raster.stats.minimum), `Invalid minimum: ${file}`);
    assert.ok(Number.isFinite(raster.stats.maximum), `Invalid maximum: ${file}`);
  }
  console.log(`GeoRamp smoke-tested ${files.length} GeoTIFF files`);
}

void runSmokeTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const tree = new LayerTree();
tree.add('a','A'); tree.add('b','B'); tree.add('g','Group','group');
assert.equal(tree.move('a','g'),true);
assert.equal(tree.move('g','g'),false);
tree.add('child','Child','group','g');
assert.equal(tree.move('g','child'),false);
tree.nodes.find(n=>n.id==='g')!.visible=false;
assert.equal(tree.layers().find(n=>n.id==='a')!.visible,false);
tree.nodes.find(n=>n.id==='g')!.visible=true;
tree.nodes.find(n=>n.id==='g')!.opacity=0.5;
tree.nodes.find(n=>n.id==='a')!.opacity=0.4;
assert.equal(tree.layers().find(n=>n.id==='a')!.opacity,0.2);
tree.remove('g'); assert.equal(tree.nodes.find(n=>n.id==='a')!.parent,null);
assert.equal(tree.move('a',null,'b'),true);
assert.deepEqual(tree.layers().map(n=>n.id),['a','b']);
const reference={sourceId:'r',width:100,height:100,previewWidth:50,previewHeight:50,
 geo:{epsg:26910,pixelIsArea:true,transform:[2,0,100,0,-2,200]}};
const overlay={sourceId:'o',width:20,height:20,previewWidth:20,previewHeight:20,
 geo:{epsg:26910,pixelIsArea:true,transform:[4,0,120,0,-4,180]}};
assert.deepEqual(previewToReference(overlay,reference),[1,0,0,1,5,5]);
assert.equal(previewToReference({...overlay,geo:{...overlay.geo,epsg:4326}},reference),null);
assert.equal(previewToReference({...overlay,geo:{...overlay.geo,epsg:null}},reference),null);
assert.deepEqual(previewToReference({...overlay,geo:{...overlay.geo,transform:[0,-4,120,-4,0,180]}},reference),[0,1,-1,0,5,5]);
assert.deepEqual(previewToReference({...overlay,geo:{...overlay.geo,pixelIsArea:false}},reference),[1,0,0,1,4.5,4.5]);
console.log('Layer groups, order, inherited visibility/opacity and geospatial alignment passed');

const customProjection = readGeoInfo({fileDirectory:{},getBoundingBox:()=>[0,0,1,1],pixelIsArea:()=>true,
  getGeoKeys:()=>({GTModelTypeGeoKey:1,ProjectedCSTypeGeoKey:32767,GeographicTypeGeoKey:4326})});
assert.equal(customProjection.epsg,null, 'A projected custom CRS must not be treated as geographic WGS84');

function close(actual:number,expected:number,tolerance=1e-6){assert.ok(Math.abs(actual-expected)<tolerance, `${actual} differs from ${expected}`);}
const south=projection.convert(4326,32718,[-75,0]);close(south[0],500000);close(south[1],10000000);
const north=projection.convert(4326,32618,[-75,0]);close(north[0],500000);close(north[1],0);
const webMercator=projection.convert(4326,3857,[-75,0]);close(webMercator[0],-8348961.809495518);close(webMercator[1],0);
const lima: [number,number]=[-77.0428,-12.0464];
const projectedLima=projection.convert(4326,32718,lima),back=projection.convert(32718,4326,projectedLima);
close(back[0],lima[0],1e-8);close(back[1],lima[1],1e-8);
assert.throws(()=>projection.describe('EPSG:999999'));
assert.throws(()=>projection.describe('EPSG:4978'));
assert.ok(projection.search('32718').some(item=>item.id==='EPSG:32718'));
const geographicRaster={width:100,height:100,geo:{epsg:4326,pixelIsArea:true,transform:[0.01,0,-77,0,-0.01,-12]}};
const mapping=projection.mapper(geographicRaster,'EPSG:32718');
const center=mapping.forward(50,50),pixel=mapping.inverse(center[0],center[1]);close(pixel[0],50,1e-6);close(pixel[1],50,1e-6);
const box=projection.bounds(geographicRaster,'EPSG:32718');assert.ok(box[0]<center[0] && box[2]>center[0] && box[1]<center[1] && box[3]>center[1]);
const camera={zoom:0.01,panX:400-center[0]*0.01,panY:300+center[1]*0.01};
const underCursor=projection.screenToPixel(geographicRaster,'EPSG:32718',camera,400,300);close(underCursor[0],50,1e-6);close(underCursor[1],50,1e-6);
const visible=projection.sourceWindow(geographicRaster,'EPSG:32718',camera,800,600)!;
assert.ok(visible[0]<50 && visible[2]>50 && visible[1]<50 && visible[3]>50);
const override=projection.mapper({...geographicRaster,geo:{...geographicRaster.geo,epsg:null,assignedCrs:'EPSG:4326'}},'EPSG:32718');
close(override.forward(50,50)[0],center[0]);
assert.throws(()=>projection.mapper({...geographicRaster,geo:{...geographicRaster.geo,epsg:null}},'EPSG:32718'));
let triangleCount=0;
const drawingContext=new Proxy({}, {get:(_target,key)=>key==='drawImage' ? ()=>{triangleCount++;} : ()=>{}});
projection.draw(drawingContext,{width:100,height:100},geographicRaster,'EPSG:32718',camera);
assert.ok(triangleCount>=128,'Different CRS must use a nonlinear mesh, not one affine transform');
console.log('Project CRS catalog, UTM hemispheres, inverse probes, source overrides and nonlinear warp passed');

// Classification samples must not depend on viewer size (including batch previews).
async function checkSampleGrid() {
  const file=path.resolve('tests/fixtures/float64-tiled.tif');
  const small=await loadGeoTiffBand(file,0,32),large=await loadGeoTiffBand(file,0,1400);
  assert.equal(small.sampleData.length,512*512);
  assert.deepEqual(small.stats,large.stats);
  assert.deepEqual(small.sampleData,large.sampleData);
  console.log('Fixed statistics grid is independent of preview dimensions');
}
checkSampleGrid().catch(error=>{console.error(error);process.exitCode=1;});
