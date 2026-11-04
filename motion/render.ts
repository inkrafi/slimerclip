/**
 * Render sekumpulan adegan animasi menjadi .mov transparan.
 * Pakai: tsx render.ts <jobs.json>, berisi {"outDir": "...", "jobs": [{"id": "...", "template": "...", "seconds": 8, ...}]}.
 * Tiap baris stdout "OK <id>" atau "FAIL <id> <pesan>", jadi satu adegan gagal tidak menghentikan yang lain.
 */
import {readFileSync} from 'node:fs';
import {existsSync} from 'node:fs';

process.env.DISABLE_TELEMETRY = 'true';
const {renderVideo} = await import('@revideo/renderer');

const CHROME_PATHS = [
  process.env.MOTION_CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean) as string[];
const executablePath = CHROME_PATHS.find(path => existsSync(path));

const {outDir, jobs} = JSON.parse(readFileSync(process.argv[2], 'utf-8'));
let failed = 0;
for (const job of jobs) {
  try {
    await renderVideo({
      projectFile: './src/project.ts',
      variables: {job},
      settings: {
        outFile: `${job.id}.mov`,
        outDir,
        workers: 1,
        logProgress: false,
        puppeteer: executablePath ? {executablePath} : {},
        projectSettings: {fps: 30, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'proRes'}}},
      },
    });
    console.log(`OK ${job.id}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL ${job.id} ${String(e).slice(0, 200).replace(/\s+/g, ' ')}`);
  }
}
process.exit(failed === jobs.length && jobs.length > 0 ? 1 : 0);
