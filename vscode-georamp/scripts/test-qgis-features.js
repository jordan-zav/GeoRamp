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

let state={}, respond=null;

const dom = new JSDOM(html, {runScripts:'dangerously',pretendToBeVisual:true,beforeParse(window) {

  window.GeoRampProjection=projectionModule.exports;

  window.acquireVsCodeApi = () => ({postMessage: message => {messages.push(message);respond?.(message);}, getState:()=>state, setState:value=>state=value});

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

 const w=dom.window,d=w.document;

 const send=data=>w.dispatchEvent(new w.MessageEvent('message',{data}));

 const tick=()=>new Promise(resolve=>w.setTimeout(resolve,35));

 const change=(id,value)=>{const el=d.getElementById(id);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('input'));el.dispatchEvent(new w.Event('change'));};

 const data=(id,offset=0)=>({sourceId:id,fileName:id+'.tif',width:3,height:2,previewWidth:3,previewHeight:2,activeBand:0,bandCount:2,

   previewDataBuffer:new Float64Array([offset+1,offset+2,offset+3,offset+4,offset+100,NaN]).buffer,

   sampleDataBuffer:new Float64Array([offset+1,offset+2,offset+3,offset+4,offset+100,NaN]).buffer,

   stats:{minimum:offset+1,maximum:offset+100,mean:offset+22,stddev:43.617656975,validCount:5,noDataValue:-9999,percentileCounts:[4,0,0,1]},

   geo:{hasGeo:false,epsg:null,crs:'No CRS'}});

 send({type:'sources',activeId:'a',sources:[{id:'a',name:'Alpha.tif',path:'a.tif'},{id:'b',name:'Beta.tif',path:'b.tif'},{id:'c',name:'Gamma.tif',path:'c.tif'}]});

 send({type:'init',data:data('a')});await tick();

 assert.match(d.getElementById('histogramSummary').textContent,/Mediana: 3/);

 assert.match(d.getElementById('histogramSummary').textContent,/Muestras válidas: 5/);

 assert.match(d.getElementById('sigmaSummary').textContent,/5\/5 \(100.0%\)/);

 const before=JSON.stringify(w.captureStyle());

 change('histogramSigma','0');assert.match(d.getElementById('sigmaSummary').textContent,/0\/5/);

 assert.equal(JSON.stringify(w.captureStyle()),before,'Histogram sigma must not modify the ramp');

 d.getElementById('histogramCanvas').dispatchEvent(new w.MouseEvent('mousemove',{clientX:400,clientY:20}));

 assert.match(d.getElementById('histogramCursor').textContent,/Frecuencia:/);

 change('langSelect','en');assert.match(d.getElementById('histogramSummary').textContent,/Median: 3/);

 assert.equal(d.getElementById('importQml').textContent,'Import QML');

 change('numBinsInput','3');await tick();

 const rows=d.querySelectorAll('#breaksTableBody tr');assert.equal(rows.length,3);

 assert.equal(rows[1].children[1].textContent,'1.00000','Continuous table lower bound is previous stop');

 // Equal-area bounds, clipping and non-finite samples must retain saturation / transparency.

 assert.equal(w.evaluateQgisShader(NaN,[10,20],[[0,0,0],[255,255,255]],'discrete'),null);

 assert.deepEqual(Array.from(w.evaluateQgisShader(1000,[10,20],[[0,0,0],[255,255,255]],'discrete')),[255,255,255]);

 change('renderModeSelect','discrete');assert.equal(d.getElementById('compactLegend').checked,false);

 await tick();d.getElementById('exportQml').click();

 const qml=messages.filter(m=>m.type==='saveQml').at(-1).text;

 assert.match(qml,/colorRampType="DISCRETE"/);assert.match(qml,/value="inf"/);

 const imported=w.eval('parseQml')(qml,w.DOMParser);

 assert.equal(imported.values.length,3);assert.equal(imported.mode,'discrete');
 assert.throws(()=>w.eval('parseQml')(qml.replace('value="inf"','value="100"'),w.DOMParser));

 assert.throws(()=>w.eval('parseQml')(qml.replace('singlebandpseudocolor','multibandcolor'),w.DOMParser));

 assert.throws(()=>w.eval('parseQml')(qml.replace('alpha="255"','alpha="125"'),w.DOMParser));

 assert.throws(()=>w.eval('parseQml')('<!DOCTYPE qgis [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+qml,w.DOMParser));

 // Import through the file input, preserving exact irregular stops and band.

 const input=d.getElementById('qmlFileInput');

 const irregular=w.eval('exportQml')({band:0,minimum:1,maximum:100,mode:'continuous',values:[1,8,100],colours:[[0,0,255],[0,255,0],[255,0,0]]});

 Object.defineProperty(input,'files',{configurable:true,value:[{name:'test.qml',text:async()=>irregular}]});

 input.dispatchEvent(new w.Event('change'));await tick();

 d.getElementById('exportQml').click();

 assert.match(messages.filter(m=>m.type==='saveQml').at(-1).text,/value="8"/);

 change('distSelect','linear');await tick();d.getElementById('exportQml').click();

 assert.match(messages.filter(m=>m.type==='saveQml').at(-1).text,/value="50.5"/);

 // Imported RGB tables set the interval count and persist their stops.

 const rgb=d.getElementById('rampFileInput');

 Object.defineProperty(rgb,'files',{configurable:true,value:[{name:'test.csv',text:async()=>'0,0,0,255\n10,0,255,0\n100,255,0,0'}]});

 rgb.dispatchEvent(new w.Event('change'));await tick();assert.equal(d.getElementById('numBinsInput').value,'3');

 assert.equal(state.sourceStyles['a:0'].palette.category,'custom');

 // Batch selection: Ctrl, Shift, drag and groups.

 const press=(id,extra={})=>d.querySelector('#batchList [data-id="'+id+'"]').dispatchEvent(new w.MouseEvent('mousedown',{button:0,...extra}));

 const release=()=>w.dispatchEvent(new w.MouseEvent('mouseup'));

 press('a');release();press('c',{shiftKey:true});release();assert.equal(d.querySelectorAll('#batchList [aria-selected="true"]').length,3);

 press('b',{ctrlKey:true});release();assert.equal(d.querySelectorAll('#batchList [aria-selected="true"]').length,2);

 press('a');d.querySelector('#batchList [data-id="b"]').dispatchEvent(new w.MouseEvent('mouseenter'));release();assert.equal(d.querySelectorAll('#batchList [aria-selected="true"]').length,2);

 d.getElementById('groupName').value='Group';d.getElementById('btnAddGroup').click();

 const group=d.querySelector('.group-row'),drop=new w.Event('drop',{bubbles:true,cancelable:true});

 Object.defineProperty(drop,'dataTransfer',{value:{getData:()=> 'b'}});group.dispatchEvent(drop);

 change('batchView','tree');press(group.dataset.id);release();assert.equal(d.querySelector('#batchList [data-id="b"]').getAttribute('aria-selected'),'true');

 d.getElementById('batchAll').click();

 change('chkManualLimits',false);change('distSelect','linear');await tick();

 respond=message=>{if(message.type==='batchPreview')w.setTimeout(()=>send(message.id==='c' ? {type:'batchError',request:message.request,message:'Fixture failure'} : {type:'batchPreview',request:message.request,data:data(message.id,message.id==='b'?1000:0)}),0);};

 d.getElementById('batchApply').click();await tick();await tick();

 assert.match(d.getElementById('batchStatus').textContent,/2\/3 applied/);

 assert.match(d.getElementById('batchStatus').textContent,/Fixture failure/);

 assert.ok(state.sourceStyles['b:0']);

 send({type:'loading',sourceId:'b'});send({type:'init',data:data('b',1000)});await tick();

 d.getElementById('exportQml').click();assert.match(messages.filter(m=>m.type==='saveQml').at(-1).text,/classificationMin="1001"/);

 assert.equal(d.getElementById('numBinsInput').value,'3');

 respond=null;d.getElementById('batchApply').click();await tick();d.getElementById('batchCancel').click();await tick();

 assert.match(d.getElementById('batchStatus').textContent,/Cancelled/);assert.equal(d.getElementById('batchApply').disabled,false);

 assert.ok(messages.some(m=>m.type==='cancelBatch'));

 // Late cancelled result cannot overwrite styles.

 const request=messages.filter(m=>m.type==='batchPreview').at(-1).request,previous=JSON.stringify(state.sourceStyles);

 send({type:'batchPreview',request,data:data('b',9000)});await tick();assert.equal(JSON.stringify(state.sourceStyles),previous);

 assert.deepEqual(errors,[]);dom.window.close();

 console.log('QGIS parity: histogram, sigma coverage, QML, RGB import, persistence, multi-selection, independent batch limits, failure and cancellation passed');

})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});

