const esbuild = require('esbuild');
const vm = require('vm');
const { TextDecoder, TextEncoder } = require('node:util');

const output = esbuild.buildSync({
  entryPoints: ['tests/runTests.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
}).outputFiles[0].text;

const moduleValue = { exports: {} };
vm.runInNewContext(
  '(function(module,exports,require){' + output + '\n})(moduleValue,moduleValue.exports,require)',
  {
    moduleValue,
    require,
    console,
    process,
    Buffer,
    AbortController,
    TextDecoder,
    TextEncoder,
    setTimeout,
    clearTimeout,
  },
);
