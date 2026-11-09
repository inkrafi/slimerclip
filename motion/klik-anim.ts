/**
 * Render short animasi penuh Klik Digital ID (tanpa video stok, tanpa watermark).
 * Pakai: tsx klik-anim.ts <format> <folder>
 * Folder berisi naskah.txt, suara.wav, kata.json. Hasil: video.mp4 di folder yang sama.
 * Standar audio sama dengan The Equator Ledger: musik 14 LU, efek aksen 6 LU, efek latar 12 LU di bawah suara, -14 LUFS, puncak -1.5 dBTP.
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

process.env.DISABLE_TELEMETRY = 'true';
const {renderVideo} = await import('@revideo/renderer');

/** [nama cue, kata pemicu, efek suara]. Kata dicari berurutan setelah cue sebelumnya. */
const CUES: Record<string, [string, string, string | null][]> = {
  qris: [
    ['qris', 'qris', 'lib_tx_scifi_click_1'], ['saldo', 'saldo', 'lib_tx_ui_click_1'], ['pas', 'pas', 'lib_correct'],
    ['tapi', 'tapi', 'lib_wh_short_1'], ['cuma', 'cuma', 'lib_tx_ui_click_2'], ['seribu', 'seribu', 'lib_tx_pop_1'], ['mana', 'mana', 'lib_boing'],
    ['itu', 'itu', 'lib_wh_short_2'], ['mdr', 'mdr', 'lib_impact'], ['biaya', 'biaya', 'lib_swipe'], ['besar', 'restoran', null], ['nol07', 'nol', 'lib_tx_pop_2'],
    ['duit', 'duit', 'lib_wh_short_3'], ['app', 'aplikasi', 'lib_tx_pop_1'], ['bank', 'bank', 'lib_tx_pop_2'], ['net', 'jaringan', 'lib_tx_pop_3'],
    ['lembaga', 'lembaga', 'lib_tx_pop_1'], ['bi', 'bank', 'lib_wh_classy'], ['nggak', 'nggak', 'lib_hit_2'],
    ['nah', 'nah', 'lib_wh_short_1'], ['satu', 'satu', 'lib_shutter'], ['berubah', 'berubah', 'lib_ding'],
    ['transaksi', 'transaksi', 'lib_wh_short_2'], ['seratus', 'seratus', 'lib_tx_ui_click_3'], ['nol1', 'nol', 'lib_tx_pop_2'], ['mikro', 'usaha', null],
    ['lima', 'lima', 'lib_tx_ui_click_1'],
    ['dan', 'dan', 'lib_wh_short_3'], ['jarang', 'jarang', 'lib_sparkle'], ['biaya2', 'biaya', 'lib_tx_pop_3'], ['boleh', 'nggak', 'lib_wrong'], ['pembeli', 'pembeli', null],
    ['jadi', 'jadi', 'lib_wh_short_1'], ['bilang', 'bilang', 'lib_bubble'], ['itu2', 'itu', 'lib_impact'], ['aturan', 'aturan', 'lib_tx_pop_1'],
    ['pernah', 'pernah', 'lib_wh_short_2'], ['cerita', 'cerita', 'lib_notif'],
  ],
};
CUES.leherhp = [
  ['lima', 'lima', 'lib_tx_pop_1'], ['semangka', 'semangka', 'lib_bubble'],
  ['tapi', 'tapi', 'lib_wh_water_drop'], ['nunduk', 'nunduk', null], ['leher', 'leher', 'lib_heartbeat'],
  ['menurut', 'menurut', 'lib_tx_pop_2'], ['dokter', 'dokter', null], ['enam', 'enam', null], ['dua', 'dua', 'lib_tx_ui_click_1'], ['anak', 'anak', 'lib_bubble'],
  ['nggak', 'nggak', 'lib_wh_water_drop'], ['pundak', 'pundak', null],
  ['yuk', 'yuk', 'lib_sparkle'], ['letakkan', 'letakkan', 'lib_wh_wind_1'], ['otot', 'otot', 'lib_tx_pop_1'], ['tekan', 'tekan', 'lib_pop'],
  ['memutar', 'memutar', null], ['tarik', 'tarik', 'lib_wind'], ['tiga', 'tiga', 'lib_ding'], ['ganti', 'ganti', 'lib_swipe'],
  ['ingat', 'ingat', 'lib_wh_water_drop'], ['tulang', 'tulang', 'lib_tx_pop_3'], ['depan', 'depan', 'lib_tx_pop_3'],
  ['setelah', 'setelah', null], ['angkat', 'angkat', 'lib_correct'],
  ['kalau', 'kalau', 'lib_wh_water_drop'], ['minggu', 'minggu', 'lib_tx_pop_1'], ['tangan', 'tangan', 'lib_tx_pop_2'], ['periksa', 'periksa', 'lib_ding'],
];
CUES.usapan = [
  ['saraf', 'saraf', 'lib_tx_pop_1'], ['usapan', 'usapan', 'lib_wh_wind_1'],
  ['namanya', 'namanya', 'lib_wh_water_drop'], ['ctaktil', 'ctaktil', 'lib_sparkle'], ['berbulu', 'berbulu', null], ['lengan', 'lengan', 'lib_tx_pop_2'], ['punggung', 'punggung', 'lib_tx_pop_3'],
  ['peneliti', 'peneliti', 'lib_wh_water_drop'], ['paling', 'paling', null], ['tiga', 'tiga', 'lib_ding'], ['selebar', 'selebar', 'lib_bubble'],
  ['cepat', 'cepat', 'lib_swipe'], ['lambat', 'lambat', 'lib_bubble'], ['kurang', 'kurang', null],
  ['saraf2', 'saraf', 'lib_wh_water_drop'], ['suhu', 'suhu', 'lib_tx_pop_1'], ['gosok', 'gosok', null],
  ['coba', 'coba', 'lib_wh_water_drop'], ['usap', 'usap', 'lib_tx_pop_2'], ['siku', 'siku', null], ['pergelangan', 'pergelangan', null],
  ['satu', 'satu', 'lib_tx_ui_click_1'], ['dua', 'dua', 'lib_tx_ui_click_1'], ['tiga2', 'tiga', 'lib_tx_ui_click_1'], ['empat', 'empat', 'lib_tx_ui_click_1'],
  ['lima', 'lima', 'lib_tx_ui_click_1'], ['enam', 'enam', 'lib_tx_ui_click_1'], ['tujuh', 'tujuh', 'lib_tx_ui_click_1'], ['delapan', 'delapan', 'lib_tx_ui_click_1'],
  ['kalau', 'kalau', 'lib_wh_water_drop'], ['kuncinya', 'kuncinya', 'lib_sparkle'], ['simpan', 'simpan', 'lib_ding'],
];
CUES.krek = [
  ['krek', 'krek', 'lib_tx_pop_3'], ['bukan', 'bukan', 'lib_bubble'],
  ['di', 'di', 'lib_wh_water_drop'], ['cairan', 'cairan', 'lib_tx_pop_1'], ['gas', 'gas', 'lib_bubble'],
  ['ditarik', 'ditarik', 'lib_wh_wind_1'], ['tekanannya', 'tekanannya', 'lib_tx_pop_2'], ['gelembung', 'gelembung', 'lib_pop'], ['krek2', 'krek', 'lib_tx_pop_3'],
  ['tahun', 'tahun', 'lib_wh_water_drop'], ['mri', 'mri', 'lib_tx_scifi_click_1'], ['terbentuk', 'terbentuk', 'lib_bubble'], ['berbunyi', 'berbunyi', 'lib_tx_pop_3'],
  ['makanya', 'makanya', 'lib_wh_water_drop'], ['langsung', 'langsung', 'lib_tick_tock'], ['larut', 'larut', 'lib_sparkle'],
  ['jadi', 'jadi', 'lib_wh_water_drop'], ['ngejar', 'ngejar', 'lib_tx_pop_1'],
  ['terus', 'terus', 'lib_wh_water_drop'], ['penelitian', 'penelitian', 'lib_ding'],
  ['tapi', 'tapi', 'lib_wh_water_drop'], ['nyeri', 'nyeri', 'lib_tx_pop_1'], ['bengkak', 'bengkak', 'lib_tx_pop_2'], ['periksa', 'periksa', 'lib_ding'],
];
CUES.pegal = [
  ['besoknya', 'besoknya', 'lib_wh_water_drop'],
  ['namanya', 'namanya', 'lib_wh_water_drop'], ['doms', 'doms', 'lib_sparkle'], ['sehari', 'sehari', null], ['paling', 'paling', null], ['kedua', 'kedua', 'lib_tx_pop_1'],
  ['banyak', 'banyak', 'lib_wh_water_drop'], ['bukan', 'bukan', 'lib_tx_pop_3'],
  ['penyebab', 'penyebab', 'lib_wh_water_drop'], ['robekan', 'robekan', 'lib_tx_pop_2'], ['memanjang', 'memanjang', 'lib_wh_wind_1'], ['turun', 'turun', 'lib_bubble'], ['menurunkan', 'menurunkan', 'lib_bubble'],
  ['tubuh', 'tubuh', 'lib_wh_water_drop'], ['nyeri2', 'nyeri', null],
  ['kabar', 'kabar', 'lib_wh_water_drop'], ['sebelas', 'sebelas', 'lib_tx_pop_1'], ['pijat', 'pijat', 'lib_ding'],
  ['coba', 'coba', 'lib_wh_water_drop'], ['usap', 'usap', 'lib_wh_wind_1'], ['remas', 'remas', 'lib_pop'], ['satu', 'satu', 'lib_tx_pop_2'],
  ['tapi', 'tapi', 'lib_wh_water_drop'], ['parah', 'parah', 'lib_tx_pop_1'], ['bengkak', 'bengkak', 'lib_tx_pop_2'], ['urine', 'urine', 'lib_tx_pop_3'], ['segera', 'segera', 'lib_ding'],
];
CUES.jangan = [
  ['ditunda', 'ditunda', 'lib_tx_pop_1'],
  ['pertama', 'pertama', 'lib_wh_water_drop'], ['demam', 'demam', null], ['infeksi', 'infeksi', 'lib_bubble'], ['istirahat', 'istirahat', 'lib_tx_pop_2'],
  ['kedua', 'kedua', 'lib_wh_water_drop'], ['ruam', 'ruam', 'lib_tx_pop_1'], ['kuman', 'kuman', 'lib_bubble'], ['makin', 'makin', 'lib_tick_tock'],
  ['ketiga', 'ketiga', 'lib_wh_water_drop'], ['keseleo', 'keseleo', 'lib_tx_pop_2'], ['jangan', 'jangan', 'lib_tx_pop_3'],
  ['keempat', 'keempat', 'lib_wh_water_drop'], ['betis', 'betis', null], ['bengkak2', 'bengkak', 'lib_tx_pop_1'], ['hangat', 'hangat', null], ['nyeri', 'nyeri', 'lib_tx_pop_2'],
  ['kemerahan', 'kemerahan', null], ['gumpalan', 'gumpalan', 'lib_heartbeat'], ['dipijat', 'dipijat', 'lib_tx_pop_3'], ['periksa', 'periksa', 'lib_ding'],
  ['kalau', 'kalau', 'lib_wh_water_drop'], ['ragu', 'ragu', 'lib_tx_pop_1'], ['simpan', 'simpan', 'lib_ding'],
];
CUES.ngantuk = [
  ['mata', 'mata', null], ['kenapa', 'kenapa', 'lib_bubble'],
  ['tubuh', 'tubuh', 'lib_wh_water_drop'], ['siaga', 'siaga', 'lib_tx_pop_1'], ['istirahat', 'istirahat', 'lib_tx_pop_2'], ['pindah', 'pindah', 'lib_swipe'],
  ['analisis', 'analisis', 'lib_wh_water_drop'], ['satu', 'satu', null], ['detak', 'detak', 'lib_tx_pop_1'], ['tekanan2', 'tekanan', 'lib_tx_pop_2'], ['rasa', 'rasa', 'lib_tx_pop_3'],
  ['bukan', 'bukan', 'lib_wh_water_drop'], ['tekanannya', 'tekanannya', 'lib_tx_pop_1'], ['penelitian2', 'penelitian', 'lib_bubble'], ['sedang', 'sedang', 'lib_ding'], ['ringan', 'ringan', null],
  ['jadi', 'jadi', 'lib_wh_water_drop'], ['tekan', 'tekan', 'lib_pop'],
  ['dan', 'dan', 'lib_wh_water_drop'], ['wajar', 'wajar', 'lib_sparkle'],
];
CUES.pajak = [
  ['tiap', 'tiap', 'lib_tx_pop_1'], ['desember', 'desember', 'lib_tx_pop_2'], ['delapan', 'delapan', 'lib_ka_ching'], ['kok', 'kok', 'lib_boing'],
  ['sejak', 'sejak', 'lib_wh_short_1'], ['januari', 'januari', 'lib_tx_ui_click_1'], ['ter', 'ter', 'lib_impact'], ['kali', 'kali', 'lib_tx_pop_1'],
  ['tapi', 'tapi', 'lib_wh_short_2'], ['setahun', 'setahun', 'lib_tx_ui_click_2'], ['progresif', 'progresif', 'lib_tx_pop_2'], ['biaya', 'biaya', 'lib_tx_ui_click_1'], ['ptkp', 'ptkp', 'lib_tx_ui_click_2'],
  ['hasilnya', 'hasilnya', 'lib_tx_ui_click_3'], ['sebelas', 'sebelas', 'lib_tx_ui_click_1'], ['sisanya', 'sisanya', 'lib_ka_ching'], ['desember3', 'desember', null],
  ['jadi', 'jadi', 'lib_impact'], ['totalnya', 'totalnya', 'lib_tx_pop_1'], ['numpuk', 'numpuk', 'lib_tx_pop_3'],
  ['kebalikannya', 'kebalikannya', 'lib_wh_short_3'], ['bonus', 'bonus', 'lib_sparkle'], ['kecil', 'kecil', 'lib_tx_pop_2'], ['dikembalikan', 'dikembalikan', 'lib_correct'],
  ['cek', 'cek', 'lib_wh_short_1'],
];
CUES.password = [
  ['besar', 'besar', 'lib_tx_pop_1'], ['kecil', 'kecil', 'lib_tx_pop_2'], ['angka', 'angka', 'lib_tx_pop_3'], ['simbol', 'simbol', 'lib_tx_pop_1'],
  ['hive', 'hive', 'lib_tx_ui_click_1'], ['seratus', 'seratus', 'lib_impact'], ['aman', 'aman', 'lib_correct'],
  ['masalahnya', 'masalahnya', 'lib_boing'], ['acak', 'acak', 'lib_tx_pop_2'], ['bocor', 'bocor', 'lib_glitch'],
  ['password2', 'password', 'lib_wh_short_1'], ['nama', 'nama', 'lib_tx_ui_click_1'], ['tanggal', 'tanggal', 'lib_tx_ui_click_2'], ['diganti', 'diganti', 'lib_tx_ui_click_3'],
  ['dicoba', 'dicoba', 'lib_typing'], ['detik', 'detik', 'lib_wrong'],
  ['sama', 'sama', 'lib_wh_short_2'], ['bocor2', 'bocor', 'lib_impact'], ['kebuka', 'kebuka', 'lib_tx_pop_3'],
  ['makanya', 'makanya', 'lib_wh_short_3'], ['nist', 'nist', 'lib_tx_pop_1'], ['panjang', 'panjang', 'lib_swipe'], ['minimal', 'minimal', 'lib_impact'],
  ['gabungin', 'gabungin', 'lib_wh_short_1'], ['bedain', 'bedain', 'lib_tx_pop_1'], ['simpan', 'simpan', 'lib_tx_pop_2'], ['verifikasi', 'verifikasi', 'lib_correct'],
];
const TAILS: Record<string, number> = {pajak: 2.2};
const MUSIC: Record<string, string> = {qris: 'bgm_santai.m4a', leherhp: 'bgm_santai.m4a', usapan: 'bgm_santai.m4a', krek: 'bgm_santai.m4a', pegal: 'bgm_santai.m4a', jangan: 'bgm_santai.m4a', ngantuk: 'bgm_santai.m4a', pajak: 'bgm_santai.m4a', password: 'bgm_santai.m4a'};
const PROJECT: Record<string, string> = {qris: './src/klik/project.ts', leherhp: './src/pijat/project.ts', usapan: './src/pijat/project.ts', krek: './src/pijat/project.ts', pegal: './src/pijat/project.ts', jangan: './src/pijat/project.ts', ngantuk: './src/pijat/project.ts', pajak: './src/klik/project.ts', password: './src/klik/project.ts'};
const FPS = 30;
const TAIL = 1.4;
const SFX_DIR = resolve('../backend/sfx');
const MUSIC_DIR = resolve('../backend/music');
const MUSIC_BELOW_VOICE = 14;
const ACCENT_BELOW_VOICE = 6;
const AMBIENT_BELOW_VOICE = 12;
const ACCENT_MAX_SECONDS = 0.9;
/** Aksen: transisi dan penekanan. Selain ini termasuk efek latar. */
const ACCENTS = new Set(['lib_wh_water_drop', 'lib_wh_wind_1', 'lib_wh_short_1', 'lib_wh_short_2', 'lib_wh_short_3', 'lib_wh_classy', 'lib_impact', 'lib_hit_2', 'lib_wrong', 'lib_correct', 'lib_shutter']);

const [format, folderArg, ...flags] = process.argv.slice(2);
if (!CUES[format] || !folderArg) {
  console.error('Pakai: tsx klik-anim.ts <format> <folder> [--audio-only]');
  process.exit(2);
}
const folder = resolve(folderArg);
const out = join(folder, 'render');
mkdirSync(out, {recursive: true});
const voice = join(folder, 'suara.wav');
const raw: {w: string; s: number; e: number}[] = JSON.parse(readFileSync(join(folder, 'kata.json'), 'utf-8'));
const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/* Subtitle: tanda baca menutup halaman, lalu dibuang dari teks yang tampil */
const tokens = readFileSync(join(folder, 'naskah.txt'), 'utf-8').split(/\s+/).filter(Boolean);
if (tokens.length !== raw.length) throw new Error(`Jumlah kata naskah (${tokens.length}) beda dengan kata.json (${raw.length})`);
const words = raw.map((item, i) => ({w: tokens[i].replace(/[.,!?:;"]+$/g, '').replace(/^"/, ''), s: item.s, e: item.e, p: /[.,!?:;]$/.test(tokens[i])}));

let cursor = 0;
const cues: Record<string, number> = {};
const sounds: [string, number][] = [];
for (const [name, word, sfx] of CUES[format]) {
  const index = raw.findIndex((item, i) => i >= cursor && clean(item.w) === word);
  if (index < 0) throw new Error(`Kata "${word}" untuk cue ${name} tidak ada di narasi`);
  cues[name] = raw[index].s;
  cursor = index + 1;
  if (sfx) sounds.push([sfx, Math.max(0, raw[index].s - (ACCENTS.has(sfx) && sfx.startsWith('lib_wh') ? 0.3 : 0.05))]);
}
const duration = raw[raw.length - 1].e + (TAILS[format] ?? TAIL);
const silent = join(out, 'gambar.mp4');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => existsSync(p));

if (flags.includes('--thumb')) {
  /* Thumbnail dirender dari adegan khusus, lalu frame pertamanya disimpan sebagai PNG */
  await renderVideo({
    projectFile: PROJECT[format],
    variables: {job: {format, thumb: true, duration: 0.2}},
    settings: {
      outFile: 'thumb.mp4', outDir: out, workers: 1, logProgress: false,
      puppeteer: CHROME ? {executablePath: CHROME} : {},
      projectSettings: {size: {x: 1080, y: 1920}, fps: FPS, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}} as any,
    },
  });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(out, 'thumb.mp4'), '-frames:v', '1', join(folder, 'thumbnail.png')]);
  console.log(JSON.stringify({thumbnail: join(folder, 'thumbnail.png')}));
  process.exit(0);
}
if (!flags.includes('--audio-only')) {
  const started = Date.now();
  await renderVideo({
    projectFile: PROJECT[format],
    variables: {job: {format, cues, words, duration}},
    settings: {
      outFile: 'gambar.mp4', outDir: out, workers: 1, logProgress: false,
      puppeteer: CHROME ? {executablePath: CHROME} : {},
      projectSettings: {size: {x: 1080, y: 1920}, fps: FPS, exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}} as any,
    },
  });
  console.log(`Gambar selesai: ${duration.toFixed(1)} dtk video, ${Math.round((Date.now() - started) / 1000)} dtk render`);
}

/* ---------- Audio ---------- */
const soundLevel = (name: string) => {
  const report = spawnSync('ffmpeg', ['-hide_banner', '-i', join(SFX_DIR, `${name}.wav`), '-af', 'astats=length=0.1:metadata=0', '-f', 'null', '-'], {encoding: 'utf-8', maxBuffer: 1 << 26}).stderr;
  return Number([...report.matchAll(/RMS peak dB:\s*(-?[\d.]+)/g)].pop()?.[1] ?? -20);
};
const loudness = (path: string) => {
  const report = spawnSync('ffmpeg', ['-hide_banner', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], {encoding: 'utf-8', maxBuffer: 1 << 26}).stderr;
  return Number([...report.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1]);
};

function graphFor(musicTrim: number, voiceLevel: number) {
  const inputs = ['-i', silent, '-i', voice, '-stream_loop', '-1', '-i', join(MUSIC_DIR, MUSIC[format])];
  const VOICE_CHAIN = 'highpass=f=80,equalizer=f=280:t=q:w=1.1:g=-3,equalizer=f=3000:t=q:w=1.3:g=3,equalizer=f=7500:t=q:w=1:g=1.5,deesser=i=0.4:m=0.5:f=0.5,'
    + 'acompressor=threshold=-24dB:ratio=3:attack=6:release=110:makeup=4dB,alimiter=limit=0.89:level=false';
  const graph = [
    `[1:a]aresample=48000,${VOICE_CHAIN},aformat=channel_layouts=stereo,asplit=4[voice][key][keyAccent][keyAmbient]`,
    `[2:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${duration.toFixed(2)},afade=t=in:d=0.8,afade=t=out:st=${(duration - 1.5).toFixed(2)}:d=1.5,equalizer=f=2500:t=q:w=1.2:g=-4,volume=${musicTrim.toFixed(1)}dB[bed]`,
    '[bed][key]sidechaincompress=threshold=0.03:ratio=4:attack=30:release=600[duck]',
  ];
  let next = 3;
  const byName = new Map<string, number[]>();
  sounds.forEach(([name, at]) => byName.set(name, [...(byName.get(name) ?? []), at]));
  const accent: string[] = [];
  const ambient: string[] = [];
  for (const [name, times] of byName) {
    inputs.push('-i', join(SFX_DIR, `${name}.wav`));
    const isAccent = ACCENTS.has(name);
    const gain = voiceLevel - (isAccent ? ACCENT_BELOW_VOICE : AMBIENT_BELOW_VOICE) - soundLevel(name);
    const shape = isAccent ? `atrim=0:${ACCENT_MAX_SECONDS},afade=t=out:st=${ACCENT_MAX_SECONDS - 0.25}:d=0.25,` : 'atrim=0:1.6,afade=t=out:st=1.2:d=0.4,';
    const parts = times.map((_, i) => `[f${next}_${i}]`).join('');
    graph.push(`[${next}:a]aresample=48000,aformat=channel_layouts=stereo,${shape}volume=${gain.toFixed(1)}dB,asplit=${times.length}${parts}`);
    times.forEach((at, i) => {
      graph.push(`[f${next}_${i}]adelay=${Math.round(at * 1000)}:all=1[g${next}_${i}]`);
      (isAccent ? accent : ambient).push(`[g${next}_${i}]`);
    });
    next += 1;
  }
  const bus = (parts: string[], name: string) => (parts.length ? `${parts.join('')}amix=inputs=${parts.length}:duration=longest:normalize=0[${name}]` : `anullsrc=r=48000:cl=stereo,atrim=0:1[${name}]`);
  graph.push(bus(accent, 'accent'), bus(ambient, 'ambient'));
  graph.push('[accent][keyAccent]sidechaincompress=threshold=0.1:ratio=2:attack=8:release=200[accentd]');
  graph.push('[ambient][keyAmbient]sidechaincompress=threshold=0.015:ratio=10:attack=4:release=260[ambientd]');
  return {inputs, graph};
}

const script = join(out, 'audio.txt');
/* Lintasan 1: ukur suara dan musik, lalu atur musik tepat 14 LU di bawah suara */
let trim = -12;
let voiceLevel = -23;
for (let pass = 0; pass < 2; pass++) {
  const {inputs, graph} = graphFor(trim, voiceLevel);
  writeFileSync(script, graph.join(';\n'));
  const stem = (name: string) => join(out, `stem-${name}.wav`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex_script', script,
    '-map', '[voice]', '-t', duration.toFixed(2), stem('voice'), '-map', '[duck]', '-t', duration.toFixed(2), stem('music'),
    '-map', '[accentd]', '-t', duration.toFixed(2), stem('accent'), '-map', '[ambientd]', '-t', duration.toFixed(2), stem('ambient')], {stdio: 'inherit'});
  const [v, m] = [loudness(stem('voice')), loudness(stem('music'))];
  ['voice', 'music', 'accent', 'ambient'].forEach(name => rmSync(stem(name)));
  const nextTrim = trim + (v - MUSIC_BELOW_VOICE - m);
  console.log(`Standar audio: suara ${v} LUFS, musik ${(v - m).toFixed(1)} LU di bawah (trim ${trim.toFixed(1)} ke ${nextTrim.toFixed(1)})`);
  trim = nextTrim;
  voiceLevel = v;
}
/* Lintasan 2: loudnorm dua tahap, limiter akhir, AAC 256k */
const {inputs, graph} = graphFor(trim, voiceLevel);
const mixed = '[voice]apad[padded];[padded][duck][accentd][ambientd]amix=inputs=4:duration=first:normalize=0';
const TARGET = 'I=-13.8:TP=-1.5:LRA=11';
writeFileSync(script, [...graph, `${mixed},loudnorm=${TARGET}:print_format=json[out]`].join(';\n'));
const measured = spawnSync('ffmpeg', ['-hide_banner', ...inputs, '-filter_complex_script', script, '-map', '[out]', '-t', duration.toFixed(2), '-f', 'null', '-'], {encoding: 'utf-8', maxBuffer: 1 << 26});
const open = measured.stderr.lastIndexOf('{');
const stats = JSON.parse(measured.stderr.slice(open, measured.stderr.lastIndexOf('}') + 1));
const linear = `measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
writeFileSync(script, [...graph, `${mixed},loudnorm=${TARGET}:${linear},aresample=48000,alimiter=limit=0.76:attack=1:release=60:level=false,aformat=sample_fmts=fltp:channel_layouts=stereo[out]`].join(';\n'));
const target = join(folder, 'video.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex_script', script, '-map', '0:v', '-map', '[out]',
  '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', duration.toFixed(2), '-movflags', '+faststart', target], {stdio: 'inherit'});
console.log(`Hasil akhir ${loudness(target)} LUFS`);
console.log(JSON.stringify({file: target, duration, cues}));
