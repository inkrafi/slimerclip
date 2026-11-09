/**
 * Short akun pijat: kenapa dipijat bikin ngantuk. Tubuh pindah ke mode istirahat; tekanan sedang lebih menenangkan.
 * Ilustrasi hangat dan membulat. Tiap adegan berganti pada kata yang diucapkan.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutSine, easeOutBack, easeOutCubic, spawn, ThreadGenerator, waitFor} from '@revideo/core';
import {boltIcon} from './krek';
import {backBody, card, hand} from './leher';
import {
  backdrop, captions, chip, fade, GOLD, HAIR, INK, PEACH, pop, rise, ROUND, SAGE, SAGE_DARK, SAND, SKIN, SOFT_INK, TERRA, until, WHITE, Word,
} from './system';

const OUTLINE = 7;

/* ---------- Ilustrasi ---------- */

/** Orang tengkurap di meja pijat, tampak samping. Kelopak mata bisa menutup. */
function lying() {
  const root = new Node({});
  root.add(<Rect y={150} size={[880, 60]} radius={24} fill="#B58863" stroke={INK} lineWidth={OUTLINE} />);
  for (const x of [-360, 360]) root.add(<Rect x={x} y={300} size={[40, 260]} radius={14} fill="#9C6B3E" stroke={INK} lineWidth={6} />);
  root.add(<Rect x={60} y={80} size={[640, 110]} radius={55} fill={SAGE} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect x={-300} y={95} size={[90, 80]} radius={30} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  const head = new Node({position: [-390, 70]});
  head.add(<Circle size={170} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  head.add(<Circle size={176} startAngle={180} endAngle={330} closed fill={HAIR} />);
  const openEye = new Circle({x: -20, y: 22, size: 18, fill: INK});
  const lid = new Line({points: [[-38, 22], [-20, 32], [-2, 22]], stroke: INK, lineWidth: 6, lineCap: 'round', opacity: 0});
  head.add(openEye);
  head.add(lid);
  head.add(<Circle x={-48} y={48} size={30} fill={PEACH} opacity={0.8} />);
  root.add(head);
  const hands = [-40, 200].map(x => {
    const h = hand();
    h.position([x, -20]);
    root.add(h);
    return h;
  });
  return {root, openEye, lid, hands};
}

function zzz() {
  const root = new Node({opacity: 0});
  [[0, 0, 60], [50, -60, 74], [110, -130, 90]].forEach(([x, y, size]) => root.add(<Txt x={x} y={y} text="z" fontFamily={ROUND} fontWeight={800} fontSize={size} fill={SAGE_DARK} />));
  return root;
}

function moon() {
  const root = new Node({});
  root.add(<Circle size={120} fill={GOLD} stroke={INK} lineWidth={6} />);
  root.add(<Circle x={36} y={-24} size={100} fill={WHITE} />);
  return root;
}

/** Kartu dua mode tubuh dan sakelar di antaranya */
function modes() {
  const root = new Node({});
  const alert = card(390, 420);
  alert.position([-215, 0]);
  const bolt = boltIcon();
  bolt.y(-60);
  alert.add(bolt);
  alert.add(<Txt y={90} text="Mode siaga" fontFamily={ROUND} fontWeight={800} fontSize={50} fill={INK} />);
  alert.add(<Txt y={150} text="hadapi tekanan" fontFamily={ROUND} fontWeight={800} fontSize={36} fill={SOFT_INK} />);
  const rest = card(390, 420);
  rest.position([215, 0]);
  const m = moon();
  m.y(-60);
  rest.add(m);
  rest.add(<Txt y={90} text="Mode istirahat" fontFamily={ROUND} fontWeight={800} fontSize={50} fill={INK} />);
  rest.add(<Txt y={150} text="memulihkan diri" fontFamily={ROUND} fontWeight={800} fontSize={36} fill={SOFT_INK} />);
  alert.opacity(0.35);
  rest.opacity(0.35);
  root.add(alert);
  root.add(rest);
  const track = new Rect({y: 300, size: [260, 100], radius: 50, fill: SAND, stroke: INK, lineWidth: OUTLINE});
  const knob = new Circle({x: -80, y: 300, size: 80, fill: TERRA, stroke: INK, lineWidth: 6});
  root.add(track);
  root.add(knob);
  return {root, alert, rest, knob, track};
}

function heart(scale = 1) {
  const root = new Node({scale});
  root.add(<Line points={[[0, 70], [-80, -5], [-80, -50], [-50, -80], [-15, -75], [0, -50], [15, -75], [50, -80], [80, -50], [80, -5]]} closed radius={30} fill={TERRA} stroke={INK} lineWidth={6} lineJoin="round" />);
  return root;
}

function pressureIcon(scale = 1) {
  const root = new Node({scale});
  root.add(<Circle size={160} startAngle={180} endAngle={360} closed fill={WHITE} stroke={INK} lineWidth={6} />);
  root.add(<Line points={[[0, 0], [-55, -40]]} stroke={INK} lineWidth={9} lineCap="round" />);
  root.add(<Circle size={22} fill={INK} />);
  return root;
}

function calmIcon(scale = 1) {
  const root = new Node({scale});
  root.add(<Circle size={150} fill={SKIN} stroke={INK} lineWidth={6} />);
  for (const x of [-28, 28]) root.add(<Circle x={x} y={-6} size={34} startAngle={20} endAngle={160} stroke={INK} lineWidth={6} />);
  root.add(<Circle y={24} size={50} startAngle={20} endAngle={160} stroke={INK} lineWidth={6} />);
  return root;
}

function feather(scale = 1) {
  const root = new Node({scale, rotation: -30});
  root.add(<Circle size={[90, 260]} fill={WHITE} stroke={INK} lineWidth={6} />);
  root.add(<Line points={[[0, -120], [0, 170]]} stroke={INK} lineWidth={6} lineCap="round" />);
  for (let i = 0; i < 5; i++) root.add(<Line points={[[0, -70 + i * 38], [i % 2 ? 30 : -30, -90 + i * 38]]} stroke={SOFT_INK} lineWidth={4} lineCap="round" />);
  return root;
}

/* ---------- Thumbnail ----------
 * Satu fokus: orang ketiduran di meja pijat. Pertanyaan relatable.
 */
export function* ngantukThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const scene = lying();
  scene.root.position([40, 140]);
  scene.root.scale(1.05);
  scene.openEye.opacity(0);
  scene.lid.opacity(1);
  view.add(scene.root);
  const z = zzz();
  z.opacity(1);
  z.position([-330, -60]);
  z.scale(1.3);
  view.add(z);
  view.add(<Txt y={-600} text="Dipijat 5 menit" fontFamily={ROUND} fontWeight={800} fontSize={96} fill={INK} />);
  view.add(<Rect y={-470} layout padding={[10, 44]} radius={60} fill={TERRA} rotation={-3}>
    <Txt text="langsung ngantuk?" fontFamily={ROUND} fontWeight={800} fontSize={100} fill={WHITE} />
  </Rect>);
  view.add(<Rect y={-330} layout padding={[14, 36]} radius={50} fill={WHITE} shadowColor="#4B342833" shadowBlur={30}>
    <Txt text="ini yang terjadi di tubuhmu" fontFamily={ROUND} fontWeight={800} fontSize={50} fill={SAGE_DARK} />
  </Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* ngantuk(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={10} scale={1.1} />);
  captions(view, job.words as Word[], 650, 58, job.duration);

  /* 1. Baru lima menit dipijat, mata langsung berat */
  const scene = lying();
  scene.root.position([40, -280]);
  scene.root.scale(0.9);
  stage().add(scene.root);
  yield* rise(scene.root, 0.5);
  spawn(function* () {
    for (let i = 0; i < 6; i++) yield* all(...scene.hands.map(h => h.scale(0.9, 0.3, easeInOutSine).to(1, 0.3, easeInOutSine)));
  });
  const timer = chip('5 menit', SAGE_DARK, 50);
  timer.position([0, -720]);
  stage().add(timer);
  yield* pop(timer);
  yield* until(c.mata - 0.15);
  yield* all(scene.openEye.opacity(0, 0.4), scene.lid.opacity(1, 0.4));
  const z = zzz();
  z.position([-360, -460]);
  stage().add(z);
  yield* z.opacity(1, 0.4);
  spawn(z.y(-490, 1.2, easeInOutSine).to(-460, 1.2, easeInOutSine));
  yield* until(c.kenapa - 0.15);
  const why = new Txt({x: 300, y: -560, text: '?', fontFamily: ROUND, fontWeight: 800, fontSize: 160, fill: TERRA, scale: 0});
  stage().add(why);
  yield* why.scale(1, 0.35, easeOutBack);

  /* 2. Dua mode: siaga dan istirahat */
  yield* until(c.tubuh - 0.2);
  yield* all(fade(scene.root), fade(z), fade(why), fade(timer));
  const two = modes();
  two.root.position([0, -330]);
  stage().add(two.root);
  yield* rise(two.root, 0.5);
  yield* until(c.siaga - 0.15);
  yield* all(two.alert.opacity(1, 0.3), two.alert.scale(1.05, 0.3), two.knob.fill(TERRA, 0.2));
  yield* until(c.istirahat - 0.15);
  yield* all(two.alert.opacity(0.35, 0.3), two.alert.scale(1, 0.3), two.rest.opacity(1, 0.3), two.rest.scale(1.05, 0.3));

  /* 3. Saat dipijat, pindah ke mode istirahat */
  yield* until(c.pindah - 0.2);
  yield* all(two.knob.x(80, 0.6, easeInOutSine), two.knob.fill(SAGE_DARK, 0.6), two.track.fill('#CFE0C8', 0.6));

  /* 4. Puluhan penelitian: detak jantung, tekanan darah, rasa cemas turun */
  yield* until(c.analisis - 0.2);
  yield* fade(two.root);
  const study = chip('Analisis puluhan penelitian', SAGE_DARK, 48);
  study.position([0, -735]);
  stage().add(study);
  const stack = new Node({y: -380});
  for (let i = 0; i < 5; i++) {
    const p = new Node({x: -240 + i * 120, scale: 0});
    p.add(<Rect size={[96, 124]} radius={12} fill={WHITE} stroke={INK} lineWidth={5} />);
    for (let k = 0; k < 4; k++) p.add(<Rect y={-34 + k * 22} size={[60 - (k === 3 ? 22 : 0), 9]} radius={4} fill={SAND} />);
    stack.add(p);
  }
  stage().add(stack);
  yield* all(pop(study), ...stack.children().map((p, i) => function* () {
    yield* waitFor(i * 0.06);
    yield* p.scale(1, 0.3, easeOutBack);
  }()));
  const once = new Txt({y: -620, text: 'setelah 1 sesi pijat', fontFamily: ROUND, fontWeight: 800, fontSize: 46, fill: SOFT_INK, opacity: 0});
  stage().add(once);
  yield* until(c.satu - 0.15);
  yield* once.opacity(1, 0.3);
  const items: [() => Node, string, string][] = [[() => heart(0.9), 'Detak jantung', 'detak'], [() => pressureIcon(0.9), 'Tekanan darah', 'tekanan2'], [() => calmIcon(0.8), 'Rasa cemas', 'rasa']];
  const rows: Node[] = [];
  for (let i = 0; i < items.length; i++) {
    yield* until(c[items[i][2]] - 0.15);
    if (i === 0) yield* fade(stack, 0.2);
    const row = card(820, 200);
    row.position([0, -440 + i * 230]);
    row.scale(0);
    const icon = items[i][0]();
    icon.position([-290, i === 1 ? 30 : 0]);
    row.add(icon);
    row.add(<Txt x={-170} offset={[-1, 0]} text={items[i][1]} fontFamily={ROUND} fontWeight={800} fontSize={56} fill={INK} />);
    const down = new Line({points: [[0, -45], [0, 45]], x: 320, stroke: SAGE_DARK, lineWidth: 16, endArrow: true, arrowSize: 34, lineCap: 'round', end: 0});
    row.add(down);
    stage().add(row);
    rows.push(row);
    yield* all(pop(row, 0.4), down.end(1, 0.5, easeOutCubic));
  }

  /* 5. Tekanan berpengaruh: tekanan sedang lebih menenangkan daripada terlalu ringan */
  yield* until(c.bukan - 0.2);
  yield* all(fade(study), fade(once), ...rows.map(r => fade(r)));
  const pressTitle = chip('Tekanan juga berpengaruh', TERRA, 52);
  pressTitle.position([0, -735]);
  stage().add(pressTitle);
  yield* pop(pressTitle);
  yield* until(c.penelitian2 - 0.15);
  const light = card(390, 460);
  light.position([-215, -340]);
  light.scale(0);
  const f = feather(0.8);
  f.y(-60);
  light.add(f);
  light.add(<Txt y={150} text="terlalu ringan" fontFamily={ROUND} fontWeight={800} fontSize={44} fill={INK} />);
  const medium = card(390, 460);
  medium.position([215, -340]);
  medium.scale(0);
  const press = hand();
  press.y(-60);
  press.scale(1.2);
  medium.add(press);
  medium.add(<Line points={[[0, -200], [0, -140]]} stroke={TERRA} lineWidth={12} endArrow arrowSize={26} lineCap="round" />);
  medium.add(<Txt y={150} text="tekanan sedang" fontFamily={ROUND} fontWeight={800} fontSize={44} fill={INK} />);
  stage().add(light);
  stage().add(medium);
  yield* all(pop(light), pop(medium));
  yield* until(c.sedang - 0.15);
  const winner = chip('lebih menenangkan', SAGE_DARK, 44);
  winner.position([215, -40]);
  stage().add(winner);
  yield* all(medium.scale(1.06, 0.3), pop(winner));
  spawn(function* () {
    for (let i = 0; i < 4; i++) yield* press.scale(1.05, 0.3, easeInOutSine).to(1.2, 0.3, easeInOutSine);
  });
  yield* until(c.ringan - 0.15);
  yield* light.opacity(0.4, 0.4);

  /* 6. Tekan dengan mantap tapi tetap nyaman */
  yield* until(c.jadi - 0.2);
  yield* all(fade(pressTitle), fade(light), fade(medium), fade(winner));
  const back = backBody();
  back.root.position([0, -280]);
  stage().add(back.root);
  const handsOn = [-1, 1].map(side => {
    const h = hand();
    h.position([side * 190, 160]);
    h.rotation(side * 25);
    back.root.add(h);
    return h;
  });
  yield* rise(back.root, 0.45);
  yield* until(c.tekan - 0.15);
  const firm = chip('mantap, tapi nyaman', TERRA, 52);
  firm.position([0, -735]);
  stage().add(firm);
  yield* pop(firm);
  spawn(function* () {
    for (let i = 0; i < 4; i++) yield* all(...handsOn.map(h => h.scale(0.88, 0.35, easeInOutSine).to(1, 0.35, easeInOutSine)));
  });

  /* 7. Ketiduran itu wajar: tubuh lagi istirahat */
  yield* until(c.dan - 0.2);
  yield* all(fade(back.root), fade(firm));
  const sleep = lying();
  sleep.root.position([40, -300]);
  sleep.root.scale(0.9);
  sleep.openEye.opacity(0);
  sleep.lid.opacity(1);
  stage().add(sleep.root);
  yield* rise(sleep.root, 0.45);
  const z2 = zzz();
  z2.position([-360, -480]);
  stage().add(z2);
  yield* z2.opacity(1, 0.4);
  spawn(z2.y(-510, 1.2, easeInOutSine).to(-480, 1.2, easeInOutSine));
  yield* until(c.wajar - 0.15);
  const ok = chip('Wajar, tubuh lagi istirahat', SAGE_DARK, 52);
  ok.position([0, -720]);
  stage().add(ok);
  yield* pop(ok);
  const glow = new Circle({position: [0, -300], size: 700, fill: GOLD, opacity: 0});
  stage().insert(glow, 0);
  yield* glow.opacity(0.18, 1);
  yield* until(job.duration);
  yield* waitFor(0);
}

