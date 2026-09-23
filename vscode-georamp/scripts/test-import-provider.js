const assert = require('node:assert/strict');
const vm = require('vm');
const esbuild = require('esbuild');
const bundle = esbuild.buildSync({entryPoints:['src/extension.ts'],bundle:true,platform:'node',format:'cjs',write:false,
 external:['vscode','./geoTiffLoader','./webviewContent']}).outputFiles[0].text;
const uri = name => ({scheme:'file',fsPath:'/rasters/'+name,toString:()=> 'file:///rasters/'+name});
const a=uri('a.tif'), b=uri('b.tif');
const sent=[], loads=[], probes=[], writes=[], saved=[], loadedBands=[];
let handler, picked=[], release;
const mockVSCode={Uri:{file:uri},window:{showOpenDialog:async()=>picked,showSaveDialog:async()=>uri('test.qml')},workspace:{fs:{writeFile:async(target,data)=>writes.push(data.toString())},getConfiguration:()=>({get:()=>512})}};
const loader={loadGeoTiffBand:async(file,band)=>{
 loads.push(file);loadedBands.push(band);
 if (release === 'defer') await new Promise(resolve=>{release=resolve;});
 return {width:2,height:2,bandCount:2,activeBand:Math.min(1,band),stats:{},geo:{},previewWidth:2,previewHeight:2,
 previewData:new Float64Array(4),sampleData:new Float64Array(4)};
},readGeoTiffWindow:async(file)=>{probes.push(file);return {width:1,height:1,window:[0,0,1,1],data:new Float64Array([42])};}};
const mod={exports:{}};
vm.runInNewContext(bundle,{module:mod,exports:mod.exports,AbortController,Buffer,require:name=>{
 if(name==='vscode')return mockVSCode;
 if(name==='./geoTiffLoader')return loader;
 if(name==='./webviewContent')return {getWebviewContent:()=>''};
 return require(name);
}});
(async()=>{
 const provider=new mod.exports.GeoRampEditorProvider({extensionUri:a,globalState:{get:()=>({language:'en'}),update:async(key,value)=>saved.push(value)}});
 await provider.resolveCustomEditor({uri:a},{webview:{postMessage:async msg=>sent.push(msg),onDidReceiveMessage:fn=>handler=fn},onDidDispose:()=>{}},{onCancellationRequested:()=>{}});
 await handler({type:'ready',bands:{[a.toString()]:1}}); assert.equal(loads.at(-1),a.fsPath);assert.equal(loadedBands.at(-1),1);assert.equal(sent.at(-1).data.activeBand,1);
 picked=[a,b,b]; await handler({type:'importSources'});
 assert.equal(sent.at(-1).sources.length,2);
 await handler({type:'selectSource',id:b.toString()}); assert.equal(loads.at(-1),b.fsPath);
 await handler({type:'savePreferences',preferences:{language:'es',style:{inputs:[]}}});assert.equal(saved.at(-1).language,'es');
 await handler({type:'saveQml',sourceId:b.toString(),text:'<qgis/>'});assert.equal(writes.at(-1),'<qgis/>');
 await handler({type:'batchPreview',id:a.toString(),band:0,request:10});
 assert.equal(sent.at(-1).type,'batchPreview');assert.equal(sent.at(-1).data.sourceId,a.toString());
 await handler({type:'batchPreview',id:a.toString(),band:2,request:11});assert.equal(sent.at(-1).type,'batchError');
 release='defer';const cancelled=handler({type:'batchPreview',id:a.toString(),band:0,request:12});
 while(typeof release!=='function')await Promise.resolve();
 await handler({type:'cancelBatch'});const finishBatch=release;release=undefined;finishBatch();await cancelled;
 assert.ok(!sent.some(message=>message.request===12),'Cancelled batch must not deliver stale data');
 await handler({type:'probe',sourceId:a.toString(),band:0,id:1,window:[0,0,1,1],width:1,height:1});
 assert.equal(probes.length,0);
 await handler({type:'probe',sourceId:b.toString(),band:0,id:2,window:[0,0,1,1],width:1,height:1});
 assert.equal(probes.at(-1),b.fsPath);
 release='defer'; const pending=handler({type:'selectSource',id:a.toString()});
 while(typeof release!=='function') await Promise.resolve();
 await handler({type:'selectSource',id:b.toString()});
 const finish=release; release=undefined; finish(); await pending;
 assert.equal(sent.filter(msg=>msg.type==='init').at(-1).data.sourceId,b.toString());
 await handler({type:'removeSource',id:b.toString()}); assert.equal(loads.at(-1),a.fsPath);
 await handler({type:'removeSource',id:a.toString()}); assert.equal(sent.at(-1).type,'empty');
 picked=[b]; await handler({type:'importSources'}); assert.equal(loads.at(-1),b.fsPath);
 console.log('Import provider deduplication, switching, source isolation, stale loads and empty recovery passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
