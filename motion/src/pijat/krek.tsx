/**
 * Short akun pijat: bunyi "krek" saat dipijat itu gelembung gas di cairan sendi, bukan tulang patah.
 * Semua ilustrasi digambar kode, hangat dan membulat. Tiap adegan berganti pada kata yang diucapkan.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutSine, easeOutBack, easeOutCubic, spawn, ThreadGenerator, tween, waitFor} from '@revideo/core';
import {backBody, card, cross, doctorIcon, hand} from './leher';
import {
  backdrop, captions, chip, fade, GOLD, INK, PEACH, pop, rise, ROUND, SAGE_DARK, SAND, SOFT_INK, TERRA, until, WHITE, Word,
} from './system';

const OUTLINE = 7;
const BONE = '#FFF4E2';
const FLUID = '#F4DDA8';

/* ---------- Ilustrasi ---------- */

/** Ledakan komik "KREK!" */
function krek(scale = 1) {
  const root = new Node({scale: 0, opacity: 0});
  const points: [number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 105 : 175;
    const a = (i / 24) * Math.PI * 2;
    points.push([Math.cos(a) * r * 1.35, Math.sin(a) * r]);
  }
  const burst = new Node({scale});
  burst.add(<Line points={points} closed fill={GOLD} stroke={INK} lineWidth={OUTLINE} lineJoin="round" />);
  burst.add(<Txt text="KREK!" fontFamily={ROUND} fontWeight={800} fontSize={92} fill={TERRA} rotation={-8} />);
  root.add(burst);
  return root;
}

/** Tulang yang ujungnya membulat. dir 1 = ujung di bawah, -1 = ujung di atas. */
function bone(dir: number) {
  const root = new Node({});
  root.add(<Rect y={-dir * 170} size={[150, 360]} radius={40} fill={BONE} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Circle size={[280, 190]} fill={BONE} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect y={-dir * 120} size={[136, 140]} fill={BONE} />);
  root.add(<Circle y={dir * 6} size={[250, 160]} startAngle={dir > 0 ? 20 : 200} endAngle={dir > 0 ? 160 : 340} stroke={PEACH} lineWidth={18} lineCap="round" />);
  return root;
}

/** Sendi: dua ujung tulang, kapsul, cairan pelumas, dan gas terlarut */
function joint() {
  const root = new Node({});
  const fluid = new Circle({size: [460, 330], fill: FLUID, stroke: SOFT_INK, lineWidth: 6, lineDash: [18, 12]});
  root.add(fluid);
  const upper = bone(1);
  upper.y(-150);
  const lower = bone(-1);
  lower.y(150);
  root.add(upper);
  root.add(lower);
  const gas = new Node({opacity: 0});
  for (const [x, y] of [[-170, -10], [-120, 30], [-60, -20], [0, 25], [60, -25], [120, 20], [175, -5], [-150, 70], [150, -70], [90, 75], [-90, -70]]) {
    gas.add(<Circle x={x} y={y} size={14} fill={WHITE} stroke={SOFT_INK} lineWidth={3} />);
  }
  root.add(gas);
  const bubble = new Node({scale: 0});
  bubble.add(<Circle size={110} fill={WHITE} stroke={INK} lineWidth={6} />);
  bubble.add(<Circle x={-22} y={-22} size={26} fill={PEACH} opacity={0.7} />);
  root.add(bubble);
  return {root, fluid, upper, lower, gas, bubble};
}

function gauge() {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Circle size={240} startAngle={180} endAngle={360} closed fill={WHITE} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Circle size={190} startAngle={185} endAngle={260} stroke={SAGE_DARK} lineWidth={16} />);
  root.add(<Circle size={190} startAngle={280} endAngle={355} stroke={TERRA} lineWidth={16} />);
  const needle = new Line({points: [[0, 0], [0, -95]], stroke: INK, lineWidth: 10, lineCap: 'round', rotation: 50});
  root.add(needle);
  root.add(<Circle size={30} fill={INK} />);
  root.add(<Txt y={50} text="tekanan" fontFamily={ROUND} fontWeight={800} fontSize={38} fill={SOFT_INK} />);
  return {root, needle};
}

function scanner() {
  const root = new Node({});
  root.add(<Circle size={420} fill={SAND} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Circle size={200} fill={WHITE} stroke={INK} lineWidth={OUTLINE} />);
  const finger = hand();
  finger.rotation(-90);
  finger.position([-150, 0]);
  root.add(finger);
  return root;
}

function monitor() {
  const root = new Node({});
  root.add(<Rect size={[380, 300]} radius={30} fill="#3A2C26" stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect x={-24} y={-70} size={[60, 120]} radius={20} fill="#CFC6BE" />);
  root.add(<Circle x={-24} y={-12} size={[110, 60]} fill="#CFC6BE" />);
  root.add(<Rect x={-24} y={70} size={[60, 120]} radius={20} fill="#CFC6BE" />);
  root.add(<Circle x={-24} y={12} size={[110, 60]} fill="#CFC6BE" />);
  const spot = new Circle({x: -24, size: 46, fill: '#1A1210', scale: 0});
  root.add(spot);
  root.add(<Txt x={110} y={-110} text="MRI" fontFamily={ROUND} fontWeight={800} fontSize={40} fill={PEACH} />);
  return {root, spot};
}

export function clock() {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Circle size={180} fill={WHITE} stroke={INK} lineWidth={OUTLINE} />);
  const hand1 = new Line({points: [[0, 0], [0, -60]], stroke: INK, lineWidth: 10, lineCap: 'round'});
  root.add(hand1);
  root.add(<Line points={[[0, 0], [40, 0]]} stroke={INK} lineWidth={10} lineCap="round" />);
  root.add(<Circle size={22} fill={TERRA} />);
  return {root, hand1};
}

export function boltIcon() {
  const root = new Node({});
  root.add(<Line points={[[20, -90], [-50, 10], [0, 10], [-20, 90], [50, -10], [0, -10]]} closed fill={GOLD} stroke={INK} lineWidth={6} lineJoin="round" />);
  return root;
}

export function swellIcon() {
  const root = new Node({});
  root.add(<Rect y={40} size={[70, 150]} radius={30} fill={PEACH} stroke={INK} lineWidth={6} />);
  root.add(<Circle y={-30} size={130} fill={TERRA} opacity={0.75} stroke={INK} lineWidth={6} />);
  return root;
}

/* ---------- Thumbnail ----------
 * Satu fokus: ledakan "KREK!" di atas sendi dengan gelembung. Pertanyaan yang membalik dugaan umum.
 */
export function* krekThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const j = joint();
  j.root.position([0, 170]);
  j.root.scale(0.75);
  j.upper.y(-175);
  j.lower.y(175);
  j.gas.opacity(1);
  j.bubble.scale(1.3);
  view.add(j.root);
  const burst = krek(1.05);
  burst.position([250, 40]);
  burst.scale(0.9);
  burst.opacity(1);
  view.add(burst);
  view.add(<Txt y={-560} text="Bunyi krek pas dipijat" fontFamily={ROUND} fontWeight={800} fontSize={80} fill={INK} />);
  view.add(<Rect y={-430} layout padding={[10, 40]} radius={60} fill={TERRA} rotation={-3}>
    <Txt text="tulang patah?" fontFamily={ROUND} fontWeight={800} fontSize={110} fill={WHITE} />
  </Rect>);
  view.add(<Rect y={650} layout padding={[18, 44]} radius={50} fill={WHITE} shadowColor="#4B342833" shadowBlur={30}>
    <Txt text="ternyata ini yang bunyi" fontFamily={ROUND} fontWeight={800} fontSize={52} fill={SAGE_DARK} />
  </Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* krekVideo(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={10} scale={1.1} />);
  captions(view, job.words as Word[], 650, 58, job.duration);

  /* 1. Dipijat, bunyi krek. Bukan tulang patah */
  const back = backBody();
  back.root.position([0, -300]);
  stage().add(back.root);
  const hands = [-1, 1].map(side => {
    const h = hand();
    h.position([side * 190, 160]);
    h.rotation(side * 25);
    back.root.add(h);
    return h;
  });
  yield* rise(back.root, 0.5);
  spawn(function* () {
    for (let i = 0; i < 4; i++) yield* all(...hands.map(h => h.scale(0.9, 0.25, easeInOutSine).to(1, 0.25, easeInOutSine)));
  });
  yield* until(c.krek - 0.1);
  const burst = krek(0.8);
  burst.position([260, -620]);
  stage().add(burst);
  yield* pop(burst, 0.3);
  yield* until(c.bukan - 0.15);
  const notBroken = new Node({position: [-260, -620], scale: 0});
  const b = new Node({rotation: -30});
  b.add(<Rect size={[220, 50]} radius={25} fill={BONE} stroke={INK} lineWidth={6} />);
  for (const [x, y] of [[-110, -22], [-110, 22], [110, -22], [110, 22]]) b.add(<Circle x={x} y={y} size={56} fill={BONE} stroke={INK} lineWidth={6} />);
  b.add(<Rect size={[200, 36]} radius={18} fill={BONE} />);
  b.add(<Line points={[[-10, -26], [6, -4], [-8, 6], [8, 26]]} stroke={INK} lineWidth={6} lineJoin="round" />);
  notBroken.add(b);
  const no = cross(90);
  no.position([90, 60]);
  notBroken.add(no);
  stage().add(notBroken);
  yield* pop(notBroken);
  yield* pop(no, 0.3);

  /* 2. Di dalam sendi ada cairan pelumas dengan gas terlarut */
  yield* until(c.di - 0.2);
  yield* all(fade(back.root), fade(burst), fade(notBroken));
  const j = joint();
  j.root.position([0, -170]);
  j.root.scale(0.8);
  stage().add(j.root);
  yield* rise(j.root, 0.5);
  yield* until(c.cairan - 0.15);
  const fluidLabel = chip('cairan pelumas', SAGE_DARK, 46);
  fluidLabel.position([0, -730]);
  stage().add(fluidLabel);
  yield* all(pop(fluidLabel), j.fluid.fill('#F7CF7A', 0.3).to(FLUID, 0.5));
  yield* until(c.gas - 0.15);
  const gasLabel = chip('+ gas terlarut', GOLD, 46, INK);
  gasLabel.position([0, -640]);
  stage().add(gasLabel);
  yield* all(j.gas.opacity(1, 0.5), pop(gasLabel));
  spawn(function* () {
    for (let i = 0; i < 8; i++) yield* j.gas.position([4, -4], 0.5, easeInOutSine).to([-4, 4], 0.5, easeInOutSine);
  });

  /* 3. Ditarik, tekanan turun, gelembung terbentuk: bunyi krek */
  yield* until(c.ditarik - 0.15);
  yield* all(fade(fluidLabel), fade(gasLabel));
  const arrows = [-1, 1].map(dir => new Line({points: [[0, 0], [0, dir * 110]], x: 290, y: dir * 150, stroke: TERRA, lineWidth: 14, endArrow: true, arrowSize: 32, lineCap: 'round', end: 0}));
  arrows.forEach(a => j.root.add(a));
  yield* all(j.upper.y(-200, 0.6, easeInOutSine), j.lower.y(200, 0.6, easeInOutSine), j.fluid.size([460, 420], 0.6, easeInOutSine), ...arrows.map(a => a.end(1, 0.5)));
  yield* until(c.tekanannya - 0.15);
  const meter = gauge();
  meter.root.position([-290, -720]);
  stage().add(meter.root);
  yield* pop(meter.root);
  yield* meter.needle.rotation(-55, 0.6, easeInOutSine);
  yield* until(c.gelembung - 0.15);
  yield* all(j.bubble.scale(1, 0.3, easeOutBack), j.gas.opacity(0.35, 0.3));
  yield* until(c.krek2 - 0.1);
  const burst2 = krek(0.75);
  burst2.position([270, -690]);
  stage().add(burst2);
  yield* pop(burst2, 0.3);

  /* 4. Riset Kanada 2015: MRI merekam gelembung saat jari berbunyi */
  yield* until(c.tahun - 0.2);
  yield* all(fade(j.root), fade(meter.root), fade(burst2));
  const study = chip('Riset Kanada, 2015', SAGE_DARK, 50);
  study.position([0, -735]);
  stage().add(study);
  yield* pop(study);
  const scan = scanner();
  scan.position([-150, -430]);
  scan.scale(1);
  stage().add(scan);
  yield* rise(scan, 0.4);
  yield* until(c.mri - 0.15);
  const screen = monitor();
  screen.root.position([200, -60]);
  screen.root.scale(0);
  stage().add(screen.root);
  yield* pop(screen.root);
  yield* until(c.terbentuk - 0.15);
  yield* screen.spot.scale(1, 0.3, easeOutBack);
  yield* until(c.berbunyi - 0.1);
  const burst3 = krek(0.55);
  burst3.position([320, -260]);
  stage().add(burst3);
  yield* pop(burst3, 0.3);

  /* 5. Belum bisa langsung dibunyikan lagi: gas perlu waktu larut */
  yield* until(c.makanya - 0.2);
  yield* all(fade(study), fade(scan), fade(screen.root), fade(burst3));
  const j2 = joint();
  j2.root.position([0, -170]);
  j2.root.scale(0.8);
  j2.upper.y(-200);
  j2.lower.y(200);
  j2.fluid.size([460, 420]);
  j2.bubble.scale(1);
  j2.gas.opacity(0.35);
  stage().add(j2.root);
  yield* rise(j2.root, 0.5);
  yield* until(c.langsung - 0.15);
  const wait = clock();
  wait.root.position([300, -730]);
  stage().add(wait.root);
  const waitText = new Txt({x: -230, y: -730, text: 'perlu jeda', fontFamily: ROUND, fontWeight: 800, fontSize: 60, fill: INK, opacity: 0});
  stage().add(waitText);
  yield* all(pop(wait.root), waitText.opacity(1, 0.3));
  spawn(wait.hand1.rotation(720, 4));
  yield* until(c.larut - 0.15);
  yield* all(j2.bubble.scale(0, 1.2, easeInOutSine), j2.gas.opacity(1, 1.2), j2.upper.y(-150, 1.2, easeInOutSine), j2.lower.y(150, 1.2, easeInOutSine), j2.fluid.size([460, 330], 1.2, easeInOutSine));

  /* 6. Waktu mijat, tidak perlu mengejar bunyi krek */
  yield* until(c.jadi - 0.2);
  yield* all(fade(j2.root), fade(wait.root), fade(waitText));
  const back2 = backBody();
  back2.root.position([0, -280]);
  stage().add(back2.root);
  const soft = [-1, 1].map(side => {
    const h = hand();
    h.position([side * 190, 160]);
    h.rotation(side * 25);
    back2.root.add(h);
    return h;
  });
  yield* rise(back2.root, 0.4);
  spawn(function* () {
    for (let i = 0; i < 4; i++) yield* all(...soft.map(h => h.scale(0.92, 0.35, easeInOutSine).to(1, 0.35, easeInOutSine)));
  });
  yield* until(c.ngejar - 0.15);
  const small = krek(0.55);
  small.position([0, -700]);
  stage().add(small);
  yield* pop(small, 0.3);
  const noChase = cross(100);
  noChase.position([170, -650]);
  stage().add(noChase);
  yield* pop(noChase, 0.3);

  /* 7. Radang sendi? Penelitian tidak menemukan hubungannya */
  yield* until(c.terus - 0.2);
  yield* all(fade(back2.root), fade(small), fade(noChase));
  const ask = chip('Bikin radang sendi?', TERRA, 58);
  ask.position([0, -600]);
  stage().add(ask);
  yield* pop(ask);
  yield* until(c.penelitian - 0.15);
  const verdict = card(800, 360);
  verdict.position([0, -250]);
  verdict.scale(0);
  verdict.add(<Txt y={-80} text="Hubungannya" fontFamily={ROUND} fontWeight={800} fontSize={56} fill={SOFT_INK} />);
  verdict.add(<Txt y={10} text="belum ditemukan" fontFamily={ROUND} fontWeight={800} fontSize={76} fill={INK} />);
  verdict.add(<Txt y={100} text="dari penelitian sejauh ini" fontFamily={ROUND} fontWeight={800} fontSize={40} fill={SOFT_INK} />);
  stage().add(verdict);
  yield* pop(verdict);

  /* 8. Kalau nyeri atau bengkak: periksa ke dokter */
  yield* until(c.tapi - 0.2);
  yield* all(fade(ask), fade(verdict));
  const row: [() => Node, string, string][] = [[boltIcon, 'Disertai nyeri', 'nyeri'], [swellIcon, 'Disertai bengkak', 'bengkak'], [doctorIcon, 'Periksa ke dokter', 'periksa']];
  for (let i = 0; i < row.length; i++) {
    yield* until(c[row[i][2]] - 0.15);
    const item = card(820, 250);
    item.position([0, -620 + i * 290]);
    item.scale(0);
    const icon = row[i][0]();
    icon.position([-270, 0]);
    icon.scale(0.85);
    item.add(icon);
    item.add(<Txt x={-130} offset={[-1, 0]} width={530} textWrap text={row[i][1]} fontFamily={ROUND} fontWeight={800} fontSize={54} fill={i === 2 ? TERRA : INK} />);
    stage().add(item);
    yield* pop(item, 0.45);
  }
  yield* until(job.duration);
  yield* waitFor(0);
}
