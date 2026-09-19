const assert = require('node:assert/strict');
const vm = require('vm');
const esbuild = require('esbuild');
const bundle = esbuild.buildSync({entryPoints:['src/extension.ts'],bundle:true,platform:'node',format:'cjs',write:false,
 external:['vscode','./geoTiffLoader','./webviewContent']}).outputFiles[0].text;
const uri = name => ({scheme:'file',fsPath:'/rasters/'+name,toString:()=> 'file:///rasters/'+name});
const a=uri('a.tif'), b=uri('b.tif');
const sent=[], loads=[], probes=[];
let handler, picked=[], release;
const mockVSCode={window:{showOpenDialog:async()=>picked},workspace:{getConfiguration:()=>({get:()=>512})}};
const loader={loadGeoTiffBand:async(file,band)=>{
 loads.push(file);
 if (release === 'defer') await new Promise(resolve=>{release=resolve;});
 return {width:2,height:2,bandCount:1,activeBand:band,stats:{},geo:{},previewWidth:2,previewHeight:2,
 previewData:new Float64Array(4),sampleData:new Float64Array(4)};
},readGeoTiffWindow:async(file)=>{probes.push(file);return {width:1,height:1,window:[0,0,1,1],data:new Float64Array([42])};}};
const mod={exports:{}};
vm.runInNewContext(bundle,{module:mod,exports:mod.exports,AbortController,require:name=>{
 if(name==='vscode')return mockVSCode;
 if(name==='./geoTiffLoader')return loader;
 if(name==='./webviewContent')return {getWebviewContent:()=>''};
 return require(name);
}});
(async()=>{
 const provider=new mod.exports.GeoRampEditorProvider({extensionUri:a});
 await provider.resolveCustomEditor({uri:a},{webview:{postMessage:async msg=>sent.push(msg),onDidReceiveMessage:fn=>handler=fn},onDidDispose:()=>{}},{onCancellationRequested:()=>{}});
 await handler({type:'ready'}); assert.equal(loads.at(-1),a.fsPath);
 picked=[a,b,b]; await handler({type:'importSources'});
 assert.equal(sent.at(-1).sources.length,2);
 await handler({type:'selectSource',id:b.toString()}); assert.equal(loads.at(-1),b.fsPath);
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
