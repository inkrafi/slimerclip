/**
 * Render animasi penuh 9:16 untuk klip Cinematic.
 * Pakai: tsx clip-motion.ts <jobs.json>, berisi {"outDir": "...", "jobs": [{"id": "...", ...}]}.
 * Tiap baris stdout "OK <id>" atau "FAIL <id> <pesan>", jadi satu animasi gagal tidak menghentikan yang lain.
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

const {outDir, jobs} = JSON.parse(readFileSync(process.argv[2], 'utf-8'));
for (const job of jobs) {
  try {
    await renderVideo({
      projectFile: './src/klik/project.ts',
      variables: {job},
      settings: {
        outFile: `${job.id}.mp4`,
        outDir,
        workers: 1,
        logProgress: false,
        puppeteer: CHROME ? {executablePath: CHROME} : {},
        projectSettings: {size: {x: 1080, y: 1920}, fps: 30, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}} as any,
      },
    });
    console.log(`OK ${job.id}`);
  } catch (e) {
    console.log(`FAIL ${job.id} ${String(e).slice(0, 200).replace(/\s+/g, ' ')}`);
  }
}
process.exit(0);
