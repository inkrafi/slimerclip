/**
 * Render video Klik Digital ID dari suara dan waktu per kata.
 * Pakai: tsx klik.ts <short|long> <suara.mp3> <kata.json> <outDir> [musik.m4a]
 * Isi adegan mengikuti kata yang diucapkan, jadi rekaman baru cukup diberi waktu per kata yang baru.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

process.env.DISABLE_TELEMETRY = 'true';
const {renderVideo} = await import('@revideo/renderer');

type Sfx = 'tick' | 'whoosh' | 'click' | 'thud' | null;
/** [nama cue, kata pemicu, efek suara]. Kata dicari berurutan setelah cue sebelumnya. */
const CUES: Record<string, [string, string, Sfx][]> = {
  short: [
    ['drain', 'tanggal', 'tick'], ['phone', 'degdegan', 'whoosh'], ['ask', 'lu', 'click'], ['stamp', 'belum', 'thud'], ['open', 'kita', 'whoosh'],
    ['r0', 'kos', 'tick'], ['r1', 'makan', 'tick'], ['r2', 'cicilan', 'tick'], ['r3', 'transport', 'tick'], ['r4', 'nongkrong', 'tick'], ['r5', 'langganan', 'tick'],
    ['left', 'sisanya', 'whoosh'], ['last3', 'tapi', 'whoosh'], ['sum', 'totalnya', 'tick'], ['same', 'segede', 'thud'], ['question', 'nah', 'click'],
  ],
  long: [
    ['table', 'ini', 'whoosh'], ['sort', 'urutin', 'whoosh'], ['t0', 'kos', 'tick'], ['t1', 'makan', 'tick'], ['t2', 'cicilan', 'tick'], ['total', 'tiga', 'tick'],
    ['chart', 'terus', 'click'], ['payday', 'baru', null], ['three', 'tiga', 'tick'], ['slow', 'abis', null],
    ['tire', 'kayak', 'whoosh'], ['flat', 'kempes', 'thud'], ['dont', 'jadi', 'whoosh'], ['pick', 'pilih', 'click'], ['one', 'satu', null], ['only', 'satu', 'thud'],
  ],
};
const SFX_SOURCE: Record<string, string> = {
  tick: 'sine=f=1700:d=0.05,afade=t=out:st=0:d=0.05,volume=0.55',
  click: 'sine=f=950:d=0.035,afade=t=out:st=0:d=0.035,volume=0.8',
  whoosh: 'anoisesrc=d=0.38:c=pink:a=0.5,highpass=f=700,lowpass=f=5500,afade=t=in:d=0.14,afade=t=out:st=0.14:d=0.24',
  thud: 'sine=f=72:d=0.4,afade=t=out:st=0:d=0.4,volume=1.2',
};
const FPS = 30;
const TAIL_SECONDS = 1.2;   // ruang setelah kata terakhir, supaya klik penutup sempat terlihat

const [format, voice, wordsPath, outDir, music] = process.argv.slice(2);
if (!CUES[format] || !voice || !wordsPath || !outDir) {
  console.error('Pakai: tsx klik.ts <short|long> <suara.mp3> <kata.json> <outDir> [musik.m4a]');
  process.exit(2);
}
const words: {w: string; s: number; e: number}[] = JSON.parse(readFileSync(wordsPath, 'utf-8'));
const out = resolve(outDir);
mkdirSync(out, {recursive: true});

let cursor = 0;
const cues: Record<string, number> = {};
const sounds: [string, number][] = [];
for (const [name, word, sfx] of CUES[format]) {
  const index = words.findIndex((item, i) => i >= cursor && item.w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === word);
  if (index < 0) throw new Error(`Kata "${word}" untuk cue ${name} tidak ada di narasi`);
  cues[name] = words[index].s;
  cursor = index + 1;
  if (sfx) sounds.push([sfx, words[index].s]);
}

const duration = words[words.length - 1].e + TAIL_SECONDS;
const size = format === 'long' ? {x: 1920, y: 1080} : {x: 1080, y: 1920};
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => existsSync(p));

await renderVideo({
  projectFile: './src/klik/project.ts',
  variables: {job: {format, cues, words, duration}},
  settings: {
    outFile: `${format}_silent.mp4`,
    outDir: out,
    workers: 1,
    logProgress: false,
    puppeteer: CHROME ? {executablePath: CHROME} : {},
    projectSettings: {size, fps: FPS, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}} as any,
  },
});

/* Campur suara: narasi di depan, musik pelan dan mengecil saat ada suara, efek di titik cue */
const inputs = ['-i', join(out, `${format}_silent.mp4`), '-i', voice];
const graph: string[] = [music ? '[1:a]aresample=48000,asplit[voice][key]' : '[1:a]aresample=48000[voice]'];
const mix: string[] = [];
let next = 2;
if (music) {
  inputs.push('-stream_loop', '-1', '-i', music);
  graph.push(`[${next}:a]aresample=48000,volume=0.16,afade=t=out:st=${(duration - 1).toFixed(2)}:d=1,atrim=0:${duration.toFixed(2)}[bed]`);
  graph.push('[bed][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck]');
  mix.push('[duck]');
  next += 1;
}
sounds.forEach(([name, at], i) => {
  inputs.push('-f', 'lavfi', '-i', SFX_SOURCE[name]);
  graph.push(`[${next}:a]aresample=48000,adelay=${Math.round(at * 1000)}:all=1[s${i}]`);
  mix.push(`[s${i}]`);
  next += 1;
});
graph.push(`[voice]${mix.join('')}amix=inputs=${mix.length + 1}:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad[out]`);
execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph.join(';'), '-map', '0:v', '-map', '[out]',
  '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(FPS), // loudnorm menaikkan sample rate; pemutar dan aplikasi umumnya butuh 48 kHz stereo
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-t', duration.toFixed(2), '-movflags', '+faststart', join(out, `${format}.mp4`)], {stdio: 'inherit'});
console.log(JSON.stringify({file: join(out, `${format}.mp4`), duration, cues}));
