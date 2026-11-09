/**
 * Short akun pijat: leher pegal gara-gara HP, lalu pijat pundak 30 detik.
 * Semua ilustrasi digambar kode dengan bentuk membulat dan warna hangat. Tiap adegan berganti pada kata yang diucapkan.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutSine, easeOutCubic, linear, spawn, ThreadGenerator, tween, waitFor} from '@revideo/core';
import {
  backdrop, captions, chip, fade, GOLD, HAIR, INK, PEACH, pop, rise, ROUND, SAGE, SAGE_DARK, SAND, SKIN, SKIN_DARK, SOFT_INK, TERRA, text, until, WHITE, Word,
} from './system';

const OUTLINE = 7;

/* ---------- Ilustrasi ---------- */

/** Tampak samping menghadap kanan. Kepala dan leher berputar pada pangkal leher. */
export function sideBody() {
  const root = new Node({});
  root.add(<Rect y={360} size={[440, 420]} radius={[190, 190, 40, 40]} fill={SAGE} stroke={INK} lineWidth={OUTLINE} />);
  const pivot = new Node({x: 20, y: 170});
  root.add(pivot);
  const neck = new Rect({y: -60, size: [118, 170], radius: 46, fill: SKIN, stroke: INK, lineWidth: OUTLINE});
  pivot.add(neck);
  const head = new Node({x: 18, y: -250});
  pivot.add(head);
  head.add(<Circle size={270} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  head.add(<Circle size={278} startAngle={150} endAngle={330} closed fill={HAIR} />);
  head.add(<Circle x={-18} y={14} size={56} fill={SKIN_DARK} stroke={INK} lineWidth={5} />);
  head.add(<Circle x={84} y={-8} size={20} fill={INK} />);
  head.add(<Circle x={130} y={22} size={40} fill={SKIN} stroke={INK} lineWidth={5} startAngle={-90} endAngle={90} />);
  head.add(<Line points={[[78, 62], [104, 66]]} stroke={INK} lineWidth={6} lineCap="round" />);
  head.add(<Circle x={60} y={40} size={34} fill={PEACH} opacity={0.7} />);
  return {root, pivot, neck, head};
}

function phoneShape(scale = 1) {
  const root = new Node({scale});
  root.add(<Rect size={[74, 136]} radius={16} fill={INK} />);
  root.add(<Rect size={[60, 110]} radius={10} fill="#9CC9C2" />);
  return root;
}

/** Lengan samping memegang HP. Titik siku dan tangan bisa digeser. */
function arm(hand: [number, number]) {
  const shoulder: [number, number] = [70, 230];
  const elbow: [number, number] = [150, 470];
  const line = new Line({points: [shoulder, elbow, hand], stroke: SKIN, lineWidth: 62, lineCap: 'round', lineJoin: 'round'});
  const edge = new Line({points: [shoulder, elbow, hand], stroke: INK, lineWidth: 62 + OUTLINE * 2, lineCap: 'round', lineJoin: 'round'});
  const phone = phoneShape(1.1);
  phone.position([hand[0] + 20, hand[1] - 40]);
  phone.rotation(-18);
  const root = new Node({});
  root.add(edge);
  root.add(line);
  root.add(phone);
  return {root, line, edge, phone};
}

/** Tampak belakang: kepala, leher, pundak. Pita otot antara leher dan bahu bisa menyala. */
export function backBody() {
  const root = new Node({});
  root.add(<Rect y={360} size={[620, 440]} radius={[220, 220, 40, 40]} fill={SAGE} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect y={120} size={[140, 180]} radius={50} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Circle x={-142} y={-40} size={62} fill={SKIN} stroke={INK} lineWidth={5} />);
  root.add(<Circle x={142} y={-40} size={62} fill={SKIN} stroke={INK} lineWidth={5} />);
  root.add(<Circle y={-60} size={290} fill={HAIR} stroke={INK} lineWidth={OUTLINE} />);
  const band = (side: number) => new Line({points: [[side * 70, 170], [side * 170, 185], [side * 262, 225]], stroke: TERRA, lineWidth: 70, lineCap: 'round', opacity: 0});
  const left = band(-1);
  const right = band(1);
  root.add(left);
  root.add(right);
  return {root, left, right};
}

/** Punggung tangan dengan jari mengarah ke bawah, menempel di pundak */
export function hand() {
  const root = new Node({});
  [-42, -14, 14, 42].forEach((x, i) => root.add(<Rect x={x} y={70 + (i === 0 || i === 3 ? -8 : 0)} size={[30, 92]} radius={15} fill={SKIN} stroke={INK} lineWidth={5} />));
  root.add(<Rect size={[124, 120]} radius={46} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Line points={[[-30, -10], [30, -10]]} stroke={SKIN_DARK} lineWidth={5} lineCap="round" />);
  return root;
}

function watermelon(scale = 1) {
  const root = new Node({scale});
  root.add(<Circle size={[250, 210]} fill="#5C9A5A" stroke={INK} lineWidth={OUTLINE} />);
  [-70, -25, 25, 70].forEach(x => root.add(<Line points={[[x, -95], [x * 1.15, 0], [x, 95]]} stroke="#2F6B37" lineWidth={14} lineCap="round" />));
  root.add(<Circle x={-60} y={-55} size={40} fill="#ffffff33" />);
  return root;
}

function child(scale = 1) {
  const root = new Node({scale});
  root.add(<Rect y={120} size={[150, 170]} radius={[70, 70, 20, 20]} fill={GOLD} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect x={-38} y={250} size={[52, 110]} radius={22} fill={SOFT_INK} stroke={INK} lineWidth={5} />);
  root.add(<Rect x={38} y={250} size={[52, 110]} radius={22} fill={SOFT_INK} stroke={INK} lineWidth={5} />);
  root.add(<Circle size={140} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Circle y={-20} size={146} startAngle={190} endAngle={350} closed fill={HAIR} />);
  root.add(<Circle x={-26} y={10} size={14} fill={INK} />);
  root.add(<Circle x={26} y={10} size={14} fill={INK} />);
  root.add(<Line points={[[-18, 40], [0, 50], [18, 40]]} stroke={INK} lineWidth={5} lineCap="round" />);
  return root;
}

export function card(width: number, height: number) {
  return new Rect({size: [width, height], radius: 40, fill: WHITE, shadowColor: '#4B342826', shadowBlur: 34, shadowOffsetY: 12});
}

export function cross(size = 120, fill = TERRA) {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Circle size={size} fill={fill} />);
  root.add(<Line points={[[-size * 0.2, -size * 0.2], [size * 0.2, size * 0.2]]} stroke={WHITE} lineWidth={size * 0.12} lineCap="round" />);
  root.add(<Line points={[[size * 0.2, -size * 0.2], [-size * 0.2, size * 0.2]]} stroke={WHITE} lineWidth={size * 0.12} lineCap="round" />);
  return root;
}

export function check(size = 120) {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Circle size={size} fill={SAGE_DARK} />);
  root.add(<Line points={[[-size * 0.22, 0], [-size * 0.05, size * 0.17], [size * 0.25, -size * 0.17]]} stroke={WHITE} lineWidth={size * 0.12} lineCap="round" lineJoin="round" />);
  return root;
}

function calendarIcon() {
  const root = new Node({});
  root.add(<Rect size={[170, 170]} radius={30} fill={WHITE} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect y={-58} size={[170, 54]} radius={[30, 30, 0, 0]} fill={TERRA} stroke={INK} lineWidth={OUTLINE} />);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) root.add(<Circle x={-48 + c * 48} y={10 + r * 46} size={24} fill={SAND} />);
  return root;
}

function tingleIcon() {
  const root = new Node({});
  const h = hand();
  h.rotation(180);
  h.scale(1.1);
  root.add(h);
  for (const [x, y, r] of [[-110, -40, -20], [110, -30, 20], [-95, 70, -30], [100, 80, 30]]) {
    root.add(<Line x={x} y={y} rotation={r} points={[[-18, -20], [0, -8], [-14, 6], [6, 20]]} stroke={GOLD} lineWidth={8} lineCap="round" lineJoin="round" />);
  }
  return root;
}

export function doctorIcon() {
  const root = new Node({});
  root.add(<Circle size={180} fill={WHITE} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect size={[40, 110]} radius={10} fill={TERRA} />);
  root.add(<Rect size={[110, 40]} radius={10} fill={TERRA} />);
  return root;
}

/* ---------- Thumbnail ----------
 * Satu fokus: orang menunduk dengan leher menyala. Teks 4 kata, angka sebagai pemancing, tidak mengulang judul.
 * Isi penting di tengah 1080x1440 karena grid profil TikTok memotong cover jadi 3:4.
 */
export function* leherThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const person = sideBody();
  person.root.position([-190, -70]);
  person.root.scale(1.2);
  person.pivot.rotation(60);
  const holding = arm([300, 330]);
  person.root.insert(holding.root, 1);
  person.root.insert(new Circle({x: 30, y: 150, size: 300, fill: TERRA, opacity: 0.55}), 1);
  person.root.insert(new Circle({x: 30, y: 150, size: 420, fill: TERRA, opacity: 0.18}), 1);
  view.add(person.root);
  view.add(<Txt y={-560} text="LEHERMU NAHAN" fontFamily={ROUND} fontWeight={800} fontSize={104} fill={INK} />);
  view.add(<Rect y={-405} layout padding={[10, 44]} radius={60} fill={TERRA} rotation={-3}>
    <Txt text="27 KG?!" fontFamily={ROUND} fontWeight={800} fontSize={150} fill={WHITE} />
  </Rect>);
  view.add(<Rect y={600} layout padding={[18, 44]} radius={50} fill={WHITE} shadowColor="#4B342833" shadowBlur={30}>
    <Txt text="+ cara pijatnya 30 detik" fontFamily={ROUND} fontWeight={800} fontSize={52} fill={SAGE_DARK} />
  </Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* leher(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={10} scale={1.15} />);
  captions(view, job.words as Word[], 650, 58, job.duration);

  /* 1. Kepala sekitar 5 kg, seberat semangka kecil */
  const person = sideBody();
  const body = person.root;
  body.position([-110, -260]);
  stage().add(body);
  yield* rise(body, 0.7);
  const glowHead = new Circle({size: 330, fill: GOLD, opacity: 0});
  person.head.insert(glowHead, 0);
  yield* until(c.lima - 0.15);
  const weight = chip('± 5 kg', TERRA, 60);
  weight.position([300, -660]);
  stage().add(weight);
  yield* all(glowHead.opacity(0.35, 0.4), pop(weight));
  yield* until(c.semangka - 0.15);
  const melon = watermelon(1);
  melon.position([300, -440]);
  melon.scale(0);
  stage().add(melon);
  const equal = new Txt({x: 300, y: -598, text: '=', fontFamily: ROUND, fontWeight: 800, fontSize: 80, fill: SOFT_INK, opacity: 0});
  stage().add(equal);
  yield* all(pop(melon, 0.5), equal.opacity(1, 0.4));

  /* 2. Nunduk lihat HP: leher menahan beban lebih berat */
  yield* until(c.tapi - 0.2);
  yield* all(fade(weight), fade(melon), fade(equal), glowHead.opacity(0, 0.4), body.position([-60, -230], 0.6, easeInOutSine));
  const holding = arm([300, 330]);
  holding.root.opacity(0);
  body.insert(holding.root, 1);
  yield* holding.root.opacity(1, 0.4);
  yield* until(c.nunduk - 0.2);
  yield* person.pivot.rotation(45, 0.9, easeInOutSine);
  yield* until(c.leher - 0.15);
  const neckGlow = new Circle({x: 30, y: 150, size: 230, fill: TERRA, opacity: 0});
  body.insert(neckGlow, 1);
  yield* neckGlow.opacity(0.45, 0.5);
  spawn(function* () {
    for (let i = 0; i < 6; i++) yield* neckGlow.scale(1.12, 0.5, easeInOutSine).to(1, 0.5, easeInOutSine);
  });

  /* 3. Menunduk 60 derajat: beban sekitar 27 kg, seberat anak 8 tahun */
  yield* until(c.menurut - 0.15);
  const doc = chip('hitungan dokter tulang belakang', SAGE_DARK, 40);
  doc.position([20, -680]);
  stage().add(doc);
  yield* pop(doc);
  yield* until(c.enam - 0.2);
  yield* person.pivot.rotation(60, 0.6, easeInOutSine);
  const angle = new Node({position: [20, 170], opacity: 0});
  angle.add(<Line points={[[0, 0], [0, -330]]} stroke={SOFT_INK} lineWidth={6} lineDash={[18, 14]} />);
  angle.add(<Circle size={300} startAngle={-90} endAngle={-30} stroke={GOLD} lineWidth={14} />);
  angle.add(<Txt x={70} y={-380} text="60°" fontFamily={ROUND} fontWeight={800} fontSize={66} fill={INK} />);
  body.add(angle);
  yield* angle.opacity(1, 0.4);
  yield* until(c.dua - 0.2);
  yield* fade(doc, 0.3);
  const gauge = card(380, 210);
  gauge.position([270, -600]);
  gauge.scale(0);
  const kilo = createRef<Txt>();
  gauge.add(<Txt ref={kilo} y={-6} text="5 kg" fontFamily={ROUND} fontWeight={800} fontSize={110} fill={TERRA} />);
  gauge.add(<Txt y={-82} text="beban di leher" fontFamily={ROUND} fontWeight={800} fontSize={34} fill={SOFT_INK} />);
  stage().add(gauge);
  yield* pop(gauge);
  yield* tween(1.0, t => kilo().text(`${Math.round(5 + 22 * easeOutCubic(t))} kg`));
  yield* until(c.anak - 0.2);
  const kid = child(0.95);
  kid.position([-280, -640]);
  kid.scale(0);
  stage().add(kid);
  const kidLabel = new Txt({x: -280, y: -300, text: '≈ anak 8 tahun', fontFamily: ROUND, fontWeight: 800, fontSize: 44, fill: INK, opacity: 0});
  stage().add(kidLabel);
  yield* all(pop(kid, 0.5), kidLabel.opacity(1, 0.4));

  /* 4. Leher dan pundak gampang pegal */
  yield* until(c.nggak - 0.25);
  yield* all(fade(body), fade(gauge), fade(kid), fade(kidLabel));
  const back = backBody();
  back.root.position([0, -320]);
  stage().add(back.root);
  yield* rise(back.root, 0.5);
  yield* until(c.pundak - 0.15);
  yield* all(back.left.opacity(0.75, 0.4), back.right.opacity(0.75, 0.4));
  const ache: Line[] = [];
  for (const side of [-1, 1]) {
    for (const [dx, dy] of [[150, 90], [250, 120]]) {
      const squiggle = new Line({x: side * dx, y: dy, points: [[-26, 0], [-13, -14], [0, 0], [13, -14], [26, 0]], stroke: TERRA, lineWidth: 8, lineCap: 'round', lineJoin: 'round', opacity: 0});
      back.root.add(squiggle);
      ache.push(squiggle);
    }
  }
  yield* all(...ache.map(a => a.opacity(1, 0.3)));
  spawn(function* () {
    for (let i = 0; i < 4; i++) yield* all(...ache.map(a => a.y(a.y() - 12, 0.25).to(a.y(), 0.25)));
  });

  /* 5. Pijat 30 detik: tangan kanan di pundak kiri, tekan, memutar, tarik napas, ganti sisi */
  yield* until(c.yuk - 0.2);
  yield* all(...ache.map(a => a.opacity(0, 0.3)), back.left.opacity(0, 0.3), back.right.opacity(0, 0.3));
  const title = chip('Pijat pundak 30 detik', TERRA, 54);
  title.position([0, -700]);
  stage().add(title);
  yield* pop(title);
  yield* until(c.letakkan - 0.2);
  const forearm = new Node({opacity: 0});
  const armEdge = new Line({points: [[260, 520], [-150, 190]], stroke: INK, lineWidth: 76, lineCap: 'round'});
  const armFill = new Line({points: [[260, 520], [-150, 190]], stroke: SKIN, lineWidth: 62, lineCap: 'round'});
  forearm.add(armEdge);
  forearm.add(armFill);
  const palm = hand();
  palm.position([-170, 175]);
  palm.rotation(-25);
  forearm.add(palm);
  back.root.add(forearm);
  forearm.y(120);
  yield* all(forearm.opacity(1, 0.4), forearm.y(0, 0.7, easeOutCubic));
  yield* until(c.otot - 0.15);
  const label = new Txt({x: -330, y: -20, width: 300, textWrap: true, textAlign: 'center', text: 'otot antara leher & bahu', fontFamily: ROUND, fontWeight: 800, fontSize: 40, fill: INK, opacity: 0});
  back.root.add(label);
  yield* all(back.left.opacity(0.5, 0.4), label.opacity(1, 0.4));
  yield* until(c.tekan - 0.1);
  const ripple = new Circle({x: -170, y: 190, size: 60, stroke: GOLD, lineWidth: 10, opacity: 0});
  back.root.add(ripple);
  for (let i = 0; i < 2; i++) {
    ripple.size(60);
    ripple.opacity(0.9);
    yield* all(palm.scale(0.9, 0.25, easeInOutSine), ripple.size(260, 0.6, easeOutCubic), ripple.opacity(0, 0.6));
    yield* palm.scale(1, 0.25, easeInOutSine);
  }
  yield* until(c.memutar - 0.15);
  yield* label.opacity(0, 0.3);
  const circle = new Circle({x: -170, y: 170, size: 230, stroke: GOLD, lineWidth: 10, lineDash: [26, 18], startAngle: 0, endAngle: 300, endArrow: true, arrowSize: 30, opacity: 0});
  back.root.add(circle);
  yield* circle.opacity(1, 0.3);
  spawn(function* () {
    yield* tween(9, t => {
      const a = t * Math.PI * 2 * 7;
      palm.position([-170 + Math.cos(a) * 18, 175 + Math.sin(a) * 14]);
      circle.rotation(t * 360 * 2);
    }, linear);
  });
  yield* until(c.tarik - 0.15);
  const breath = new Node({position: [310, -520], scale: 0});
  breath.add(<Circle size={210} fill={SAGE} opacity={0.35} />);
  const lungs = new Circle({size: 120, fill: SAGE});
  breath.add(lungs);
  breath.add(<Txt y={150} text="tarik napas" fontFamily={ROUND} fontWeight={800} fontSize={40} fill={SAGE_DARK} />);
  stage().add(breath);
  yield* pop(breath);
  spawn(lungs.size(200, 1.6, easeInOutSine).to(120, 1.6, easeInOutSine));
  yield* until(c.tiga - 0.15);
  const timer = new Node({position: [-310, -520], scale: 0});
  timer.add(<Circle size={200} fill={WHITE} stroke={SAND} lineWidth={18} />);
  const ring = new Circle({size: 200, stroke: TERRA, lineWidth: 18, startAngle: -90, endAngle: -90, lineCap: 'round'});
  timer.add(ring);
  timer.add(<Txt text="30 dtk" fontFamily={ROUND} fontWeight={800} fontSize={46} fill={INK} />);
  stage().add(timer);
  yield* pop(timer);
  spawn(ring.endAngle(270, 2.2, linear));
  yield* until(c.ganti - 0.15);
  const swap = new Line({points: [[-120, -10], [120, -10]], y: 0, stroke: SAGE_DARK, lineWidth: 14, startArrow: true, endArrow: true, arrowSize: 34, opacity: 0});
  back.root.add(swap);
  yield* all(swap.opacity(1, 0.25), circle.opacity(0, 0.25));
  armEdge.points([[-260, 520], [150, 190]]);
  armFill.points([[-260, 520], [150, 190]]);
  palm.position([170, 175]);
  palm.rotation(25);
  yield* all(back.left.opacity(0, 0.3), back.right.opacity(0.5, 0.3));
  yield* swap.opacity(0, 0.3);

  /* 6. Jangan tekan tulang leher atau bagian depan leher */
  yield* until(c.ingat - 0.2);
  yield* all(fade(back.root), fade(title), fade(breath), fade(timer));
  const side = sideBody();
  side.root.position([-60, -250]);
  stage().add(side.root);
  yield* rise(side.root, 0.5);
  const avoid = chip('Hindari', TERRA, 52);
  avoid.position([0, -700]);
  stage().add(avoid);
  yield* pop(avoid);
  yield* until(c.tulang - 0.15);
  const spine = new Node({opacity: 0});
  for (let i = 0; i < 4; i++) spine.add(<Circle x={-36} y={-110 + i * 36} size={26} fill={TERRA} />);
  side.pivot.add(spine);
  const noSpine = cross(110);
  noSpine.position([-180, 110]);
  side.root.add(noSpine);
  yield* all(spine.opacity(1, 0.2), pop(noSpine));
  yield* until(c.depan - 0.15);
  const noFront = cross(110);
  noFront.position([250, 70]);
  side.root.add(noFront);
  const frontMark = new Circle({x: 74, y: 100, size: 70, fill: TERRA, opacity: 0});
  side.root.add(frontMark);
  yield* all(pop(noFront), frontMark.opacity(0.6, 0.3));

  /* 7. Angkat HP sejajar mata */
  yield* until(c.setelah - 0.2);
  yield* all(fade(avoid), noSpine.opacity(0, 0.3), noFront.opacity(0, 0.3), frontMark.opacity(0, 0.3), spine.opacity(0, 0.3));
  const raise = arm([300, 330]);
  side.root.insert(raise.root, 1);
  yield* until(c.angkat - 0.15);
  const eyeLine = new Line({points: [[130, -100], [330, -100]], stroke: SAGE_DARK, lineWidth: 8, lineDash: [18, 12], end: 0});
  side.root.add(eyeLine);
  yield* tween(0.8, t => {
    const v = easeInOutSine(t);
    const handAt: [number, number] = [300 + 30 * v, 330 - 390 * v];
    const elbow: [number, number] = [150, 470 - 80 * v];
    const pts: [number, number][] = [[70, 230], elbow, handAt];
    raise.line.points(pts);
    raise.edge.points(pts);
    raise.phone.position([handAt[0] + 20, handAt[1] - 40]);
    raise.phone.rotation(-18 + 18 * v);
  });
  const good = check(120);
  good.position([300, -620]);
  stage().add(good);
  yield* all(eyeLine.end(1, 0.4), pop(good));

  /* 8. Kalau tidak hilang beberapa minggu atau kesemutan: periksa ke dokter */
  yield* until(c.kalau - 0.2);
  yield* all(fade(side.root), fade(good));
  const row: [() => Node, string, string][] = [
    [calendarIcon, 'Tak hilang berminggu-minggu', 'minggu'],
    [tingleIcon, 'Tangan kesemutan', 'tangan'],
    [doctorIcon, 'Periksa ke dokter', 'periksa'],
  ];
  const items: Node[] = [];
  for (let i = 0; i < row.length; i++) {
    yield* until(c[row[i][2]] - 0.15);
    const item = card(820, 250);
    item.position([0, -620 + i * 290]);
    item.scale(0);
    const icon = row[i][0]();
    icon.position([-270, 0]);
    icon.scale(0.85);
    item.add(icon);
    item.add(<Txt x={-130} offset={[-1, 0]} width={530} textWrap text={row[i][1]} fontFamily={ROUND} fontWeight={800} fontSize={50} fill={i === 2 ? TERRA : INK} />);
    stage().add(item);
    items.push(item);
    yield* pop(item, 0.5);
  }
  yield* until(job.duration);
  yield* waitFor(0);
}
