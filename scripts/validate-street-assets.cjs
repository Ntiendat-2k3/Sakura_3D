// Kiểm tra GLB và tài nguyên bên ngoài bằng Khronos Validator trong cache công cụ build.
const fs = require('node:fs/promises');
const path = require('node:path');
const validator = require(path.resolve(process.argv[2]));
const root = path.resolve(__dirname, '..');
const assetRoot = path.join(root, 'apps/web/public/assets');

(async () => {
  const results = [];
  for (const folder of process.argv[3]?.split(',') ?? ['buildings', 'props']) {
    for (const name of (await fs.readdir(path.join(assetRoot, folder))).filter(name => name.endsWith('.glb'))) {
      const file = path.join(assetRoot, folder, name);
      const report = await validator.validateBytes(new Uint8Array(await fs.readFile(file)), {
        uri: name,
        externalResourceFunction: async uri => {
          const target = path.resolve(path.dirname(file), decodeURIComponent(uri));
          if (!target.startsWith(assetRoot + path.sep)) throw new Error('Texture vượt thư mục asset');
          return new Uint8Array(await fs.readFile(target));
        },
      });
      results.push({ file: path.relative(root, file).replaceAll('\\', '/'), ...report.issues });
    }
  }
  await fs.writeFile(path.join(root, process.argv[4] ?? 'assets/processed/gltf-validation.json'), JSON.stringify({ validator: validator.version(), results }, null, 2));
  console.log(JSON.stringify(results.map(({ file, numErrors, numWarnings }) => ({ file, numErrors, numWarnings })), null, 2));
  if (results.some(r => r.numErrors)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
