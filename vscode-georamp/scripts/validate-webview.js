const esbuild = require('esbuild');
const vm = require('vm');

const output = esbuild.buildSync({
  entryPoints: ['src/webviewContent.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
}).outputFiles[0].text;

const moduleValue = { exports: {} };
vm.runInNewContext(
  '(function(module,exports,require){' + output + '})(moduleValue,moduleValue.exports,require)',
  { moduleValue, require }
);
const html = moduleValue.exports.getWebviewContent(
  { cspSource: 'vscode-webview:' },
  {},
  'test.tif'
);
const match = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);
if (!match) throw new Error('Webview script not found.');
new Function(match[1]);
console.log('Webview script syntax OK');
