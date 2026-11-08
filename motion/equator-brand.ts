/**
 * Render title sting dan end screen The Equator Ledger.
 * Pakai: tsx equator-brand.ts <outDir>
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';

process.env.DISABLE_TELEMETRY = 'true';
const {renderVideo} = await import('@revideo/renderer');

const out = resolve(process.argv[2] || 'output/equator/channel-kit/03-video');
mkdirSync(out, {recursive: true});
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => existsSync(p));

const JOBS = [
  {kind: 'sting', file: 'title-sting-3s', duration: 3},
  {kind: 'end', file: 'end-screen-20s', duration: 20},
];
for (const job of JOBS) {
  await renderVideo({
    projectFile: './src/equator/brand-project.ts',
    variables: {job},
    settings: {
      outFile: `${job.file}_silent.mp4`,
      outDir: out,
      workers: 1,
      logProgress: false,
      puppeteer: CHROME ? {executablePath: CHROME} : {},
      projectSettings: {size: {x: 1920, y: 1080}, fps: 30, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}} as any,
    },
  });
  const video = join(out, `${job.file}_silent.mp4`);
  const target = join(out, `${job.file}.mp4`);
  const encode = ['-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart'];
  if (job.kind === 'sting') {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video,
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.5:c=pink:a=0.3,highpass=f=500,lowpass=f=4500,afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.3',
      '-f', 'lavfi', '-i', 'sine=f=72:d=0.5,afade=t=out:st=0:d=0.5,volume=0.8',
      '-filter_complex', '[1:a]aresample=48000[w];[2:a]aresample=48000,adelay=850:all=1[h];[w][h]amix=inputs=2:duration=longest:normalize=0,apad,aformat=sample_fmts=fltp:channel_layouts=stereo[a]',
      '-map', '0:v', '-map', '[a]', ...encode, '-c:a', 'aac', '-b:a', '192k', '-t', String(job.duration), target], {stdio: 'inherit'});
  } else {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, ...encode, '-an', target], {stdio: 'inherit'});
  }
  for (const name of readdirSync(out)) {
    if (name.startsWith(`${job.file}_silent`)) rmSync(join(out, name));
  }
  console.log('OK', target);
}
