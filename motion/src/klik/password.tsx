/**
 * Short animasi Klik Digital ID: password 8 karakter "132 tahun" itu cuma kalau acak. Password manusia gampang ditebak.
 * Sumber angka: Hive Systems Password Table 2026 (bcrypt, 16x RTX 5090). Pedoman panjang: NIST SP 800-63B-4 (2025).
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeOutCubic, linear, spawn, ThreadGenerator, tween, waitFor} from '@revideo/core';
import {backdrop, card, chip as baseChip, enterUp, exit, label, pop, stamp} from './qris';
import {captions, DARK_INK, DARK_MUTED, DEEP_GREEN, DEEP_RED, MONO, PAPER_CARD, SANS, until, Word} from './system';

const GOLD = '#E8A33A';
const NAVY = '#22324F';
const BLUE = '#3B6FD6';
const SOFT = '#E4DCC8';
const WHITE = '#FFFFFF';
const TERMINAL = '#14201A';

const chip = (text: string, fill: string, size?: number, ink?: string) => {
  const node = baseChip(text, fill, size, ink);
  node.scale(0);
  node.opacity(0);
  return node;
};

/* ---------- Ilustrasi ---------- */

function field(text: string, width = 760) {
  const root = new Node({});
  root.add(<Txt x={-width / 2} y={-110} offset={[-1, 0]} text="Password" fontFamily={SANS} fontWeight={700} fontSize={44} fill={DARK_MUTED} />);
  root.add(<Rect size={[width, 130]} radius={24} fill={WHITE} stroke={DARK_INK} lineWidth={6} />);
  const value = new Txt({x: -width / 2 + 40, offset: [-1, 0], text: '', fontFamily: MONO, fontWeight: 600, fontSize: 66, fill: DARK_INK});
  root.add(value);
  return {root, value, text};
}

function hourglass() {
  const root = new Node({scale: 0});
  root.add(<Line points={[[-60, -90], [60, -90], [0, 0], [60, 90], [-60, 90], [0, 0]]} closed fill={PAPER_CARD} stroke={DARK_INK} lineWidth={7} lineJoin="round" />);
  root.add(<Line points={[[-36, -66], [36, -66], [0, -10]]} closed fill={GOLD} />);
  root.add(<Line points={[[-40, 84], [40, 84], [0, 40]]} closed fill={GOLD} />);
  return root;
}

function shield() {
  const root = new Node({scale: 0});
  root.add(<Line points={[[0, -150], [130, -100], [120, 40], [0, 150], [-120, 40], [-130, -100]]} closed radius={30} fill={DEEP_GREEN} stroke={DARK_INK} lineWidth={8} lineJoin="round" />);
  const tick = new Line({points: [[-50, 0], [-12, 40], [56, -40]], stroke: WHITE, lineWidth: 22, lineCap: 'round', lineJoin: 'round'});
  root.add(tick);
  const crack = new Line({points: [[10, -150], [-20, -60], [25, -10], [-15, 60], [10, 150]], stroke: DARK_INK, lineWidth: 10, lineJoin: 'round', end: 0});
  root.add(crack);
  return {root, tick, crack};
}

function terminal(rows: string[]) {
  const root = new Rect({size: [760, 520], radius: 28, fill: TERMINAL, stroke: DARK_INK, lineWidth: 6, clip: true, scale: 0});
  const list = new Node({y: -150});
  rows.forEach((r, i) => list.add(<Txt x={-330} y={i * 62} offset={[-1, 0]} text={r} fontFamily={MONO} fontWeight={600} fontSize={40} fill="#C9D6CF" />));
  root.add(list);
  root.add(<Rect y={-230} size={[760, 60]} fill="#22302A" />);
  for (const [i, color] of ['#FF5C57', '#E8A33A', '#3DFFA2'].entries()) root.add(<Circle x={-330 + i * 36} y={-230} size={20} fill={color} />);
  root.add(<Txt x={110} y={-230} text="tebak password..." fontFamily={MONO} fontWeight={600} fontSize={28} fill="#93A59C" />);
  return {root, list};
}

function appTile(kind: 'mail' | 'shop' | 'chat' | 'bank', fill: string) {
  const root = new Rect({size: [170, 170], radius: 40, fill, stroke: DARK_INK, lineWidth: 6, scale: 0});
  if (kind === 'mail') {
    root.add(<Rect size={[100, 70]} radius={10} fill={WHITE} />);
    root.add(<Line points={[[-50, -35], [0, 8], [50, -35]]} stroke={DARK_INK} lineWidth={6} lineJoin="round" />);
  }
  if (kind === 'shop') {
    root.add(<Rect y={14} size={[90, 80]} radius={10} fill={WHITE} />);
    root.add(<Circle y={-26} size={50} startAngle={180} endAngle={360} stroke={WHITE} lineWidth={10} />);
  }
  if (kind === 'chat') {
    root.add(<Rect size={[100, 74]} radius={30} fill={WHITE} />);
    root.add(<Line points={[[-30, 30], [-44, 56], [-6, 34]]} closed fill={WHITE} />);
  }
  if (kind === 'bank') {
    root.add(<Line points={[[-50, -12], [0, -48], [50, -12]]} closed fill={WHITE} />);
    for (const x of [-30, 0, 30]) root.add(<Rect x={x} y={20} size={[14, 50]} fill={WHITE} />);
  }
  return root;
}

function padlock(open: boolean, fill = DARK_INK) {
  const root = new Node({scale: 0});
  root.add(<Circle y={open ? -40 : -30} x={open ? 22 : 0} size={70} startAngle={180} endAngle={360} stroke={fill} lineWidth={14} />);
  root.add(<Rect y={14} size={[90, 70]} radius={14} fill={fill} />);
  return root;
}

function keyIcon() {
  const root = new Node({scale: 0});
  root.add(<Circle x={-60} size={90} stroke={GOLD} lineWidth={20} />);
  root.add(<Rect x={30} size={[130, 22]} radius={8} fill={GOLD} />);
  root.add(<Rect x={70} y={22} size={[18, 30]} fill={GOLD} />);
  root.add(<Rect x={40} y={22} size={[18, 22]} fill={GOLD} />);
  return root;
}

function vault() {
  const root = new Node({});
  root.add(<Rect size={[120, 110]} radius={20} fill={NAVY} />);
  root.add(<Circle size={56} stroke={WHITE} lineWidth={8} />);
  root.add(<Line points={[[0, 0], [16, -16]]} stroke={WHITE} lineWidth={8} lineCap="round" />);
  return root;
}

function codePhone() {
  const root = new Node({});
  root.add(<Rect size={[90, 150]} radius={18} fill={DARK_INK} />);
  root.add(<Rect size={[74, 120]} radius={10} fill={WHITE} />);
  root.add(<Txt text="482" fontFamily={MONO} fontWeight={600} fontSize={26} fill={DEEP_GREEN} />);
  return root;
}

/* ---------- Thumbnail ----------
 * Satu fokus: kolom password dengan "132 tahun?" yang dicoret jadi "3 detik". Celah penasaran, tidak mengulang judul.
 */
export function* passwordThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const f = field('', 760);
  f.root.position([0, -260]);
  f.value.text('••••••••');
  view.add(f.root);
  const old = new Node({y: 0, rotation: -3});
  old.add(<Txt text="132 tahun" fontFamily={SANS} fontWeight={700} fontSize={130} fill={DARK_MUTED} />);
  old.add(<Line points={[[-330, 10], [330, -10]]} stroke={DEEP_RED} lineWidth={18} lineCap="round" />);
  view.add(old);
  view.add(<Rect y={-560} layout padding={[16, 34]} radius={18} fill={DARK_INK}>{label('Password 8 karakter', 62, WHITE)}</Rect>);
  view.add(<Txt y={250} text="atau cuma" fontFamily={SANS} fontWeight={700} fontSize={90} fill={DARK_INK} />);
  view.add(<Rect y={420} layout padding={[6, 40]} radius={24} fill={DEEP_RED} rotation={-2}>{label('BEBERAPA DETIK?', 96, WHITE)}</Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* password(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={0} scale={1.12} />);
  captions(view, job.words as Word[], 640, 58, job.duration);

  /* 1. Password 8 karakter campuran: 132 tahun menurut Hive Systems */
  const f = field('Tk7#qL2!');
  f.root.position([0, -560]);
  stage().add(f.root);
  yield* enterUp(f.root, 0.4);
  spawn(tween(1.2, t => f.value.text('•'.repeat(Math.round(8 * t))), linear));
  const kinds: [string, string, string][] = [['ABC', BLUE, 'besar'], ['abc', DEEP_GREEN, 'kecil'], ['123', GOLD, 'angka'], ['#!@', DEEP_RED, 'simbol']];
  const kindChips: Node[] = [];
  for (let i = 0; i < kinds.length; i++) {
    yield* until(c[kinds[i][2]] - 0.1);
    const k = chip(kinds[i][0], kinds[i][1], 50, i === 2 ? DARK_INK : WHITE);
    k.position([-300 + i * 200, -390]);
    stage().add(k);
    kindChips.push(k);
    yield* pop(k, 0.25);
  }
  yield* until(c.hive - 0.15);
  const hive = chip('Hive Systems 2026', NAVY, 40);
  hive.position([0, -270]);
  stage().add(hive);
  yield* pop(hive);
  yield* until(c.seratus - 0.15);
  const glass = hourglass();
  glass.position([-260, -60]);
  stage().add(glass);
  const years = new Txt({x: 90, y: -60, text: '132 tahun', fontFamily: SANS, fontWeight: 700, fontSize: 120, fill: DARK_INK, opacity: 0});
  stage().add(years);
  yield* all(glass.scale(1, 0.35, easeOutBack), years.opacity(1, 0.3));
  spawn(glass.rotation(180, 0.8, easeInOutCubic));
  yield* until(c.aman - 0.15);
  const safe = shield();
  safe.root.position([0, 230]);
  stage().add(safe.root);
  yield* safe.root.scale(0.8, 0.35, easeOutBack);

  /* 2. Masalahnya: cuma kalau acak dan belum pernah bocor */
  yield* until(c.masalahnya - 0.15);
  const star = new Txt({x: 420, y: -100, text: '*', fontFamily: SANS, fontWeight: 700, fontSize: 140, fill: DEEP_RED, scale: 0});
  stage().add(star);
  yield* pop(star);
  yield* until(c.acak - 0.15);
  const cond = chip('*kalau acak & belum pernah bocor', DEEP_RED, 40);
  cond.position([0, 70]);
  stage().add(cond);
  yield* all(pop(cond), safe.crack.end(1, 0.3), safe.root.rotation(-6, 0.1).to(6, 0.1).to(0, 0.1), safe.tick.opacity(0.3, 0.3));

  /* 3. Password manusia gampang ditebak: nama, tanggal lahir, huruf diganti simbol. Jebol dalam detik */
  yield* until(c.password2 - 0.2);
  yield* all(exit(f.root), ...kindChips.map(k => exit(k)), exit(hive), exit(glass), exit(years), exit(safe.root), exit(star), exit(cond));
  const human = chip('Password manusia: ketebak', DARK_INK, 50);
  human.position([0, -680]);
  stage().add(human);
  yield* pop(human);
  const guesses: [string, string][] = [['nama', 'rina'], ['tanggal', '17081999'], ['diganti', 'p@ssw0rd']];
  const guessCards: Node[] = [];
  for (let i = 0; i < guesses.length; i++) {
    yield* until(c[guesses[i][0]] - 0.15);
    const g = card(250, 120);
    g.position([-270 + i * 270, -500]);
    g.scale(0);
    g.add(<Txt text={guesses[i][1]} fontFamily={MONO} fontWeight={600} fontSize={40} fill={DARK_INK} />);
    stage().add(g);
    guessCards.push(g);
    yield* pop(g);
  }
  yield* until(c.dicoba - 0.15);
  const term = terminal(['123456', 'password', 'qwerty', 'rina1999', 'rina17081999', 'p@ssw0rd', 'iloveyou', 'admin123', 'sayang', 'bismillah']);
  term.root.position([0, -100]);
  stage().add(term.root);
  yield* term.root.scale(1, 0.35, easeOutBack);
  spawn(term.list.y(-150 - 62 * 4, 1.6, easeInOutCubic));
  yield* until(c.detik - 0.25);
  const match = new Rect({position: [0, -188], size: [700, 66], radius: 14, stroke: '#3DFFA2', lineWidth: 6, opacity: 0});
  stage().add(match);
  const hit = chip('COCOK! dalam hitungan detik', DEEP_RED, 44);
  hit.position([0, 230]);
  stage().add(hit);
  yield* all(match.opacity(1, 0.15), pop(hit));

  /* 4. Password sama di banyak akun: satu bocor, yang lain ikut kebuka */
  yield* until(c.sama - 0.2);
  yield* all(exit(human), ...guessCards.map(g => exit(g)), exit(term.root), exit(match), exit(hit));
  const key = keyIcon();
  key.position([0, -620]);
  stage().add(key);
  const same = new Txt({y: -520, text: 'password yang sama', fontFamily: SANS, fontWeight: 700, fontSize: 44, fill: DARK_INK, opacity: 0});
  stage().add(same);
  yield* all(key.scale(1.2, 0.35, easeOutBack), same.opacity(1, 0.3));
  const apps: Rect[] = (['mail', 'shop', 'chat', 'bank'] as const).map((k, i) => {
    const t = appTile(k, [BLUE, GOLD, DEEP_GREEN, NAVY][i]);
    t.position([-330 + i * 220, -260]);
    stage().add(t);
    return t;
  });
  const locks = apps.map(a => {
    const l = padlock(false);
    l.position([a.x(), -100]);
    stage().add(l);
    return l;
  });
  yield* all(...apps.map((a, i) => function* () {
    yield* waitFor(i * 0.06);
    yield* all(a.scale(1, 0.3, easeOutBack), locks[i].scale(0.7, 0.3, easeOutBack));
  }()));
  yield* until(c.bocor2 - 0.15);
  const leak = stamp('BOCOR', 60);
  leak.position([apps[1].x() + 40, -400]);
  stage().add(leak);
  leak.scale(1.5);
  yield* all(leak.opacity(1, 0.12), leak.scale(1, 0.2, easeOutCubic), apps[1].fill(DEEP_RED, 0.2));
  yield* until(c.kebuka - 0.2);
  const opened = apps.map((a, i) => {
    if (i === 1) return null;
    const o = padlock(true, DEEP_RED);
    o.position([a.x(), -100]);
    stage().add(o);
    return o;
  });
  yield* all(...locks.map((l, i) => (i === 1 ? waitFor(0) : l.opacity(0, 0.15))), ...opened.map((o, i) => (o ? function* () {
    yield* waitFor(i * 0.08);
    yield* o.scale(0.7, 0.25, easeOutBack);
  }() : waitFor(0))));

  /* 5. NIST: panjang lebih penting daripada simbol, minimal 15 karakter */
  yield* until(c.makanya - 0.2);
  yield* all(exit(key), exit(same), exit(leak), ...apps.map(a => exit(a)), ...locks.map(l => exit(l)), ...opened.filter(Boolean).map(o => exit(o as Node)));
  const nist = chip('Pedoman NIST terbaru', NAVY, 50);
  nist.position([0, -680]);
  stage().add(nist);
  yield* pop(nist);
  yield* until(c.panjang - 0.15);
  const shortBar = new Node({y: -460});
  shortBar.add(<Txt x={-400} y={-60} offset={[-1, 0]} text="8 karakter + simbol aneh" fontFamily={SANS} fontWeight={700} fontSize={40} fill={DARK_MUTED} />);
  const s1 = new Rect({x: -400, offset: [-1, 0], size: [0, 70], radius: 16, fill: SOFT});
  shortBar.add(s1);
  const longBar = new Node({y: -260});
  longBar.add(<Txt x={-400} y={-60} offset={[-1, 0]} text="kalimat panjang" fontFamily={SANS} fontWeight={700} fontSize={40} fill={DARK_INK} />);
  const s2 = new Rect({x: -400, offset: [-1, 0], size: [0, 70], radius: 16, fill: DEEP_GREEN});
  longBar.add(s2);
  stage().add(shortBar);
  stage().add(longBar);
  yield* all(s1.width(340, 0.5, easeOutCubic), s2.width(800, 0.8, easeOutCubic));
  yield* until(c.minimal - 0.15);
  const fifteen = new Node({y: -40, scale: 0});
  fifteen.add(<Txt text="15+" fontFamily={SANS} fontWeight={700} fontSize={200} fill={DEEP_GREEN} />);
  fifteen.add(<Txt y={125} text="karakter, kalau cuma pakai password" fontFamily={MONO} fontWeight={600} fontSize={36} fill={DARK_MUTED} />);
  stage().add(fifteen);
  yield* pop(fifteen, 0.4);

  /* 6. Kata acak, beda tiap akun, password manager, verifikasi dua langkah */
  yield* until(c.gabungin - 0.2);
  yield* all(exit(nist), exit(shortBar), exit(longBar), exit(fifteen));
  const phrase = card(900, 150);
  phrase.position([0, -620]);
  phrase.scale(0);
  phrase.add(<Txt text="kopi-jendela-gajah-pelangi" fontFamily={MONO} fontWeight={600} fontSize={48} fill={DARK_INK} />);
  stage().add(phrase);
  const ex = new Txt({y: -515, text: 'contoh, jangan dipakai', fontFamily: MONO, fontWeight: 600, fontSize: 30, fill: DARK_MUTED, opacity: 0});
  stage().add(ex);
  yield* all(pop(phrase), ex.opacity(1, 0.3));
  const tips: [string, () => Node, string][] = [
    ['Beda tiap akun', () => keyIcon(), 'bedain'],
    ['Password manager', () => vault(), 'simpan'],
    ['Verifikasi 2 langkah', () => codePhone(), 'verifikasi'],
  ];
  for (let i = 0; i < tips.length; i++) {
    yield* until(c[tips[i][2]] - 0.15);
    const row = card(820, 180);
    row.position([0, -360 + i * 210]);
    row.scale(0);
    const icon = tips[i][1]();
    icon.position([-300, 0]);
    icon.scale(i === 0 ? 0.8 : 0.9);
    row.add(icon);
    row.add(<Txt x={-170} offset={[-1, 0]} text={tips[i][0]} fontFamily={SANS} fontWeight={700} fontSize={54} fill={DARK_INK} />);
    stage().add(row);
    yield* pop(row, 0.35);
  }
  yield* until(job.duration);
  yield* waitFor(0);
}

