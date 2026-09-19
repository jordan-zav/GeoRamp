const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: false,
  logLevel: 'info'
};

const projectionOptions = {
  entryPoints: ['src/projection.ts'], outfile:'dist/projection.js', bundle:true,
  format:'iife', globalName:'GeoRampProjection', platform:'browser', target:'es2022', minify:true,
  plugins:[{name:'compact-crs-catalog',setup(build){
    build.onLoad({filter:/epsg-index[\\/]all\.json$/},args=>{
      const all=JSON.parse(require('fs').readFileSync(args.path,'utf8'));
      const compact=Object.fromEntries(Object.entries(all).map(([code,item])=>[code,
        {name:item.name,proj4:item.proj4,kind:item.kind,accuracy:item.accuracy,unit:item.unit}]));
      return {contents:JSON.stringify(compact),loader:'json'};
    });
  }}]
};
async function main() {
  if (watch) {
    const context = await esbuild.context(options);
    await context.watch();
    const projectionContext=await esbuild.context(projectionOptions);
    await projectionContext.watch();
  } else {
    await esbuild.build(options);
    await esbuild.build(projectionOptions);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
