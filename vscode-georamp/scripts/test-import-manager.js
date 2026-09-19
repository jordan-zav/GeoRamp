const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const esbuild = require('esbuild');
const vm = require('vm');
const compiled = esbuild.buildSync({entryPoints:['src/webviewContent.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const mod = {exports:{}};
vm.runInNewContext(compiled, {module:mod,exports:mod.exports,require});
const html = mod.exports.getWebviewContent({cspSource:'test'}, {}, 'initial.tif');
const projectionCode=esbuild.buildSync({entryPoints:['src/projection.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const projectionModule={exports:{}};vm.runInNewContext(projectionCode,{module:projectionModule,exports:projectionModule.exports,require});
const messages = [], errors = [], draws = [];
const dom = new JSDOM(html, {runScripts:'dangerously',pretendToBeVisual:true,beforeParse(window) {
  window.GeoRampProjection=projectionModule.exports;
  window.acquireVsCodeApi = () => ({postMessage: message => messages.push(message)});
  window.HTMLElement.prototype.getBoundingClientRect = function(){return {left:0,top:0,width:800,height:600,right:800,bottom:600};};
  window.ResizeObserver = class { observe() {} disconnect() {} };
  const contexts = new WeakMap();
  window.HTMLCanvasElement.prototype.getContext = function () {
    if (contexts.has(this)) return contexts.get(this);
    const canvas=this, state={globalAlpha:1};
    const context=new Proxy(state, {get: (target,key) => {
    if (key === 'drawImage') return image => draws.push({target:canvas.id,source:image.dataset?.sourceId,alpha:state.globalAlpha});
    if (key in target) return target[key];
    if (key === 'createImageData') return (w,h) => ({data:new Uint8ClampedArray(w*h*4)});
    if (key === 'measureText') return () => ({width:20});
    return () => {};
  },set: (target,key,value) => {target[key]=value;return true;}});
    contexts.set(this,context);return context;
  };
  window.addEventListener('error', event => errors.push(event.error));
}});
(async()=>{
const w=dom.window, d=w.document;
const send = data => w.dispatchEvent(new w.MessageEvent('message',{data}));
assert.equal(messages.shift().type, 'ready');
assert.equal(d.querySelector('.import-manager').nextElementSibling.className,'visualization-workspace');
assert.ok(d.querySelector('.visualization-workspace > .content-area'));
assert.ok(d.querySelector('.visualization-workspace > .visualization-controls'));
d.getElementById('btnImportSources').click(); assert.equal(messages.pop().type,'importSources');
send({type:'sources',activeId:'a',sources:[{id:'a',name:'<img src=x>.tif',path:'/first/a.tif'},{id:'b',name:'second.tif',path:'/other/b.tif'}]});
assert.equal(d.querySelectorAll('.source-row').length,2);
assert.equal(d.querySelectorAll('.source-row img').length,0);
d.querySelector('[data-id="b"] .source-open').click(); assert.equal(messages.pop().id,'b');
d.querySelector('[data-id="b"] .source-remove').click(); assert.equal(messages.pop().type,'removeSource');
const search=d.getElementById('sourceSearch'); search.value='second'; search.dispatchEvent(new w.Event('input'));
assert.equal(d.querySelectorAll('.source-row').length,1);
function init(id) {
 send({type:'init',data:{sourceId:id,fileName:id+'.tif',width:2,height:2,previewWidth:2,previewHeight:2,
 activeBand:0,bandCount:1,previewDataBuffer:new Float64Array([1,2,3,4]).buffer,sampleDataBuffer:new Float64Array([1,2,3,4]).buffer,
 stats:{minimum:1,maximum:4,mean:2.5,stddev:1,validCount:4,noDataValue:null,percentileCounts:[1,1,1,1]},geo:{hasGeo:true,crs:'EPSG:26910',epsg:26910,pixelIsArea:true,transform:[1,0,0,0,-1,0]}}});
}
init('a');
await new Promise(resolve=>w.setTimeout(resolve,30));
d.getElementById('chkManualLimits').checked=true; d.getElementById('manualMinInput').value='-100';
send({type:'loading',sourceId:'b'}); init('b'); await new Promise(resolve=>w.setTimeout(resolve,30)); assert.equal(d.getElementById('chkManualLimits').checked,false);
send({type:'loading',sourceId:'a'}); init('a'); assert.equal(d.getElementById('manualMinInput').value,'-100');
assert.equal(d.getElementById('chkManualLimits').checked,true);
search.value='';search.dispatchEvent(new w.Event('input'));
await new Promise(resolve=>w.setTimeout(resolve,30));
const visible=d.querySelector('[data-id="b"] .layer-visible');visible.checked=false;draws.length=0;visible.dispatchEvent(new w.Event('change'));
assert.deepEqual(draws.filter(draw=>draw.target==='compositionCanvas').map(draw=>draw.source),['a']);
visible.checked=true;visible.dispatchEvent(new w.Event('change'));
const opacity=d.querySelector('[data-id="b"] input[type=range]');opacity.value='50';draws.length=0;opacity.dispatchEvent(new w.Event('input'));
assert.deepEqual(draws.filter(draw=>draw.target==='compositionCanvas').map(draw=>[draw.source,draw.alpha]),[['a',1],['b',0.5]]);
d.getElementById('groupName').value='Geophysics';d.getElementById('btnAddGroup').click();
assert.equal(d.querySelectorAll('.group-row').length,1);
const group=d.querySelector('.group-row'), drop=new w.Event('drop',{bubbles:true,cancelable:true});
Object.defineProperty(drop,'dataTransfer',{value:{getData:()=> 'b'}});group.dispatchEvent(drop);
const groupVisibility=d.querySelector('.group-row .layer-visible');groupVisibility.checked=false;draws.length=0;groupVisibility.dispatchEvent(new w.Event('change'));
assert.deepEqual(draws.filter(draw=>draw.target==='compositionCanvas').map(draw=>draw.source),['a']);
const projectInput=d.getElementById('projectCrs');assert.equal(projectInput.value,'EPSG:26910');
projectInput.value='EPSG:3857';d.getElementById('applyProjectCrs').click();
assert.equal(projectInput.value,'EPSG:3857');
const projectCamera=JSON.stringify(w.camera());
send({type:'loading',sourceId:'b'});init('b');await new Promise(resolve=>w.setTimeout(resolve,30));
assert.equal(projectInput.value,'EPSG:3857','Selecting a layer must not change project CRS');
assert.equal(JSON.stringify(w.camera()),projectCamera,'Selecting a layer must preserve the project camera');
projectInput.value='EPSG:999999';d.getElementById('applyProjectCrs').click();
assert.ok(d.getElementById('projectCrsStatus').textContent.includes('no disponible'));
send({type:'loading',sourceId:'a'});init('a');assert.equal(projectInput.value,'EPSG:3857','Invalid CRS must not replace the valid project');
send({type:'empty'}); assert.equal(d.getElementById('bandSelect').children.length,0);
assert.equal(d.getElementById('activeSourceTitle').textContent,'GeoRamp');
assert.deepEqual(errors,[]);
dom.window.close();
console.log('Import manager DOM, actions, filtering, empty state and per-raster styles passed');

})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});
