/**
 * Render The Equator Ledger dari suara dan waktu per kata.
 * Pakai: tsx equator.ts <suara> <kata.json> <outDir> [musik]
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';

process.env.DISABLE_TELEMETRY = 'true';
const {renderVideo} = await import('@revideo/renderer');

const [voice, wordsPath, outDir, music] = process.argv.slice(2);
if (!voice || !wordsPath || !outDir) {
  console.error('Pakai: tsx equator.ts <suara> <kata.json> <outDir> [musik]');
  process.exit(2);
}
type Word = {w: string; s: number; e: number};
const words: Word[] = JSON.parse(readFileSync(wordsPath, 'utf-8'));
const clean = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** [nama cue, kata pemicu]. Kata dicari berurutan setelah cue sebelumnya. */
const CUES: [string, string][] = [
  ['three', 'three'], ['oneCountry', 'one'], ['notChina', 'not'], ['china', 'china'], ['russia', 'russia'], ['indonesia', 'indonesia'],
  ['in2020', '2020'], ['banned', 'banned'], ['world', 'told'], ['factories', 'factories'], ['build', 'build'],
  ['europe', 'europe'], ['sued', 'sued'], ['ruling', 'won'], ['appealed', 'appealed'], ['kept', 'kept'],
  ['factoriesCame', 'factories'], ['came', 'came'], ['but', 'but'], ['actually', 'actually'], ['won', 'won'],
];
const cues: Record<string, number> = {};
let cursor = 0;
for (const [name, word] of CUES) {
  const index = words.findIndex((item, i) => i >= cursor && clean(item.w) === word);
  if (index < 0) throw new Error(`Kata "${word}" untuk cue ${name} tidak ada di narasi`);
  cues[name] = words[index].s;
  cursor = index + 1;
}
const STING_SECONDS = 2.5;
cues.sting = words[words.length - 1].e + 0.25;
const duration = Math.max(30, cues.sting + STING_SECONDS);

const SFX: Record<string, string> = {
  tick: 'sine=f=1500:d=0.04,afade=t=out:st=0:d=0.04,volume=0.35',
  click: 'sine=f=850:d=0.03,afade=t=out:st=0:d=0.03,volume=0.5',
  whoosh: 'anoisesrc=d=0.45:c=pink:a=0.32,highpass=f=500,lowpass=f=4500,afade=t=in:d=0.18,afade=t=out:st=0.18:d=0.27',
  thud: 'sine=f=70:d=0.35,afade=t=out:st=0:d=0.35,volume=0.9',
  paper: 'anoisesrc=d=0.3:c=white:a=0.18,highpass=f=1800,afade=t=in:d=0.08,afade=t=out:st=0.08:d=0.22',
};
const sounds: [string, number][] = [
  ['tick', cues.three], ['whoosh', cues.notChina - 0.3], ['click', cues.china], ['click', cues.russia], ['whoosh', cues.indonesia - 0.45],
  ['whoosh', cues.in2020 - 0.85], ['thud', cues.banned], ['click', cues.build], ['paper', cues.europe - 0.4], ['tick', cues.ruling],
  ['tick', cues.kept], ['paper', cues.factoriesCame - 0.55], ['thud', cues.won], ['whoosh', cues.sting - 0.28],
];

const out = resolve(outDir);
mkdirSync(out, {recursive: true});
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => existsSync(p));
const started = Date.now();
// EQUATOR_REUSE=1 hanya mencampur ulang audio dari gambar yang sudah dirender
if (!(process.env.EQUATOR_REUSE && existsSync(join(out, 'silent.mp4')))) await renderVideo({
  projectFile: './src/equator/project.ts',
  variables: {job: {cues, words, duration}},
  settings: {
    outFile: 'silent.mp4',
    outDir: out,
    workers: 1,
    logProgress: false,
    puppeteer: CHROME ? {executablePath: CHROME} : {},
    projectSettings: {size: {x: 1920, y: 1080}, fps: 30, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}} as any,
  },
});
console.log('Render gambar', Math.round((Date.now() - started) / 1000), 'dtk');

/* Suara -14 LUFS, musik jauh di bawahnya dan mengecil saat ada narasi */
const inputs = ['-i', join(out, 'silent.mp4'), '-i', voice];
const graph = [music ? '[1:a]aresample=48000,asplit[voice][key]' : '[1:a]aresample=48000[voice]'];
const mix: string[] = [];
let next = 2;
if (music) {
  inputs.push('-stream_loop', '-1', '-i', music);
  graph.push(`[${next}:a]aresample=48000,volume=0.11,afade=t=out:st=${(duration - 1.5).toFixed(2)}:d=1.5,atrim=0:${duration.toFixed(2)}[bed]`);
  graph.push('[bed][key]sidechaincompress=threshold=0.03:ratio=4:attack=25:release=400[duck]');
  mix.push('[duck]');
  next += 1;
}
sounds.forEach(([name, at], i) => {
  inputs.push('-f', 'lavfi', '-i', SFX[name]);
  graph.push(`[${next}:a]aresample=48000,adelay=${Math.max(0, Math.round(at * 1000))}:all=1[s${i}]`);
  mix.push(`[s${i}]`);
  next += 1;
});
const mixed = `[voice]apad[padded];[padded]${mix.join('')}amix=inputs=${mix.length + 1}:duration=first:normalize=0`;
const TARGET = 'I=-14:TP=-1.5:LRA=11';
/* Dua tahap: diukur dulu, supaya hasil akhirnya benar-benar sekitar -14 LUFS */
const measured = spawnSync('ffmpeg', ['-hide_banner', ...inputs, '-filter_complex', [...graph, `${mixed},loudnorm=${TARGET}:print_format=json[out]`].join(';'),
  '-map', '[out]', '-t', duration.toFixed(2), '-f', 'null', '-'], {encoding: 'utf-8', maxBuffer: 1 << 26});
const stats = JSON.parse(measured.stderr.slice(measured.stderr.lastIndexOf('{'), measured.stderr.lastIndexOf('}') + 1));
const linear = `measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
graph.push(`${mixed},loudnorm=${TARGET}:${linear},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[out]`);
execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph.join(';'), '-map', '0:v', '-map', '[out]',
  '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-t', duration.toFixed(2), '-movflags', '+faststart', join(out, 'video.mp4')], {stdio: 'inherit'});
for (const name of readdirSync(out)) {
  if (name.startsWith('silent')) rmSync(join(out, name));
}
console.log(JSON.stringify({file: join(out, 'video.mp4'), duration, cues}));
