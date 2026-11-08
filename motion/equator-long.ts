/**
 * Render video panjang The Equator Ledger per bab, lalu gabungkan.
 * Pakai: tsx equator-long.ts <folder proyek> <render 0,1,2|all|none> [--sample N] [--final]
 * Folder proyek berisi naskah.md, kata.json, suara/bab<N>.wav.
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {CHAPTERS} from './src/equator/nikel-board';

process.env.DISABLE_TELEMETRY = 'true';
const {renderVideo} = await import('@revideo/renderer');

const [folderArg, which = 'all', ...flags] = process.argv.slice(2);
const folder = resolve(folderArg);
const finalize = flags.includes('--final');
const STING_GAP = 3;
const CHAPTER_GAP = 2;
const TAIL = 1;

const clean = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const script = readFileSync(join(folder, 'naskah.md'), 'utf-8').replace(/\r\n/g, '\n');
const blocks = [...script.matchAll(/### Narasi\n\n([\s\S]*?)\n\n---/g)].map(m => m[1]);
const times: {w: string; s: number; e: number}[] = JSON.parse(readFileSync(join(folder, 'kata.json'), 'utf-8'));
const wavSeconds = (path: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], {encoding: 'utf-8'}).trim());
if (blocks.length !== CHAPTERS.length) throw new Error(`Naskah ${blocks.length} bab, storyboard ${CHAPTERS.length} bab`);

/* Waktu tiap bab di audio utuh */
let cursor = 0;
let wordIndex = 0;
const segments = blocks.map((text, i) => {
  const count = text.split(/\s+/).filter(Boolean).length;
  const seconds = wavSeconds(join(folder, 'suara', `bab${i}.wav`));
  const audioStart = cursor;
  const words = times.slice(wordIndex, wordIndex + count);
  wordIndex += count;
  const gap = i === 0 ? STING_GAP : i < blocks.length - 1 ? CHAPTER_GAP : 0;
  cursor += seconds + gap;
  return {i, audioStart, seconds, gap, words};
});
if (wordIndex !== times.length) throw new Error(`kata.json ${times.length} kata, naskah ${wordIndex} kata`);

function findCue(words: {w: string}[], phrase: string, from: number, where: string): number {
  const target = phrase.split(/\s+/).map(clean);
  for (let i = from; i <= words.length - target.length; i++) {
    if (target.every((w, j) => clean(words[i + j].w) === w)) return i;
  }
  throw new Error(`Frasa "${phrase}" tidak ditemukan di ${where}`);
}

/** Frasa menjadi detik. Isi adegan mencari setelah awal adegannya, adegan berikutnya setelah adegan sebelumnya. */
function resolveBeats(seg: typeof segments[number], offset: number) {
  let next = 0;
  const where = `bab ${seg.i}`;
  return CHAPTERS[seg.i].beats.map(beat => {
    const start = findCue(seg.words, beat.at, next, where);
    next = start + 1;
    const walk = (value: any): any => {
      if (Array.isArray(value)) return value.map(walk);
      if (value && typeof value === 'object') {
        const copy: any = {};
        for (const [k, v] of Object.entries(value)) copy[k] = walk(v);
        if (typeof value.at === 'string') copy.t = seg.words[findCue(seg.words, value.at, start, where)].s - offset;
        return copy;
      }
      return value;
    };
    return {...walk(beat), t: seg.words[start].s - offset};
  });
}

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => existsSync(p));
const out = join(folder, 'render');
mkdirSync(out, {recursive: true});
/* Segmen: bab 0 berakhir setelah sting, bab 2+ mulai dengan chapter card di jeda sebelumnya */
const plan = segments.map(seg => {
  const card = seg.i >= 2;
  const start = card ? seg.audioStart - CHAPTER_GAP : seg.audioStart;
  const end = seg.i === 0 ? seg.audioStart + seg.seconds + STING_GAP
    : seg.i === segments.length - 1 ? seg.audioStart + seg.seconds + TAIL
      : seg.audioStart + seg.seconds;
  return {seg, start, end, card};
});

/* Kamera awal tiap bab mengikuti peta terakhir dari bab sebelumnya */
let camera: any = {lon: 112, lat: 12, zoom: 3.45, dim: 0.35};
const cameras = plan.map(({seg}) => {
  const first = {...camera};
  for (const beat of CHAPTERS[seg.i].beats) {
    if (beat.map?.zoom !== undefined) camera = {...camera, lon: beat.map.lon, lat: beat.map.lat, zoom: beat.map.zoom};
    if (beat.map?.dim !== undefined) camera = {...camera, dim: beat.map.dim};
  }
  return first;
});

plan.forEach(({seg, start}) => resolveBeats(seg, start));   // frasa yang salah harus gagal sebelum render dimulai
if (process.env.EQUATOR_DUMP) {
  const seg = plan[Number(process.env.EQUATOR_DUMP)];
  console.log(JSON.stringify(resolveBeats(seg.seg, seg.start).filter((b: any) => b.show?.kind === 'ledger'), null, 1));
  process.exit(0);
}
const requested = which === 'all' ? plan.map(p => p.seg.i) : which === 'none' ? [] : which.split(',').map(Number);
for (const {seg, start, end, card} of plan) {
  if (!requested.includes(seg.i)) continue;
  const beats = resolveBeats(seg, start);
  const duration = end - start;
  const job: any = {duration, beats, camera: cameras[seg.i], seed: seg.i * 3};
  if (card) Object.assign(job, {card: CHAPTERS[seg.i].card, number: CHAPTERS[seg.i].number, cardSeconds: CHAPTER_GAP});
  if (seg.i === 0) job.sting = seg.seconds + 0.05;
  const started = Date.now();
  await renderVideo({
    projectFile: './src/equator/long-project.ts',
    variables: {job},
    settings: {
      outFile: `seg${seg.i}.mp4`, outDir: out, workers: 1, logProgress: false,
      puppeteer: CHROME ? {executablePath: CHROME} : {},
      projectSettings: {size: {x: 1920, y: 1080}, fps: 30, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}} as any,
    },
  });
  for (const name of readdirSync(out)) {
    if (new RegExp(`^seg${seg.i}-`).test(name)) rmSync(join(out, name));
  }
  console.log(`Bab ${seg.i} selesai: ${duration.toFixed(1)} dtk video, ${Math.round((Date.now() - started) / 1000)} dtk render`);
}

/* ---------- Audio ----------
 * Standar audio channel (lihat The Equator Ledger Guide.md):
 * musik 14 LU di bawah suara, efek aksen 6 LU di bawah suara, efek latar 12 LU di bawah suara, hasil akhir -14 LUFS, puncak -1.5 dBTP.
 */
const MUSIC_BELOW_VOICE = 14;
const ACCENT_BELOW_VOICE = 6;
const AMBIENT_BELOW_VOICE = 12;
const ACCENT_MAX_SECONDS = 0.9;
/** Efek aksen membuat video terasa hidup: transisi dan penekanan. Selain daftar ini termasuk efek latar. */
const ACCENTS = new Set(['lib_wh_short_1', 'lib_wh_short_2', 'lib_wh_short_3', 'lib_wh_classy', 'lib_wh_synthetic', 'lib_wh_deep_1',
  'lib_impact', 'lib_hit_2', 'lib_boom', 'lib_gong', 'lib_dun_dun', 'lib_riser', 'lib_zoom_in', 'lib_slide_down']);
/** Kekerasan bagian terkeras satu efek. Efek pendek tidak cocok diukur LUFS, jadi dipakai RMS jendela pendek. */
const soundLevels = new Map<string, number>();
function soundLevel(name: string) {
  if (!soundLevels.has(name)) {
    const report = spawnSync('ffmpeg', ['-hide_banner', '-i', join(SFX_DIR, `${name}.wav`), '-af', 'astats=length=0.1:metadata=0', '-f', 'null', '-'], {encoding: 'utf-8', maxBuffer: 1 << 26}).stderr;
    const peak = [...report.matchAll(/RMS peak dB:\s*(-?[\d.]+)/g)].pop()?.[1];
    soundLevels.set(name, Number(peak ?? -20));
  }
  return soundLevels.get(name) as number;
}
const loudness = (path: string) => {
  const report = spawnSync('ffmpeg', ['-hide_banner', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], {encoding: 'utf-8', maxBuffer: 1 << 26}).stderr;
  return Number([...report.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1]);
};
const SFX_DIR = resolve('../backend/sfx');
/** Musik per suasana: [berkas, gain]. Gain mengikuti rentang tengah 250 Hz-4 kHz, karena hanya itu yang terdengar di speaker HP dan laptop. */
const TRACKS: Record<string, [string, number]> = {
  tegang: ['i-can-feel-it-coming.mp3', -11.4],
  bangun: ['rising-tide.mp3', -5.9],
  misteri: ['half-mystery.mp3', -2.7],
  resolve: ['ossuary-7---resolve.mp3', -7.6],
  muram: ['lightless-dawn.mp3', 2.0],
  penutup: ['immersed.mp3', -5.1],
};
const MOOD = ['tegang', 'tegang', 'bangun', 'misteri', 'misteri', 'muram', 'resolve', 'penutup'];
const TRANSITION = ['lib_wh_short_1', 'lib_wh_classy', 'lib_wh_short_2', 'lib_wh_synthetic', 'lib_wh_short_3'];

function soundList(): [string, number][] {
  const sounds: [string, number][] = [];
  let n = 0;
  const walk = (value: any, base: number) => {
    if (Array.isArray(value)) value.forEach(item => walk(item, base));
    else if (value && typeof value === 'object') {
      if (typeof value.sfx === 'string' && typeof value.t === 'number') sounds.push([value.sfx, value.t + base]);
      Object.values(value).forEach(item => walk(item, base));
    }
  };
  for (const {seg, start} of plan) {
    for (const beat of resolveBeats(seg, start)) {
      const at = beat.t + start;
      const kind = beat.show?.kind;
      if (beat.trans !== 'cut') sounds.push([TRANSITION[n++ % TRANSITION.length], at - 0.28]);
      if (kind === 'doc') sounds.push(['lib_typing', at + 0.1]);
      if (kind === 'stat') sounds.push(['lib_tx_ui_click_1', at]);
      if (kind === 'bars' || kind === 'ring') sounds.push(['lib_tx_pop_1', at + 0.1]);
      if (kind === 'chart') sounds.push(['lib_tick_tock', at]);
      if (kind === 'verdict') sounds.push(['lib_tx_pop_2', at]);
      if (kind === 'quote') sounds.push(['lib_shutter', at]);
      for (const name of beat.sfx ?? []) sounds.push([name, at + 0.05]);
      walk(beat.show, start);
    }
    if (seg.i >= 2) sounds.push(['lib_wh_deep_1', seg.audioStart - CHAPTER_GAP], ['lib_boom', seg.audioStart - CHAPTER_GAP + 0.3]);
  }
  sounds.push(['lib_wh_classy', segments[0].seconds], ['lib_gong', segments[0].seconds + 0.9]);
  return sounds;
}

/** Campur narasi, musik, dan efek untuk potongan [start, start + seconds] */
function mixAudio(video: string, start: number, seconds: number, target: string, musicTrim = -10, voiceLevel = -23, checked = false) {
  const inputs = ['-i', video, '-ss', start.toFixed(3), '-t', seconds.toFixed(3), '-i', join(folder, 'narasi-rafi.m4a')];
  let next = 2;
  /* Suara: buang dengung, kurangi bunyi kotak, tambah kejelasan, redam desis, lalu ratakan volume */
  const VOICE_CHAIN = 'highpass=f=80,equalizer=f=280:t=q:w=1.1:g=-3,equalizer=f=3000:t=q:w=1.3:g=3,equalizer=f=7500:t=q:w=1:g=1.5,deesser=i=0.4:m=0.5:f=0.5,'
    + 'acompressor=threshold=-24dB:ratio=3:attack=6:release=110:makeup=4dB,alimiter=limit=0.89:level=false';
  const graph: string[] = [`[1:a]aresample=48000,${VOICE_CHAIN},aformat=channel_layouts=stereo,asplit=4[voice][key][keyAccent][keyAmbient]`];
  /* Musik: tiap bab memakai lagu suasananya, disambung dengan fade */
  const beds: string[] = [];
  const offsets: Record<string, number> = {};
  const groups: {mood: string; from: number; to: number}[] = [];
  plan.forEach(p => {
    const last = groups[groups.length - 1];
    if (last && last.mood === MOOD[p.seg.i]) last.to = p.end;
    else groups.push({mood: MOOD[p.seg.i], from: p.start, to: p.end});
  });
  groups[groups.length - 1].to += 20;
  for (const group of groups) {
    const from = Math.max(group.from, start);
    const to = Math.min(group.to, start + seconds);
    if (to <= from) continue;
    const [file, gain] = TRACKS[group.mood];
    const offset = (offsets[group.mood] ?? 0) + (from - group.from);
    offsets[group.mood] = (offsets[group.mood] ?? 0) + (group.to - group.from);
    const length = to - from;
    inputs.push('-stream_loop', '-1', '-ss', offset.toFixed(2), '-i', resolve('public/equator/music', file));
    graph.push(`[${next}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${gain}dB,atrim=0:${length.toFixed(2)},afade=t=in:d=1.2,afade=t=out:st=${Math.max(0, length - 1.6).toFixed(2)}:d=1.6,adelay=${Math.round((from - start) * 1000)}:all=1[m${next}]`);
    beds.push(`[m${next}]`);
    next += 1;
  }
  graph.push(`${beds.join('')}amix=inputs=${beds.length}:duration=longest:normalize=0,equalizer=f=2500:t=q:w=1.2:g=-4,volume=${musicTrim.toFixed(1)}dB[bed]`);
  graph.push('[bed][key]sidechaincompress=threshold=0.03:ratio=4:attack=30:release=700[duck]');
  /* Efek: satu input per berkas, lalu dipecah sesuai jumlah pemakaian */
  const sounds = soundList().filter(([, at]) => at >= start && at < start + seconds);
  const byName = new Map<string, number[]>();
  sounds.forEach(([name, at]) => byName.set(name, [...(byName.get(name) ?? []), at - start]));
  const accentParts: string[] = [];
  const ambientParts: string[] = [];
  for (const [name, times] of byName) {
    inputs.push('-i', join(SFX_DIR, `${name}.wav`));
    const accent = ACCENTS.has(name);
    const gain = voiceLevel - (accent ? ACCENT_BELOW_VOICE : AMBIENT_BELOW_VOICE) - soundLevel(name);
    const shape = accent ? `atrim=0:${ACCENT_MAX_SECONDS},afade=t=out:st=${ACCENT_MAX_SECONDS - 0.25}:d=0.25,` : '';
    const parts = times.map((_, i) => `[f${next}_${i}]`).join('');
    graph.push(`[${next}:a]aresample=48000,aformat=channel_layouts=stereo,${shape}volume=${gain.toFixed(1)}dB,asplit=${times.length}${parts}`);
    times.forEach((at, i) => {
      graph.push(`[f${next}_${i}]adelay=${Math.max(0, Math.round(at * 1000))}:all=1[g${next}_${i}]`);
      (accent ? accentParts : ambientParts).push(`[g${next}_${i}]`);
    });
    next += 1;
  }
  /* Aksen hanya sedikit mengalah pada kata, efek latar turun tajam */
  const bus = (parts: string[], label: string) => (parts.length ? `${parts.join('')}amix=inputs=${parts.length}:duration=longest:normalize=0[${label}]` : `anullsrc=r=48000:cl=stereo,atrim=0:${seconds.toFixed(2)}[${label}]`);
  graph.push(bus(accentParts, 'accent'), bus(ambientParts, 'ambient'));
  graph.push('[accent][keyAccent]sidechaincompress=threshold=0.1:ratio=2:attack=8:release=200[accentd]');
  graph.push('[ambient][keyAmbient]sidechaincompress=threshold=0.015:ratio=10:attack=4:release=260[ambientd]');
  const mixed = '[voice]apad[padded];[padded][duck][accentd][ambientd]amix=inputs=4:duration=first:normalize=0';
  const TARGET = 'I=-13.8:TP=-1.5:LRA=11';   // limiter akhir menurunkan sekitar 0,2 LU, jadi hasilnya -14 LUFS
  const script = join(out, 'audio.txt');
  /* Ukur tiap lapisan, lalu sesuaikan sampai memenuhi standar sebelum hasil akhir dibuat */
  if (!checked) {
    writeFileSync(script, graph.join(';\n'));
    const stem = (name: string) => join(out, `stem-${name}.wav`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex_script', script,
      '-map', '[voice]', '-t', seconds.toFixed(2), stem('voice'),
      '-map', '[duck]', '-t', seconds.toFixed(2), stem('music'),
      '-map', '[accentd]', '-t', seconds.toFixed(2), join(out, 'stem-accent.wav'),
      '-map', '[ambientd]', '-t', seconds.toFixed(2), join(out, 'stem-ambient.wav')], {stdio: 'inherit'});
    const [voiceI, musicI] = [loudness(stem('voice')), loudness(stem('music'))];
    ['voice', 'music', 'accent', 'ambient'].forEach(name => rmSync(stem(name)));
    const nextMusic = musicTrim + (voiceI - MUSIC_BELOW_VOICE - musicI);
    console.log(`Standar audio: suara ${voiceI} LUFS, musik ${(voiceI - musicI).toFixed(1)} LU di bawah (trim ${musicTrim.toFixed(1)} ke ${nextMusic.toFixed(1)}), efek aksen ${ACCENT_BELOW_VOICE} LU, efek latar ${AMBIENT_BELOW_VOICE} LU`);
    mixAudio(video, start, seconds, target, nextMusic, voiceI, true);
    return;
  }
  writeFileSync(script, [...graph, `${mixed},loudnorm=${TARGET}:print_format=json[out]`].join(';\n'));
  const measured = spawnSync('ffmpeg', ['-hide_banner', ...inputs, '-filter_complex_script', script, '-map', '[out]', '-t', seconds.toFixed(2), '-f', 'null', '-'], {encoding: 'utf-8', maxBuffer: 1 << 26});
  const open = measured.stderr.lastIndexOf('{');
  if (open < 0) throw new Error(`Audio gagal diukur: ${measured.stderr.slice(-800)}`);
  const stats = JSON.parse(measured.stderr.slice(open, measured.stderr.lastIndexOf('}') + 1));
  const linear = `measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
  writeFileSync(script, [...graph, `${mixed},loudnorm=${TARGET}:${linear},aresample=48000,alimiter=limit=0.76:attack=1:release=60:level=false,aformat=sample_fmts=fltp:channel_layouts=stereo[out]`].join(';\n'));
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex_script', script, '-map', '0:v', '-map', '[out]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', seconds.toFixed(2), '-movflags', '+faststart', target], {stdio: 'inherit'});
  console.log(`Hasil akhir ${loudness(target)} LUFS, trim musik ${musicTrim.toFixed(1)} dB`);
}

/* Contoh satu bab lengkap dengan audio, untuk dinilai sebelum render semua */
const sampleFlag = flags.indexOf('--sample');
if (sampleFlag >= 0) {
  const seg = plan[Number(flags[sampleFlag + 1])];
  const target = join(folder, `contoh-bab${seg.seg.i}.mp4`);
  mixAudio(join(out, `seg${seg.seg.i}.mp4`), seg.start, seg.end - seg.start, target);
  console.log(JSON.stringify({sample: target}));
}

if (finalize) {
  const missing = plan.filter(p => !existsSync(join(out, `seg${p.seg.i}.mp4`)));
  if (missing.length) throw new Error(`Bab belum dirender: ${missing.map(m => m.seg.i).join(', ')}`);
  /* Gabungkan gambar, ditambah end screen */
  const endScreen = resolve('output/equator/channel-kit/03-video/end-screen-20s.mp4');
  const listFile = join(out, 'list.txt');
  const parts = [...plan.map(p => join(out, `seg${p.seg.i}.mp4`)), endScreen];
  writeFileSync(listFile, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const joined = join(out, 'gabung.mp4');
  const inputs = parts.flatMap(p => ['-i', p]);
  const graph = parts.map((_, n) => `[${n}:v]fps=30,format=yuv420p,setsar=1[v${n}]`).join(';') + ';' + parts.map((_, n) => `[v${n}]`).join('') + `concat=n=${parts.length}:v=1:a=0[v]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', joined], {stdio: 'inherit'});
  const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', joined], {encoding: 'utf-8'}).trim());

  mixAudio(joined, 0, total, join(folder, 'video.mp4'));

  /* Chapter untuk deskripsi YouTube */
  const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const titles = ['Cold open', ...CHAPTERS.slice(1).map(c => c.card as string)];
  const lines = plan.map((p, n) => `${clock(n === 0 ? 0 : p.start)} ${titles[n]}`);
  writeFileSync(join(folder, 'chapters.txt'), lines.join('\n') + '\n');
  console.log(JSON.stringify({file: join(folder, 'video.mp4'), total, size: statSync(join(folder, 'video.mp4')).size, chapters: lines}));
}
