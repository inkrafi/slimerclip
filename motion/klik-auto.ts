/**
 * Gambar video channel dari proyek aplikasi, tanpa suara. Suaranya dicampur oleh backend/klik_render.py.
 * Pakai: tsx klik-auto.ts <job.json>, berisi {"outDir": "...", "job": {...}}. job.layout: short = 9:16, long = 16:9.
 */
import {existsSync, readFileSync} from 'node:fs';

process.env.DISABLE_TELEMETRY = 'true';
const {renderVideo} = await import('@revideo/renderer');

const CHROME = [
  process.env.MOTION_CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean).find(path => existsSync(path as string)) as string | undefined;

const {outDir, job} = JSON.parse(readFileSync(process.argv[2], 'utf-8'));
const size = job.layout === 'long' ? {x: 1920, y: 1080} : {x: 1080, y: 1920};
await renderVideo({
  projectFile: './src/klik/project.ts',
  variables: {job},
  settings: {
    outFile: 'klik_silent.mp4',
    outDir,
    workers: 1,
    logProgress: false,
    puppeteer: CHROME ? {executablePath: CHROME} : {},
    projectSettings: {size, fps: 30, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}} as any,
  },
});
process.exit(0);
