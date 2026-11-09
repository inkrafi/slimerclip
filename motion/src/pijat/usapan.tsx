/**
 * Short akun pijat: kecepatan usapan yang paling disukai kulit (saraf C-taktil, sekitar 3 cm per detik).
 * Semua ilustrasi digambar kode, hangat dan membulat. Tiap adegan berganti pada kata yang diucapkan.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutSine, easeOutCubic, linear, spawn, ThreadGenerator, tween, waitFor} from '@revideo/core';
import {card, check, hand} from './leher';
import {
  backdrop, captions, chip, fade, GOLD, HAIR, INK, PEACH, pop, rise, ROUND, SAGE, SAGE_DARK, SAND, SKIN, SKIN_DARK, SOFT_INK, TERRA, until, WHITE, Word,
} from './system';

const OUTLINE = 7;

/* ---------- Ilustrasi ---------- */

/** Potongan kulit: lapisan atas, bulu halus, dan serabut saraf yang menyambung ke akar bulu */
function skinSection() {
  const root = new Node({});
  const frame = new Rect({size: [860, 560], radius: 44, fill: SAND, stroke: INK, lineWidth: OUTLINE, clip: true});
  root.add(frame);
  frame.add(<Rect y={-170} size={[860, 220]} fill={WHITE} opacity={0.5} />);
  frame.add(<Rect y={-110} size={[860, 110]} fill={PEACH} />);
  frame.add(<Rect y={-55} size={[860, 10]} fill={SKIN_DARK} opacity={0.5} />);
  const hairs = [-300, -150, 0, 150, 300];
  for (const x of hairs) {
    frame.add(<Line points={[[x, 10], [x + 10, -160], [x + 34, -250]]} stroke={HAIR} lineWidth={8} lineCap="round" />);
    frame.add(<Circle x={x} y={20} size={[34, 50]} fill={SKIN_DARK} stroke={INK} lineWidth={4} />);
  }
  const nerve = new Line({points: [[-460, 230], [-300, 170], [-150, 200], [0, 160], [150, 200], [300, 170], [460, 220]], stroke: GOLD, lineWidth: 12, lineCap: 'round', radius: 60, end: 0});
  frame.add(nerve);
  const twigs: Line[] = hairs.map((x, i) => new Line({points: [[x, [170, 200, 160, 200, 170][i]], [x, 46]], stroke: GOLD, lineWidth: 8, lineCap: 'round', end: 0}));
  twigs.forEach(t => frame.add(t));
  return {root, frame, nerve, twigs};
}

/** Tampak belakang seluruh badan: lengan dan punggung bisa menyala */
export function figure() {
  const root = new Node({});
  const armL = new Line({points: [[-150, -170], [-215, 60], [-235, 250]], stroke: SKIN, lineWidth: 70, lineCap: 'round', lineJoin: 'round'});
  const armR = new Line({points: [[150, -170], [215, 60], [235, 250]], stroke: SKIN, lineWidth: 70, lineCap: 'round', lineJoin: 'round'});
  const edge = (l: Line) => new Line({points: l.points(), stroke: INK, lineWidth: 84, lineCap: 'round', lineJoin: 'round'});
  root.add(edge(armL));
  root.add(edge(armR));
  root.add(armL);
  root.add(armR);
  root.add(<Rect x={-70} y={370} size={[110, 300]} radius={45} fill={SOFT_INK} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect x={70} y={370} size={[110, 300]} radius={45} fill={SOFT_INK} stroke={INK} lineWidth={OUTLINE} />);
  const torso = new Rect({y: 30, size: [330, 420], radius: [130, 130, 50, 50], fill: SKIN, stroke: INK, lineWidth: OUTLINE});
  root.add(torso);
  root.add(<Rect y={-215} size={[90, 70]} radius={30} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Circle y={-320} size={200} fill={HAIR} stroke={INK} lineWidth={OUTLINE} />);
  const glowArms = [armL, armR].map(a => new Line({points: a.points(), stroke: SAGE, lineWidth: 70, lineCap: 'round', lineJoin: 'round', opacity: 0}));
  glowArms.forEach(g => root.add(g));
  const glowBack = new Rect({y: 30, size: [330, 420], radius: [130, 130, 50, 50], fill: SAGE, opacity: 0});
  root.add(glowBack);
  const dots = new Node({opacity: 0});
  for (let i = 0; i < 26; i++) {
    const onArm = i < 12;
    const side = i % 2 ? 1 : -1;
    const x = onArm ? side * (190 + (i % 3) * 14) : -110 + (i % 5) * 55;
    const y = onArm ? -100 + Math.floor(i / 2) * 55 : -110 + Math.floor((i - 12) / 5) * 70;
    dots.add(<Line points={[[x, y], [x + 6, y - 14]]} stroke={HAIR} lineWidth={5} lineCap="round" />);
  }
  root.add(dots);
  return {root, glowArms, glowBack, dots};
}

/** Grafik aktivitas saraf terhadap kecepatan usapan (skala logaritmik 0,3 sampai 30 cm per detik) */
function speedChart() {
  const root = new Node({});
  const W = 780;
  const H = 380;
  const x = (speed: number) => -W / 2 + ((Math.log10(speed) + 0.5) / 2) * W;
  const y = (level: number) => H / 2 - level * H;
  root.add(<Rect y={20} size={[W + 140, H + 260]} radius={44} fill={WHITE} shadowColor="#4B342826" shadowBlur={34} shadowOffsetY={12} />);
  root.add(<Txt x={-W / 2} y={-H / 2 - 70} offset={[-1, 0]} text="Aktivitas saraf" fontFamily={ROUND} fontWeight={800} fontSize={40} fill={SOFT_INK} />);
  root.add(<Line points={[[-W / 2, H / 2], [W / 2, H / 2]]} stroke={INK} lineWidth={6} lineCap="round" />);
  for (const [speed, label] of [[0.3, '0,3'], [1, '1'], [3, '3'], [10, '10'], [30, '30']] as [number, string][]) {
    root.add(<Txt x={x(speed)} y={H / 2 + 46} text={label} fontFamily={ROUND} fontWeight={800} fontSize={38} fill={INK} />);
  }
  root.add(<Txt y={H / 2 + 110} text="kecepatan usapan (cm/detik)" fontFamily={ROUND} fontWeight={800} fontSize={36} fill={SOFT_INK} />);
  const points: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const speed = 10 ** (-0.5 + (i / 40) * 2);
    const level = 0.08 + 0.85 * Math.exp(-((Math.log10(speed) - Math.log10(3)) ** 2) / (2 * 0.38 ** 2));
    points.push([x(speed), y(level)]);
  }
  const curve = new Line({points, stroke: TERRA, lineWidth: 14, lineCap: 'round', lineJoin: 'round', end: 0});
  root.add(curve);
  const peak = new Node({position: [x(3), y(0.93)], scale: 0, opacity: 0});
  peak.add(<Line points={[[0, 0], [0, H / 2 - y(0.93)]]} stroke={TERRA} lineWidth={5} lineDash={[14, 10]} />);
  peak.add(<Circle size={44} fill={TERRA} stroke={WHITE} lineWidth={8} />);
  root.add(peak);
  return {root, curve, peak, x, y};
}

function snail(scale = 1) {
  const root = new Node({scale});
  root.add(<Rect x={10} y={40} size={[190, 50]} radius={25} fill={SKIN_DARK} stroke={INK} lineWidth={6} />);
  root.add(<Circle x={-10} y={-10} size={120} fill={GOLD} stroke={INK} lineWidth={6} />);
  root.add(<Circle x={-10} y={-10} size={60} stroke={INK} lineWidth={6} startAngle={0} endAngle={300} />);
  root.add(<Line points={[[90, 20], [100, -30]]} stroke={INK} lineWidth={5} lineCap="round" />);
  root.add(<Circle x={100} y={-34} size={14} fill={INK} />);
  return root;
}

function rabbit(scale = 1) {
  const root = new Node({scale});
  root.add(<Rect x={-30} y={-90} size={[34, 100]} radius={17} fill={WHITE} stroke={INK} lineWidth={6} rotation={-12} />);
  root.add(<Rect x={22} y={-92} size={[34, 100]} radius={17} fill={WHITE} stroke={INK} lineWidth={6} rotation={10} />);
  root.add(<Circle size={120} fill={WHITE} stroke={INK} lineWidth={6} />);
  root.add(<Circle x={22} y={-6} size={14} fill={INK} />);
  for (const y of [-30, 0, 30]) root.add(<Line points={[[-150, y], [-90, y]]} stroke={SOFT_INK} lineWidth={7} lineCap="round" />);
  return root;
}

function thermometer() {
  const root = new Node({});
  root.add(<Rect y={-60} size={[70, 300]} radius={35} fill={WHITE} stroke={INK} lineWidth={OUTLINE} />);
  const level = new Rect({y: 80, offset: [0, 1], size: [34, 0], radius: 17, fill: TERRA});
  root.add(level);
  root.add(<Circle y={110} size={120} fill={TERRA} stroke={INK} lineWidth={OUTLINE} />);
  return {root, level};
}

function face(scale = 1) {
  const root = new Node({scale});
  root.add(<Circle size={300} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Circle y={-40} size={310} startAngle={185} endAngle={355} closed fill={HAIR} />);
  for (const x of [-60, 60]) root.add(<Circle x={x} y={10} size={56} startAngle={20} endAngle={160} stroke={INK} lineWidth={7} />);
  root.add(<Circle y={50} size={90} startAngle={20} endAngle={160} stroke={INK} lineWidth={8} />);
  root.add(<Circle x={-95} y={55} size={50} fill={PEACH} opacity={0.8} />);
  root.add(<Circle x={95} y={55} size={50} fill={PEACH} opacity={0.8} />);
  return root;
}

export function bookmark() {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Line points={[[-55, -80], [55, -80], [55, 85], [0, 45], [-55, 85]]} closed fill={TERRA} stroke={INK} lineWidth={OUTLINE} lineJoin="round" />);
  return root;
}

/* ---------- Thumbnail ----------
 * Satu fokus: tangan mengusap lengan dengan jejak hangat. Angka 3 cm/detik sebagai pemancing rasa penasaran.
 */
export function* usapanThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const arm = new Node({y: 80});
  arm.add(<Line points={[[-430, 0], [330, 0]]} stroke={INK} lineWidth={164} lineCap="round" />);
  arm.add(<Line points={[[-430, 0], [330, 0]]} stroke={SKIN} lineWidth={150} lineCap="round" />);
  arm.add(<Line points={[[-300, -10], [120, -10]]} stroke={GOLD} lineWidth={70} lineCap="round" opacity={0.55} />);
  const palm = hand();
  palm.position([150, -40]);
  palm.rotation(-80);
  palm.scale(1.5);
  arm.add(palm);
  view.add(arm);
  view.add(<Txt y={-560} text="Usapan paling enak" fontFamily={ROUND} fontWeight={800} fontSize={88} fill={INK} />);
  view.add(<Txt y={-450} text="kecepatannya cuma" fontFamily={ROUND} fontWeight={800} fontSize={66} fill={SOFT_INK} />);
  view.add(<Rect y={-300} layout padding={[10, 44]} radius={60} fill={TERRA} rotation={-3}>
    <Txt text="3 cm/detik" fontFamily={ROUND} fontWeight={800} fontSize={140} fill={WHITE} />
  </Rect>);
  view.add(<Rect y={420} layout padding={[18, 44]} radius={50} fill={WHITE} shadowColor="#4B342833" shadowBlur={30}>
    <Txt text="coba di lenganmu sekarang" fontFamily={ROUND} fontWeight={800} fontSize={52} fill={SAGE_DARK} />
  </Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* usapan(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={10} scale={1.1} />);
  captions(view, job.words as Word[], 650, 58, job.duration);

  /* 1. Ada saraf khusus untuk usapan lembut */
  const skin = skinSection();
  skin.root.position([0, -240]);
  stage().add(skin.root);
  yield* rise(skin.root, 0.6);
  yield* until(c.saraf - 0.15);
  yield* all(skin.nerve.end(1, 0.9, easeInOutSine), ...skin.twigs.map(t => t.end(1, 0.9, easeInOutSine)));
  yield* until(c.usapan - 0.2);
  const finger = hand();
  finger.rotation(-90);
  finger.scale(1.1);
  finger.position([-520, -340]);
  skin.root.add(finger);
  spawn(finger.position([520, -340], 2.4, linear));
  const pulses: Circle[] = [];
  for (let i = 0; i < 4; i++) {
    const dot = new Circle({size: 30, fill: WHITE, stroke: GOLD, lineWidth: 6, opacity: 0});
    skin.frame.add(dot);
    pulses.push(dot);
  }
  spawn(function* () {
    yield* tween(3.5, t => {
      pulses.forEach((dot, i) => {
        const p = (t * 2 + i * 0.25) % 1;
        dot.position(skin.nerve.getPointAtPercentage(p).position);
        dot.opacity(Math.sin(p * Math.PI));
      });
    }, linear);
    pulses.forEach(dot => dot.opacity(0));
  });
  yield* skin.nerve.stroke(TERRA, 0.4).to(GOLD, 0.6);

  /* 2. Saraf C-taktil ada di kulit berbulu: lengan dan punggung */
  yield* until(c.namanya - 0.2);
  yield* fade(skin.root);
  const name = chip('Saraf C-taktil', TERRA, 60);
  name.position([0, -720]);
  stage().add(name);
  const body = figure();
  body.root.position([0, -120]);
  body.root.scale(0.85);
  stage().add(body.root);
  yield* all(rise(body.root, 0.5));
  yield* until(c.ctaktil - 0.15);
  yield* pop(name);
  yield* until(c.berbulu - 0.15);
  yield* body.dots.opacity(1, 0.4);
  yield* until(c.lengan - 0.15);
  yield* all(...body.glowArms.map(g => g.opacity(0.75, 0.4)));
  yield* until(c.punggung - 0.15);
  yield* body.glowBack.opacity(0.7, 0.4);

  /* 3. Riset Swedia: paling aktif sekitar 3 cm per detik, kira-kira selebar dua jari */
  yield* until(c.peneliti - 0.2);
  yield* all(fade(body.root), fade(name));
  const study = chip('Riset di Swedia', SAGE_DARK, 48);
  study.position([0, -735]);
  stage().add(study);
  yield* pop(study);
  const chart = speedChart();
  chart.root.position([0, -190]);
  stage().add(chart.root);
  yield* rise(chart.root, 0.5);
  yield* until(c.paling - 0.15);
  yield* chart.curve.end(1, 1.2, easeInOutSine);
  yield* until(c.tiga - 0.15);
  const best = chip('± 3 cm/detik', TERRA, 54);
  best.position([chart.x(3), -620]);
  stage().add(best);
  yield* all(pop(chart.peak), pop(best));
  yield* until(c.selebar - 0.15);
  const fingers = new Node({position: [0, 330], scale: 0});
  for (const dx of [-36, 36]) fingers.add(<Rect x={dx} size={[66, 200]} radius={33} fill={SKIN} stroke={INK} lineWidth={6} />);
  fingers.add(<Line points={[[-70, 130], [70, 130]]} stroke={INK} lineWidth={6} startArrow endArrow arrowSize={18} />);
  fingers.add(<Txt y={180} text="± 3 cm" fontFamily={ROUND} fontWeight={800} fontSize={44} fill={INK} />);
  stage().add(fingers);
  yield* pop(fingers);

  /* 4. Lebih cepat atau lebih lambat: kurang enak */
  yield* until(c.cepat - 0.15);
  yield* fingers.opacity(0, 0.3);
  const fast = rabbit(0.8);
  fast.position([chart.x(20), 250]);
  fast.scale(0);
  stage().add(fast);
  yield* pop(fast);
  yield* until(c.lambat - 0.15);
  const slow = snail(0.8);
  slow.position([chart.x(0.5), 250]);
  slow.scale(0);
  stage().add(slow);
  yield* pop(slow);
  yield* until(c.kurang - 0.15);
  const meh = [chart.x(0.45), chart.x(22)].map(x => new Txt({x, y: 360, text: 'kurang enak', fontFamily: ROUND, fontWeight: 800, fontSize: 44, fill: SOFT_INK, opacity: 0}));
  meh.forEach(m => stage().add(m));
  yield* all(...meh.map(m => m.opacity(1, 0.3)));

  /* 5. Suka sentuhan hangat seperti suhu kulit: gosok tangan dulu */
  yield* until(c.saraf2 - 0.2);
  yield* all(fade(chart.root), fade(study), fade(best), fade(fast), fade(slow), ...meh.map(m => fade(m)));
  const thermo = thermometer();
  thermo.root.position([-250, -330]);
  stage().add(thermo.root);
  const warmChip = chip('Suka sentuhan hangat', TERRA, 52);
  warmChip.position([0, -735]);
  stage().add(warmChip);
  yield* all(rise(thermo.root, 0.5), pop(warmChip));
  yield* until(c.suhu - 0.15);
  const temp = new Txt({x: 120, y: -400, text: '± 32°C', fontFamily: ROUND, fontWeight: 800, fontSize: 110, fill: TERRA, opacity: 0});
  const tempNote = new Txt({x: 120, y: -300, text: 'suhu kulit', fontFamily: ROUND, fontWeight: 800, fontSize: 50, fill: SOFT_INK, opacity: 0});
  stage().add(temp);
  stage().add(tempNote);
  yield* all(thermo.level.height(200, 0.6, easeOutCubic), temp.opacity(1, 0.4), tempNote.opacity(1, 0.4));
  yield* until(c.gosok - 0.15);
  yield* all(thermo.root.opacity(0.0, 0.3), temp.y(-600, 0.4), tempNote.y(-510, 0.4));
  const rub = new Node({position: [0, -120]});
  const warmth = new Circle({size: 420, fill: GOLD, opacity: 0});
  rub.add(warmth);
  const left = hand();
  left.rotation(90);
  left.scale(1.4);
  left.position([-70, 0]);
  const right = hand();
  right.rotation(-90);
  right.scale(1.4);
  right.position([70, 0]);
  rub.add(left);
  rub.add(right);
  stage().add(rub);
  yield* rise(rub, 0.3);
  spawn(warmth.opacity(0.35, 0.8));
  spawn(function* () {
    for (let i = 0; i < 6; i++) yield* all(left.y(-40, 0.14, easeInOutSine).to(40, 0.28, easeInOutSine).to(0, 0.14), right.y(40, 0.14, easeInOutSine).to(-40, 0.28, easeInOutSine).to(0, 0.14));
  });

  /* 6. Coba: usap lengan bawah dari siku ke pergelangan, satu sampai delapan */
  yield* until(c.coba - 0.2);
  yield* all(fade(rub), fade(temp), fade(tempNote), fade(thermo.root), fade(warmChip));
  const forearm = new Node({position: [-20, -150], scale: 0.88});
  forearm.add(<Line points={[[-420, 0], [330, 0]]} stroke={INK} lineWidth={164} lineCap="round" />);
  forearm.add(<Line points={[[-420, 0], [330, 0]]} stroke={SKIN} lineWidth={150} lineCap="round" />);
  forearm.add(<Circle x={400} size={[170, 150]} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  const trail = new Line({points: [[-380, 0], [-380, 0]], stroke: GOLD, lineWidth: 80, lineCap: 'round', opacity: 0.55});
  forearm.add(trail);
  const elbow = new Txt({x: -400, y: 140, text: 'siku', fontFamily: ROUND, fontWeight: 800, fontSize: 48, fill: INK, opacity: 0});
  const wrist = new Txt({x: 300, y: 140, text: 'pergelangan', fontFamily: ROUND, fontWeight: 800, fontSize: 48, fill: INK, opacity: 0});
  forearm.add(elbow);
  forearm.add(wrist);
  const stroker = hand();
  stroker.rotation(-80);
  stroker.scale(1.3);
  stroker.position([-380, -50]);
  stroker.opacity(0);
  forearm.add(stroker);
  stage().add(forearm);
  const tip = chip('Coba sekarang', SAGE_DARK, 52);
  tip.position([0, -720]);
  stage().add(tip);
  yield* all(rise(forearm, 0.5), pop(tip));
  yield* until(c.usap - 0.15);
  yield* stroker.opacity(1, 0.3);
  yield* until(c.siku - 0.15);
  yield* elbow.opacity(1, 0.3);
  yield* until(c.pergelangan - 0.15);
  yield* wrist.opacity(1, 0.3);
  yield* until(c.satu - 0.1);
  const counter = new Txt({y: -470, text: '1', fontFamily: ROUND, fontWeight: 800, fontSize: 200, fill: TERRA});
  stage().add(counter);
  const counts = ['satu', 'dua', 'tiga2', 'empat', 'lima', 'enam', 'tujuh', 'delapan'];
  const from = -380;
  const to = 280;
  const start = c.satu;
  const finish = c.delapan + (c.delapan - c.tujuh);
  spawn(tween(finish - start, t => {
    const x = from + (to - from) * t;
    stroker.x(x);
    trail.points([[from, 0], [x, 0]]);
  }, linear));
  for (let i = 0; i < counts.length; i++) {
    yield* until(c[counts[i]] - 0.05);
    counter.text(String(i + 1));
    counter.scale(1.25);
    yield* counter.scale(1, 0.3, easeOutCubic);
  }

  /* 7. Pelan itu kuncinya, simpan video */
  yield* until(c.kalau - 0.2);
  yield* all(fade(forearm), fade(tip), fade(counter));
  const relax = face(1.1);
  relax.position([0, -320]);
  stage().add(relax);
  yield* rise(relax, 0.5);
  yield* until(c.kuncinya - 0.25);
  const key = chip('Pelan = rileks', TERRA, 60);
  key.position([0, -650]);
  stage().add(key);
  yield* pop(key);
  yield* until(c.simpan - 0.15);
  const save = bookmark();
  save.position([0, 0]);
  stage().add(save);
  const saveText = new Txt({y: 130, text: 'Simpan buat latihan', fontFamily: ROUND, fontWeight: 800, fontSize: 50, fill: INK, opacity: 0});
  stage().add(saveText);
  yield* all(pop(save), saveText.opacity(1, 0.3));
  const ok = check(90);
  ok.position([90, -60]);
  stage().add(ok);
  yield* pop(ok);
  yield* until(job.duration);
  yield* waitFor(0);
}
