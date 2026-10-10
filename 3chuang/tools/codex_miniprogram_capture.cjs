const fs = require('node:fs/promises');
const path = require('node:path');
const automator = require('../output/miniprogram-automator-runtime/node_modules/miniprogram-automator');

const outputDir = path.resolve('output/playwright/miniprogram-evidence');
const routes = [
  ['01-index', '/pages/index/index'],
  ['02-cargo-input', '/pages/cargo-input/cargo-input'],
  ['03-container-select', '/pages/container-select/container-select'],
  ['04-packing-result', '/pages/packing-result/packing-result'],
  ['05-export-empty', '/pages/export/export']
];

(async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const logs = [];
  const exceptions = [];
  let miniProgram;
  try {
    miniProgram = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9431' });
    miniProgram.on('console', (entry) => logs.push(entry));
    miniProgram.on('exception', (entry) => exceptions.push(entry));

    const captures = [];
    for (const [name, route] of routes) {
      const page = await miniProgram.reLaunch(route);
      await page.waitFor(1800);
      const file = `${name}.png`;
      await miniProgram.screenshot({ path: path.join(outputDir, file) });
      captures.push({
        name,
        route: page.path,
        file
      });
    }
    const result = {
      capturedAt: new Date().toISOString(),
      project: path.resolve('miniprogram'),
      captures,
      logCount: logs.length,
      exceptionCount: exceptions.length,
      exceptions
    };
    await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify({
      at: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      logs,
      exceptions
    }, null, 2));
    throw error;
  } finally {
    if (miniProgram) miniProgram.disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
