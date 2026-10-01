// Run against an isolated VS Code development host with a georeferenced TIFF open.
// The second TIFF is decoded by the real loader and delivered through the webview message contract.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),esbuild=require('esbuild');
const port=Number(process.argv[2]||9334),overlayPath=process.argv[3],screenshotPath=process.argv[4],assignedCrs=process.argv[5];
function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let requestId = 0;
  const pending = new Map();
  const exceptions = [];
  const contexts = [];

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.text);
    } else if (message.method === 'Runtime.executionContextCreated') {
      contexts.push(message.params.context);
    }
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  async function call(method, params = {}) {
    await ready;
    const id = ++requestId;
    const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    socket.send(JSON.stringify({ id, method, params }));
    return response;
  }

  async function evaluate(expression, contextId) {
    const response = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      ...(contextId ? { contextId } : {}),
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result.value;
  }

  return { socket, call, evaluate, exceptions, contexts };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}


async function main(){
  if(!overlayPath || !screenshotPath || !assignedCrs)throw new Error('Usage: node scripts/test-live-overlays.js PORT OVERLAY_TIFF SCREENSHOT CRS');
  const code=esbuild.buildSync({entryPoints:['src/geoTiffLoader.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
  const mod={exports:{}};vm.runInNewContext(code,{module:mod,exports:mod.exports,require,console,process,Buffer,AbortController,TextDecoder,TextEncoder,setTimeout,clearTimeout});
  const raw=await mod.exports.loadGeoTiffBand(overlayPath,0,512);
  const payload={...raw,sourceId:'qa-overlay',fileName:path.basename(overlayPath),previewData:Array.from(raw.previewData),sampleData:Array.from(raw.sampleData)};
  assert(raw.geo.transform && !raw.geo.epsg,'Overlay fixture must have a transform and missing CRS');
  const targets=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
  const webview=connect(targets.find(t=>process.argv.includes('--browser') ? t.type==='page'&&t.url.startsWith('file:') : t.type==='iframe'&&t.url.includes('extensionId=jordanzav.georamp')));
  const page=connect(targets.find(t=>t.type==='page'&&(!process.argv.includes('--browser') || t.url.startsWith('file:'))));
  try{
    await webview.call('Runtime.enable');await new Promise(r=>setTimeout(r,200));let context;
    for(const c of webview.contexts.filter(c=>c.auxData?.isDefault)){
      if(await webview.evaluate('Boolean(document.getElementById("rasterCanvas"))',c.id).catch(()=>false)){context=c.id;break;}
    }
    assert(context,'Webview not found');const evaluate=expression=>webview.evaluate(expression,context);
    await evaluate(`new Promise((resolve,reject)=>{const deadline=Date.now()+30000;const check=()=>{
      if(typeof rasterInfo!=='undefined'&&rasterInfo&&statusOverlay.hidden&&layerViews.has(rasterInfo.sourceId))resolve(true);
      else if(Date.now()>deadline)reject(new Error('Raster load timed out'));else setTimeout(check,100);
    };check();})`);
    const before=await evaluate(`(()=>{
      const data=${JSON.stringify(payload)};
      data.previewDataBuffer=Float64Array.from(data.previewData,v=>v===null?NaN:v).buffer;
      data.sampleDataBuffer=Float64Array.from(data.sampleData,v=>v===null?NaN:v).buffer;
      sourceAssignments.delete(data.sourceId);
      window.dispatchEvent(new MessageEvent('message',{data:{type:'sources',activeId:activeSourceId,sources:[...sourceEntries.filter(s=>s.id!==data.sourceId),{id:data.sourceId,name:data.fileName,path:data.fileName}]}}));
      window.dispatchEvent(new MessageEvent('message',{data:{type:'layerPreview',id:data.sourceId,data}}));
      return {notice:document.getElementById('compositionStatus').textContent,hidden:document.getElementById('compositionStatus').hidden,projectCrs};
    })()`);
    assert(!before.hidden && /1\/2/.test(before.notice),'Missing CRS layer was not explicitly reported');
    assert(before.projectCrs===assignedCrs,'Test assignment must match the explicit project CRS');
    const result=await evaluate(`(()=>{
      document.querySelector('[data-id="qa-overlay"] .source-assign-crs').click();
      if(!document.getElementById('compositionStatus').hidden)throw new Error('Assigned overlay is still blocked');
      const lowerId=rasterInfo.sourceId;
      const visibility=(id,value)=>{const el=Array.from(document.querySelectorAll('.source-row')).find(row=>row.dataset.id===id).querySelector('.layer-visible');el.checked=value;el.dispatchEvent(new Event('change'));};
      const pixels=()=>compositionCanvas.getContext('2d').getImageData(0,0,compositionCanvas.width,compositionCanvas.height).data;
      visibility(lowerId,false);const top=pixels();visibility(lowerId,true);visibility('qa-overlay',false);const bottom=pixels();
      let index=-1,hole=-1;
      for(let i=0;i<top.length;i+=4){
        if(index<0&&top[i+3]===255&&bottom[i+3]===255&&Math.abs(top[i]-bottom[i])+Math.abs(top[i+1]-bottom[i+1])+Math.abs(top[i+2]-bottom[i+2])>60)index=i;
        if(hole<0&&top[i+3]===0&&bottom[i+3]===255)hole=i;
      }
      if(index<0)throw new Error('No distinguishable overlapping pixels');
      const pixel=(data,i=index)=>Array.from(data.slice(i,i+4));
      visibility('qa-overlay',true);const both=pixels(),ordered=pixel(both),throughHole=hole>=0?pixel(both,hole):null;
      const opacity=document.querySelector('[data-id="qa-overlay"] input[type="range"]');opacity.value='50';opacity.dispatchEvent(new Event('input'));const blend=pixel(pixels());
      opacity.value='100';opacity.dispatchEvent(new Event('input'));
      const lowerRow=Array.from(document.querySelectorAll('.source-row')).find(row=>row.dataset.id===lowerId);
      lowerRow.querySelectorAll('.layer-options button')[0].click();const reordered=pixel(pixels());
      const activeUnchanged=rasterInfo.sourceId===lowerId;
      const newLowerRow=Array.from(document.querySelectorAll('.source-row')).find(row=>row.dataset.id===lowerId);
      newLowerRow.querySelectorAll('.layer-options button')[1].click();
      document.querySelector('[data-id="qa-overlay"] input[type="range"]').value='50';
      document.querySelector('[data-id="qa-overlay"] input[type="range"]').dispatchEvent(new Event('input'));
      return {top:pixel(top),bottom:pixel(bottom),ordered,blend,reordered,throughHole,holeExpected:hole>=0?pixel(bottom,hole):null,
        activeUnchanged,assigned:sourceAssignments.get('qa-overlay'),noticeHidden:document.getElementById('compositionStatus').hidden};
    })()`);
    assert(JSON.stringify(result.ordered)===JSON.stringify(result.top),'Topmost layer did not win');
    assert(JSON.stringify(result.reordered)===JSON.stringify(result.bottom),'Reordering did not change the winning layer');
    assert(result.blend.slice(0,3).every((v,i)=>Math.abs(v-(result.top[i]+result.bottom[i])/2)<=2),'50 percent opacity did not blend both rasters');
    if(result.throughHole)assert(JSON.stringify(result.throughHole)===JSON.stringify(result.holeExpected),'NoData hid the lower raster');
    assert(result.activeUnchanged && result.noticeHidden && result.assigned===assignedCrs,'Layer selection or alignment failed');
    assert(webview.exceptions.length===0,webview.exceptions.join('; '));
    await page.call('Page.enable');const shot=await page.call('Page.captureScreenshot',{format:'png',fromSurface:true});fs.writeFileSync(screenshotPath,Buffer.from(shot.data,'base64'));
    console.log(JSON.stringify({before,result,screenshotPath},null,2));
  }finally{webview.socket.close();page.socket.close();}
}
main().catch(error=>{console.error(error);process.exit(1);});
