/**
 * Short akun pijat: pegal sehari setelah olahraga (DOMS). Bukan asam laktat, tapi robekan kecil di serat otot.
 * Pijat terbukti mengurangi pegal; tutorial pijat betis satu menit; tanda bahaya.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutSine, easeOutBack, easeOutCubic, linear, spawn, ThreadGenerator, tween, waitFor} from '@revideo/core';
import {boltIcon, swellIcon} from './krek';
import {card, doctorIcon, hand} from './leher';
import {
  backdrop, captions, chip, fade, GOLD, INK, PEACH, pop, rise, ROUND, SAGE, SAGE_DARK, SAND, SKIN, SKIN_DARK, SOFT_INK, TERRA, until, WHITE, Word,
} from './system';
import {figure} from './usapan';

const OUTLINE = 7;
const MUSCLE = '#D9826A';
const MUSCLE_LIGHT = '#EBA48E';

/* ---------- Ilustrasi ---------- */

function legGlow(root: Node) {
  const glows = [-70, 70].map(x => new Rect({x, y: 370, size: [110, 300], radius: 45, fill: TERRA, opacity: 0}));
  glows.forEach(g => root.add(g));
  return glows;
}

/** Grafik pegal per hari: muncul setelah hari pertama, puncak hari ke-2 sampai ke-3 */
function soreChart() {
  const root = new Node({});
  const W = 760;
  const H = 360;
  const x = (day: number) => -W / 2 + (day / 5) * W;
  const y = (level: number) => H / 2 - level * H;
  root.add(<Rect y={20} size={[W + 140, H + 250]} radius={44} fill={WHITE} shadowColor="#4B342826" shadowBlur={34} shadowOffsetY={12} />);
  root.add(<Txt x={-W / 2} y={-H / 2 - 60} offset={[-1, 0]} text="Rasa pegal" fontFamily={ROUND} fontWeight={800} fontSize={40} fill={SOFT_INK} />);
  const band = new Rect({x: x(2.5), y: 0, size: [x(3) - x(2), H], fill: PEACH, opacity: 0, radius: 16});
  root.add(band);
  root.add(<Line points={[[-W / 2, H / 2], [W / 2, H / 2]]} stroke={INK} lineWidth={6} lineCap="round" />);
  for (let d = 0; d <= 5; d++) root.add(<Txt x={x(d)} y={H / 2 + 44} text={String(d)} fontFamily={ROUND} fontWeight={800} fontSize={40} fill={INK} />);
  root.add(<Txt y={H / 2 + 104} text="hari setelah olahraga" fontFamily={ROUND} fontWeight={800} fontSize={36} fill={SOFT_INK} />);
  const levelAt = (d: number) => 0.06 + 0.86 * Math.exp(-((d - 2.4) ** 2) / (2 * 0.95 ** 2)) * (d < 0.4 ? d / 0.4 : 1);
  const points: [number, number][] = [];
  for (let i = 0; i <= 50; i++) {
    const d = (i / 50) * 5;
    points.push([x(d), y(levelAt(d))]);
  }
  const curve = new Line({points, stroke: TERRA, lineWidth: 14, lineCap: 'round', lineJoin: 'round', end: 0});
  root.add(curve);
  return {root, curve, band};
}

function flask() {
  const root = new Node({});
  root.add(<Line points={[[-50, -170], [-50, -40], [-150, 140], [150, 140], [50, -40], [50, -170]]} closed radius={20} fill={WHITE} stroke={INK} lineWidth={OUTLINE} lineJoin="round" />);
  root.add(<Line points={[[-95, 50], [-150, 138], [150, 138], [95, 50]]} closed radius={10} fill={GOLD} opacity={0.85} />);
  root.add(<Rect y={-180} size={[130, 30]} radius={10} fill={SAND} stroke={INK} lineWidth={6} />);
  root.add(<Txt y={210} text="asam laktat" fontFamily={ROUND} fontWeight={800} fontSize={52} fill={INK} />);
  return root;
}

/** Berkas serat otot dengan robekan kecil yang bisa muncul lalu ditambal */
function fibers() {
  const root = new Node({});
  const body = new Node({});
  root.add(body);
  const tears: Node[] = [];
  const patches: Circle[] = [];
  for (let i = 0; i < 6; i++) {
    const y = -150 + i * 60;
    body.add(<Rect y={y} size={[780, 48]} radius={24} fill={i % 2 ? MUSCLE : MUSCLE_LIGHT} stroke={INK} lineWidth={5} />);
  }
  for (const [x, row] of [[-200, 1], [120, 3], [-40, 4], [250, 0]]) {
    const tear = new Node({x, y: -150 + row * 60, scale: 0});
    tear.add(<Rect size={[40, 50]} fill={CREAM_GAP} />);
    tear.add(<Line points={[[-14, -24], [6, -8], [-8, 6], [12, 24]]} stroke={INK} lineWidth={5} lineJoin="round" />);
    body.add(tear);
    tears.push(tear);
    const patch = new Circle({x, y: -150 + row * 60, size: 54, fill: GOLD, stroke: INK, lineWidth: 4, scale: 0});
    body.add(patch);
    patches.push(patch);
  }
  return {root, body, tears, patches};
}
const CREAM_GAP = '#F8EEE3';

function stairs() {
  const root = new Node({});
  const steps: [number, number][] = [[-160, -120], [-40, -40], [80, 40], [200, 120]];
  steps.forEach(([x, y]) => root.add(<Rect x={x} y={y + 60} size={[124, 80 + (y + 120)]} offset={[0, -1]} fill={SAND} stroke={INK} lineWidth={6} />));
  const walker = new Node({position: [-160, -200]});
  walker.add(<Circle y={-70} size={60} fill={SKIN} stroke={INK} lineWidth={5} />);
  walker.add(<Rect y={0} size={[56, 90]} radius={24} fill={SAGE} stroke={INK} lineWidth={5} />);
  walker.add(<Line points={[[-10, 40], [-18, 90]]} stroke={INK} lineWidth={12} lineCap="round" />);
  walker.add(<Line points={[[10, 40], [24, 86]]} stroke={INK} lineWidth={12} lineCap="round" />);
  root.add(walker);
  return {root, walker};
}

function barbell() {
  const root = new Node({});
  const bar = new Node({y: -120});
  bar.add(<Rect size={[360, 18]} radius={9} fill={SOFT_INK} />);
  for (const x of [-170, 170]) bar.add(<Rect x={x} size={[40, 130]} radius={12} fill={INK} />);
  root.add(bar);
  return {root, bar};
}

function paper(scale = 1) {
  const root = new Node({scale});
  root.add(<Rect size={[90, 116]} radius={12} fill={WHITE} stroke={INK} lineWidth={5} />);
  for (let i = 0; i < 4; i++) root.add(<Rect y={-30 + i * 20} size={[56 - (i === 3 ? 20 : 0), 8]} radius={4} fill={SAND} />);
  return root;
}

/** Betis tampak samping: lutut di atas, mata kaki di bawah */
export function calf() {
  const root = new Node({});
  root.add(<Line points={[[-40, -330], [-90, -120], [-70, 120], [-40, 300], [40, 300], [50, 120], [60, -120], [40, -330]]} closed radius={60} fill={SKIN} stroke={INK} lineWidth={OUTLINE} lineJoin="round" />);
  root.add(<Line points={[[-40, 300], [-60, 380], [160, 390], [150, 330], [40, 300]]} closed radius={30} fill={SKIN} stroke={INK} lineWidth={OUTLINE} lineJoin="round" />);
  root.add(<Circle x={-70} y={-60} size={[70, 200]} fill={SKIN_DARK} opacity={0.35} />);
  return root;
}

export function teaGlass() {
  const root = new Node({});
  root.add(<Line points={[[-60, -80], [60, -80], [48, 90], [-48, 90]]} closed radius={10} fill={WHITE} stroke={INK} lineWidth={6} lineJoin="round" />);
  root.add(<Line points={[[-55, -30], [55, -30], [46, 86], [-46, 86]]} closed radius={8} fill="#9A5A2E" />);
  return root;
}

/* ---------- Thumbnail ----------
 * Satu fokus: orang berdiri kaku dengan kaki menyala. Pertanyaan relatable plus janji jawaban.
 */
export function* pegalThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const person = figure();
  person.root.position([0, 150]);
  person.root.scale(0.9);
  legGlow(person.root).forEach(g => g.opacity(0.75));
  view.add(person.root);
  for (const [x, y, r] of [[-165, 470, -20], [165, 480, 20], [-170, 575, -30], [170, 585, 30]]) {
    view.add(<Line x={x} y={y} rotation={r} points={[[-26, 0], [-13, -14], [0, 0], [13, -14], [26, 0]]} stroke={TERRA} lineWidth={9} lineCap="round" lineJoin="round" />);
  }
  view.add(<Txt y={-600} text="Pegalnya baru" fontFamily={ROUND} fontWeight={800} fontSize={92} fill={INK} />);
  view.add(<Rect y={-470} layout padding={[10, 44]} radius={60} fill={TERRA} rotation={-3}>
    <Txt text="terasa besoknya?" fontFamily={ROUND} fontWeight={800} fontSize={104} fill={WHITE} />
  </Rect>);
  view.add(<Rect y={-330} layout padding={[14, 36]} radius={50} fill={WHITE} shadowColor="#4B342833" shadowBlur={30}>
    <Txt text="bukan asam laktat!" fontFamily={ROUND} fontWeight={800} fontSize={50} fill={SAGE_DARK} />
  </Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* pegal(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={10} scale={1.1} />);
  captions(view, job.words as Word[], 650, 58, job.duration);

  /* 1. Habis olahraga biasa saja, besoknya kaki susah jalan */
  const person = figure();
  person.root.position([0, -170]);
  person.root.scale(0.86);
  stage().add(person.root);
  const glows = legGlow(person.root);
  const today = chip('Hari ini: aman', SAGE_DARK, 52);
  today.position([0, -740]);
  stage().add(today);
  yield* all(rise(person.root, 0.5), pop(today));
  yield* until(c.besoknya - 0.2);
  const tomorrow = chip('Besoknya...', TERRA, 52);
  tomorrow.position([0, -740]);
  stage().add(tomorrow);
  yield* all(today.opacity(0, 0.25), pop(tomorrow), ...glows.map(g => g.opacity(0.7, 0.4)));
  spawn(function* () {
    for (let i = 0; i < 5; i++) yield* person.root.rotation(2, 0.12).to(-2, 0.24).to(0, 0.12);
  });

  /* 2. DOMS: muncul sehari setelah, paling pegal hari ke-2 sampai ke-3 */
  yield* until(c.namanya - 0.2);
  yield* all(fade(person.root), fade(tomorrow));
  const name = new Node({position: [0, -690], scale: 0});
  name.add(<Txt text="DOMS" fontFamily={ROUND} fontWeight={800} fontSize={150} fill={TERRA} />);
  name.add(<Txt y={95} text="nyeri otot yang datang telat" fontFamily={ROUND} fontWeight={800} fontSize={44} fill={SOFT_INK} />);
  stage().add(name);
  yield* until(c.doms - 0.15);
  yield* pop(name);
  const chart = soreChart();
  chart.root.position([0, -170]);
  stage().add(chart.root);
  yield* rise(chart.root, 0.45);
  yield* until(c.sehari - 0.15);
  yield* chart.curve.end(0.32, 0.8, easeInOutSine);
  yield* until(c.paling - 0.15);
  yield* chart.curve.end(1, 1.2, easeInOutSine);
  yield* until(c.kedua - 0.15);
  yield* chart.band.opacity(0.6, 0.4);

  /* 3. Bukan asam laktat */
  yield* until(c.banyak - 0.2);
  yield* all(fade(name), fade(chart.root));
  const lactic = flask();
  lactic.position([0, -330]);
  stage().add(lactic);
  yield* rise(lactic, 0.45);
  yield* until(c.bukan - 0.15);
  const myth = new Rect({position: [0, -380], layout: true, padding: [12, 34], radius: 16, stroke: TERRA, lineWidth: 10, rotation: -10, scale: 1.6, opacity: 0,
    children: [<Txt text="MITOS" fontFamily={ROUND} fontWeight={800} fontSize={110} fill={TERRA} />]});
  stage().add(myth);
  yield* all(myth.opacity(1, 0.12), myth.scale(1, 0.22, easeOutCubic));

  /* 4. Robekan kecil di serat otot saat otot memanjang menahan beban */
  yield* until(c.penyebab - 0.2);
  yield* all(fade(lactic), fade(myth));
  const muscle = fibers();
  muscle.root.position([0, -380]);
  muscle.root.scale(0.82);
  stage().add(muscle.root);
  const fiberChip = chip('serat otot', SAGE_DARK, 46);
  fiberChip.position([0, -700]);
  stage().add(fiberChip);
  yield* all(rise(muscle.root, 0.45), pop(fiberChip));
  yield* until(c.robekan - 0.15);
  for (const tear of muscle.tears) yield* tear.scale(1, 0.18, easeOutBack);
  yield* until(c.memanjang - 0.15);
  const pull = [-1, 1].map(side => new Line({points: [[0, 0], [side * 100, 0]], x: side * 370, y: -380, stroke: TERRA, lineWidth: 14, endArrow: true, arrowSize: 32, lineCap: 'round', end: 0}));
  pull.forEach(p => stage().add(p));
  yield* all(muscle.body.scale([1.12, 0.9], 0.6, easeInOutSine), ...pull.map(p => p.end(1, 0.5)));
  yield* until(c.turun - 0.15);
  const stair = stairs();
  stair.root.position([-230, 80]);
  stair.root.scale(0);
  stage().add(stair.root);
  yield* pop(stair.root);
  spawn(function* () {
    for (const [x, y] of [[-40, -120], [80, -40], [200, 40]] as [number, number][]) yield* stair.walker.position([x, y], 0.35, easeInOutSine);
  });
  yield* until(c.menurunkan - 0.15);
  const bell = barbell();
  bell.root.position([250, 120]);
  bell.root.scale(0);
  stage().add(bell.root);
  yield* pop(bell.root);
  yield* bell.bar.y(60, 1.0, easeInOutSine);

  /* 5. Tubuh memperbaiki, proses itu yang bikin nyeri */
  yield* until(c.tubuh - 0.2);
  yield* all(fade(stair.root), fade(bell.root), ...pull.map(p => p.opacity(0, 0.3)), muscle.body.scale(1, 0.4), fiberChip.opacity(0, 0.3));
  const fix = chip('diperbaiki tubuh', SAGE_DARK, 48);
  fix.position([0, -700]);
  stage().add(fix);
  yield* pop(fix);
  for (const p of muscle.patches) yield* p.scale(1, 0.2, easeOutBack);
  yield* until(c.nyeri2 - 0.15);
  const ache = new Circle({position: [0, -380], size: [900, 460], fill: TERRA, opacity: 0});
  stage().insert(ache, 0);
  yield* ache.opacity(0.25, 0.3);
  spawn(ache.opacity(0.1, 0.5).to(0.25, 0.5));

  /* 6. Analisis dari 11 penelitian: pijat mengurangi pegal */
  yield* until(c.kabar - 0.2);
  yield* all(fade(muscle.root), fade(fix), fade(ache));
  const good = chip('Kabar baiknya', SAGE_DARK, 52);
  good.position([0, -740]);
  stage().add(good);
  yield* pop(good);
  yield* until(c.sebelas - 0.2);
  const papers: Node[] = [];
  for (let i = 0; i < 11; i++) {
    const p = paper(1);
    p.position([-300 + (i % 6) * 120, -540 + Math.floor(i / 6) * 150]);
    p.scale(0);
    stage().add(p);
    papers.push(p);
  }
  const count = new Txt({x: 335, y: -390, text: '11', fontFamily: ROUND, fontWeight: 800, fontSize: 120, fill: TERRA, opacity: 0});
  stage().add(count);
  yield* all(...papers.map((p, i) => function* () {
    yield* waitFor(i * 0.04);
    yield* p.scale(1, 0.3, easeOutBack);
  }()), count.opacity(1, 0.4));
  yield* until(c.pijat - 0.15);
  const result = card(780, 230);
  result.position([0, -110]);
  result.scale(0);
  result.add(<Txt x={-330} offset={[-1, 0]} text="Pijat" fontFamily={ROUND} fontWeight={800} fontSize={70} fill={INK} />);
  result.add(<Line points={[[-120, 0], [20, 0]]} stroke={SAGE_DARK} lineWidth={12} endArrow arrowSize={30} lineCap="round" />);
  result.add(<Txt x={60} offset={[-1, 0]} width={300} textWrap text="pegal berkurang" fontFamily={ROUND} fontWeight={800} fontSize={58} fill={SAGE_DARK} />);
  stage().add(result);
  yield* pop(result);

  /* 7. Usap betis dari bawah ke atas, lalu remas pelan satu menit */
  yield* until(c.coba - 0.2);
  yield* all(fade(good), ...papers.map(p => fade(p, 0.3)), fade(count), fade(result));
  const leg = calf();
  leg.position([-80, -260]);
  stage().add(leg);
  const tip = chip('Pijat betis 1 menit', TERRA, 52);
  tip.position([0, -740]);
  stage().add(tip);
  yield* all(rise(leg, 0.45), pop(tip));
  yield* until(c.usap - 0.15);
  const palm = hand();
  palm.rotation(-90);
  palm.position([10, 230]);
  palm.opacity(0);
  leg.add(palm);
  const up = new Line({points: [[150, 260], [150, -260]], stroke: GOLD, lineWidth: 14, lineDash: [24, 16], endArrow: true, arrowSize: 32, lineCap: 'round', end: 0});
  leg.add(up);
  yield* palm.opacity(1, 0.25);
  yield* all(palm.y(-230, 1.6, easeInOutSine), up.end(1, 1.2, easeOutCubic));
  yield* until(c.remas - 0.15);
  yield* all(palm.y(-40, 0.4, easeInOutSine), up.opacity(0, 0.3));
  spawn(function* () {
    for (let i = 0; i < 5; i++) yield* palm.scale([0.85, 1.05], 0.25, easeInOutSine).to([1, 1], 0.25, easeInOutSine);
  });
  yield* until(c.satu - 0.15);
  const timer = new Node({position: [290, -450], scale: 0});
  timer.add(<Circle size={210} fill={WHITE} stroke={SAND} lineWidth={18} />);
  const ring = new Circle({size: 210, stroke: TERRA, lineWidth: 18, startAngle: -90, endAngle: -90, lineCap: 'round'});
  timer.add(ring);
  timer.add(<Txt text="1 menit" fontFamily={ROUND} fontWeight={800} fontSize={44} fill={INK} />);
  stage().add(timer);
  yield* pop(timer);
  spawn(ring.endAngle(270, 1.2, linear));

  /* 8. Tanda bahaya: segera ke dokter */
  yield* until(c.tapi - 0.2);
  yield* all(fade(leg), fade(tip), fade(timer));
  const row: [() => Node, string, string][] = [[boltIcon, 'Nyeri parah', 'parah'], [swellIcon, 'Otot bengkak', 'bengkak'], [teaGlass, 'Urine gelap seperti teh', 'urine']];
  for (let i = 0; i < row.length; i++) {
    yield* until(c[row[i][2]] - 0.15);
    const item = card(820, 230);
    item.position([0, -560 + i * 260]);
    item.scale(0);
    const icon = row[i][0]();
    icon.position([-270, 0]);
    icon.scale(0.8);
    item.add(icon);
    item.add(<Txt x={-130} offset={[-1, 0]} width={530} textWrap text={row[i][1]} fontFamily={ROUND} fontWeight={800} fontSize={52} fill={INK} />);
    stage().add(item);
    yield* pop(item, 0.45);
  }
  yield* until(c.segera - 0.15);
  const doctor = new Rect({position: [0, -780], layout: true, gap: 20, alignItems: 'center', padding: [14, 40], radius: 60, fill: TERRA, scale: 0, opacity: 0,
    children: [<Txt text="Segera ke dokter" fontFamily={ROUND} fontWeight={800} fontSize={54} fill={WHITE} />]});
  stage().add(doctor);
  const doc = doctorIcon();
  doc.position([0, 260]);
  doc.scale(0);
  stage().add(doc);
  yield* all(pop(doctor), pop(doc));
  yield* until(job.duration);
  yield* waitFor(0);
}

