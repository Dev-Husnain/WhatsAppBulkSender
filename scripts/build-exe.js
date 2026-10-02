// Builds dist/WhatsAppBulkSender.exe: the web sender (src/server.js) plus the page,
// packed into a copy of Node as a single executable application.
// Usage: npm run build:exe   (on Windows, with the same Node version you want to ship)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const bundle = path.join(dist, 'bundle.cjs');
const blob = path.join(dist, 'sea-prep.blob');
const exe = path.join(dist, 'WhatsAppBulkSender.exe');

async function main() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist);

  console.log('1/4 Bundling...');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'exe-entry.js')],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: `node${process.versions.node.split('.')[0]}`,
    // The exe uses the installed Chrome/Edge, so swap in Puppeteer without the browser download
    alias: {
      puppeteer: 'puppeteer-core',
      'fluent-ffmpeg': path.join(__dirname, 'stubs', 'fluent-ffmpeg.js'),
    },
    define: { __EMBEDDED_PAGE__: JSON.stringify(fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8')) },
    // Optional extras loaded inside try/catch and never used here (remote auth, faster websockets)
    external: ['archiver', 'unzipper', 'fs-extra', 'bufferutil', 'utf-8-validate'],
    logLevel: 'warning',
  });

  console.log('2/4 Preparing single executable blob...');
  const seaConfig = path.join(dist, 'sea-config.json');
  fs.writeFileSync(seaConfig, JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true }));
  execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

  console.log('3/4 Copying Node...');
  fs.copyFileSync(process.execPath, exe);

  console.log('4/4 Injecting app into the exe...');
  execFileSync(
    process.execPath,
    [
      require.resolve('postject/dist/cli.js'),
      exe,
      'NODE_SEA_BLOB',
      blob,
      '--sentinel-fuse',
      'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    ],
    { stdio: 'inherit' },
  );

  const mb = (fs.statSync(exe).size / 1024 / 1024).toFixed(1);
  console.log(`\nBuilt ${path.relative(root, exe)} (${mb} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
