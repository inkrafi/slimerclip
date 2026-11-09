/**
 * Short akun pijat: empat kondisi saat pijat sebaiknya ditunda (demam, luka/infeksi kulit, cedera baru, tanda gumpalan darah).
 * Ilustrasi hangat dan membulat; poin keempat diberi penekanan paling kuat.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutSine, easeOutBack, easeOutCubic, spawn, ThreadGenerator, waitFor} from '@revideo/core';
import {boltIcon} from './krek';
import {backBody, card, cross, doctorIcon, hand} from './leher';
import {calf} from './pegal';
import {
  backdrop, captions, chip, fade, GOLD, HAIR, INK, pop, rise, ROUND, SAGE_DARK, SKIN, TERRA, until, WHITE, Word,
} from './system';
import {bookmark} from './usapan';

const OUTLINE = 7;
const GERM = '#7E9C5E';

/* ---------- Ilustrasi ---------- */

function badge(n: number, fill = SAGE_DARK) {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Circle size={150} fill={fill} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Txt text={String(n)} fontFamily={ROUND} fontWeight={800} fontSize={96} fill={WHITE} />);
  return root;
}

function germ(scale = 1) {
  const root = new Node({scale});
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    root.add(<Line points={[[Math.cos(a) * 36, Math.sin(a) * 36], [Math.cos(a) * 58, Math.sin(a) * 58]]} stroke={INK} lineWidth={6} lineCap="round" />);
    root.add(<Circle x={Math.cos(a) * 60} y={Math.sin(a) * 60} size={16} fill={GERM} stroke={INK} lineWidth={4} />);
  }
  root.add(<Circle size={84} fill={GERM} stroke={INK} lineWidth={6} />);
  root.add(<Circle x={-14} y={-8} size={14} fill={INK} />);
  root.add(<Circle x={14} y={-8} size={14} fill={INK} />);
  root.add(<Line points={[[-14, 18], [0, 10], [14, 18]]} stroke={INK} lineWidth={5} lineCap="round" />);
  return root;
}

/** Wajah demam: termometer di mulut, pipi merah, keringat */
function feverFace() {
  const root = new Node({});
  const glow = new Circle({size: 460, fill: TERRA, opacity: 0});
  root.add(glow);
  root.add(<Circle size={320} fill={SKIN} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Circle y={-45} size={330} startAngle={185} endAngle={355} closed fill={HAIR} />);
  for (const x of [-62, 62]) root.add(<Line points={[[x - 26, 10], [x, 20], [x + 26, 10]]} stroke={INK} lineWidth={7} lineCap="round" />);
  root.add(<Circle x={-100} y={60} size={70} fill={TERRA} opacity={0.55} />);
  root.add(<Circle x={100} y={60} size={70} fill={TERRA} opacity={0.55} />);
  const thermo = new Node({position: [70, 95], rotation: -25});
  thermo.add(<Rect x={70} size={[170, 30]} radius={15} fill={WHITE} stroke={INK} lineWidth={5} />);
  thermo.add(<Rect x={40} size={[110, 14]} radius={7} fill={TERRA} />);
  thermo.add(<Circle x={-10} size={40} fill={TERRA} stroke={INK} lineWidth={5} />);
  root.add(thermo);
  const sweat = [[-150, -70], [160, -40]].map(([x, y]) => new Line({x, y, points: [[0, -26], [16, 4], [0, 20], [-16, 4]], closed: true, radius: 12, fill: '#9CC9C2', stroke: INK, lineWidth: 4, opacity: 0}));
  sweat.forEach(s => root.add(s));
  return {root, glow, sweat};
}

function pillow() {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Rect size={[300, 130]} radius={60} fill={WHITE} stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Txt x={170} y={-110} text="Zzz" fontFamily={ROUND} fontWeight={800} fontSize={70} fill={SAGE_DARK} />);
  return root;
}

/** Lengan dengan luka berplester dan ruam */
function woundArm() {
  const root = new Node({});
  root.add(<Line points={[[-420, 0], [380, 0]]} stroke={INK} lineWidth={184} lineCap="round" />);
  root.add(<Line points={[[-420, 0], [380, 0]]} stroke={SKIN} lineWidth={170} lineCap="round" />);
  const wound = new Node({x: -120});
  wound.add(<Rect size={[150, 90]} radius={20} fill="#F2D6B0" stroke={INK} lineWidth={5} rotation={-8} />);
  wound.add(<Rect size={[60, 70]} radius={10} fill="#E7B98A" rotation={-8} />);
  wound.add(<Line points={[[-20, -14], [0, 6], [-10, 14], [14, 22]]} stroke={TERRA} lineWidth={6} lineJoin="round" rotation={-8} />);
  root.add(wound);
  const rash = new Node({x: 200, opacity: 0});
  for (const [x, y] of [[-40, -30], [10, -40], [50, -10], [-20, 10], [30, 30], [-50, 35], [70, 25]]) rash.add(<Circle x={x} y={y} size={26} fill={TERRA} opacity={0.75} />);
  root.add(rash);
  return {root, wound, rash};
}

function clock() {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Circle size={170} fill={WHITE} stroke={INK} lineWidth={OUTLINE} />);
  const hour = new Line({points: [[0, 0], [0, -56]], stroke: INK, lineWidth: 10, lineCap: 'round'});
  root.add(hour);
  root.add(<Line points={[[0, 0], [38, 0]]} stroke={INK} lineWidth={10} lineCap="round" />);
  return {root, hour};
}

/** Pembuluh darah dengan gumpalan */
function vein() {
  const root = new Node({scale: 0, opacity: 0});
  root.add(<Rect size={[560, 150]} radius={75} fill="#E6A090" stroke={INK} lineWidth={OUTLINE} />);
  root.add(<Rect size={[540, 100]} radius={50} fill="#C9493E" opacity={0.9} />);
  for (const x of [-210, -130, 150, 220]) root.add(<Circle x={x} y={(x % 3) * 8} size={36} fill="#E86A5C" stroke={INK} lineWidth={3} />);
  const clot = new Node({});
  clot.add(<Circle size={[150, 110]} fill="#7A2B26" stroke={INK} lineWidth={5} />);
  for (const [x, y] of [[-40, -20], [30, 20], [10, -30]]) clot.add(<Circle x={x} y={y} size={30} fill="#5C1E1A" />);
  root.add(clot);
  root.add(<Txt y={130} text="gumpalan darah" fontFamily={ROUND} fontWeight={800} fontSize={44} fill={INK} />);
  return root;
}

/* ---------- Thumbnail ----------
 * Satu fokus: angka 4 kondisi dan betis bengkak dengan tanda silang. Rasa penasaran + rasa aman.
 */
export function* janganThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const legs = new Node({position: [0, 230], scale: 1.05});
  const left = calf();
  left.position([-150, 0]);
  const right = calf();
  right.position([150, 0]);
  right.scale([1.25, 1]);
  legs.add(left);
  legs.add(right);
  legs.add(new Circle({x: 150, y: -40, size: [300, 420], fill: TERRA, opacity: 0.35}));
  view.add(legs);
  const no = cross(170);
  no.scale(1);
  no.opacity(1);
  no.position([300, -40]);
  view.add(no);
  view.add(<Txt y={-610} text="JANGAN DIPIJAT" fontFamily={ROUND} fontWeight={800} fontSize={104} fill={INK} />);
  view.add(<Rect y={-470} layout padding={[10, 44]} radius={60} fill={TERRA} rotation={-3}>
    <Txt text="kalau ada ini!" fontFamily={ROUND} fontWeight={800} fontSize={110} fill={WHITE} />
  </Rect>);
  view.add(<Rect y={-330} layout padding={[14, 36]} radius={50} fill={WHITE} shadowColor="#4B342833" shadowBlur={30}>
    <Txt text="no. 4 paling penting" fontFamily={ROUND} fontWeight={800} fontSize={50} fill={SAGE_DARK} />
  </Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* jangan(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={10} scale={1.1} />);
  captions(view, job.words as Word[], 650, 58, job.duration);

  /* 0. Pijat memang enak, tapi ada kondisi yang bikin harus ditunda */
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
    for (let i = 0; i < 3; i++) yield* all(...hands.map(h => h.scale(0.92, 0.3, easeInOutSine).to(1, 0.3, easeInOutSine)));
  });
  yield* until(c.ditunda - 0.2);
  const pause = new Rect({position: [0, -720], layout: true, gap: 22, alignItems: 'center', padding: [16, 40], radius: 60, fill: TERRA, scale: 0, opacity: 0,
    children: [
      <Rect layout gap={12}><Rect size={[16, 50]} radius={6} fill={WHITE} /><Rect size={[16, 50]} radius={6} fill={WHITE} /></Rect>,
      <Txt text="Tunda dulu kalau..." fontFamily={ROUND} fontWeight={800} fontSize={54} fill={WHITE} />,
    ]});
  stage().add(pause);
  yield* pop(pause);

  /* 1. Demam */
  yield* until(c.pertama - 0.2);
  yield* all(fade(back.root), fade(pause));
  const one = badge(1);
  one.position([-330, -720]);
  stage().add(one);
  const oneTitle = new Txt({x: -230, y: -720, offset: [-1, 0], text: 'Saat demam', fontFamily: ROUND, fontWeight: 800, fontSize: 70, fill: INK, opacity: 0});
  stage().add(oneTitle);
  const fever = feverFace();
  fever.root.position([0, -270]);
  stage().add(fever.root);
  yield* all(pop(one), oneTitle.opacity(1, 0.3), rise(fever.root, 0.5));
  yield* until(c.demam - 0.15);
  yield* all(fever.glow.opacity(0.3, 0.4), ...fever.sweat.map(s => s.opacity(1, 0.4)));
  spawn(fever.glow.scale(1.08, 0.5, easeInOutSine).to(1, 0.5, easeInOutSine).to(1.08, 0.5, easeInOutSine).to(1, 0.5, easeInOutSine));
  yield* until(c.infeksi - 0.15);
  const germs = [[-300, -470], [310, -420], [-280, -60], [300, -90]].map(([x, y]) => {
    const g = germ(0.8);
    g.position([x, y]);
    g.scale(0);
    stage().add(g);
    return g;
  });
  yield* all(...germs.map(g => g.scale(0.8, 0.35, easeOutBack)));
  yield* until(c.istirahat - 0.15);
  const rest = pillow();
  rest.position([0, 60]);
  stage().add(rest);
  yield* all(pop(rest), ...germs.map(g => g.opacity(0.35, 0.3)));

  /* 2. Luka terbuka, ruam, infeksi kulit */
  yield* until(c.kedua - 0.2);
  yield* all(fade(one), fade(oneTitle), fade(fever.root), fade(rest), ...germs.map(g => fade(g)));
  const two = badge(2);
  two.position([-330, -720]);
  stage().add(two);
  const twoTitle = new Txt({x: -230, y: -720, offset: [-1, 0], width: 600, textWrap: true, text: 'Luka & infeksi kulit', fontFamily: ROUND, fontWeight: 800, fontSize: 64, fill: INK, opacity: 0});
  stage().add(twoTitle);
  const arm = woundArm();
  arm.root.position([0, -330]);
  arm.root.scale(0.9);
  stage().add(arm.root);
  yield* all(pop(two), twoTitle.opacity(1, 0.3), rise(arm.root, 0.5));
  yield* until(c.ruam - 0.15);
  yield* arm.rash.opacity(1, 0.4);
  yield* until(c.kuman - 0.15);
  const spread = [[-120, -560], [200, -540], [-300, -220], [320, -200], [40, -130]].map(([x, y]) => {
    const g = germ(0.55);
    g.position([-60, -330]);
    g.scale(0);
    stage().add(g);
    return {g, x, y};
  });
  yield* all(...spread.map(({g, x, y}) => all(g.scale(0.55, 0.3), g.position([x, y], 0.6, easeOutCubic))));
  yield* until(c.makin - 0.15);
  const slow = clock();
  slow.root.position([0, 60]);
  stage().add(slow.root);
  yield* pop(slow.root);
  spawn(slow.hour.rotation(360, 1.2));

  /* 3. Cedera baru: keseleo yang masih bengkak, jangan langsung diurut */
  yield* until(c.ketiga - 0.2);
  yield* all(fade(two), fade(twoTitle), fade(arm.root), fade(slow.root), ...spread.map(({g}) => fade(g)));
  const three = badge(3);
  three.position([-330, -720]);
  stage().add(three);
  const threeTitle = new Txt({x: -230, y: -720, offset: [-1, 0], text: 'Cedera baru', fontFamily: ROUND, fontWeight: 800, fontSize: 70, fill: INK, opacity: 0});
  stage().add(threeTitle);
  const ankle = calf();
  ankle.position([-60, -330]);
  ankle.scale(0.95);
  stage().add(ankle);
  yield* all(pop(three), threeTitle.opacity(1, 0.3), rise(ankle, 0.5));
  yield* until(c.keseleo - 0.15);
  const swell = new Circle({position: [-50, -10], size: 60, fill: TERRA, opacity: 0});
  stage().add(swell);
  const sprain = chip('keseleo, masih bengkak', TERRA, 44);
  sprain.position([0, 160]);
  stage().add(sprain);
  yield* all(swell.size(230, 0.6, easeOutCubic), swell.opacity(0.5, 0.4), pop(sprain));
  yield* until(c.jangan - 0.15);
  const rub = hand();
  rub.rotation(-90);
  rub.position([230, -40]);
  rub.scale(0);
  stage().add(rub);
  const noRub = cross(110);
  noRub.position([330, -150]);
  stage().add(noRub);
  yield* all(rub.scale(1.1, 0.3, easeOutBack), pop(noRub, 0.35));

  /* 4. Paling penting: betis bengkak satu sisi, hangat, nyeri, kemerahan = bisa gumpalan darah */
  yield* until(c.keempat - 0.2);
  yield* all(fade(three), fade(threeTitle), fade(ankle), fade(swell), fade(sprain), fade(rub), fade(noRub));
  const four = badge(4, TERRA);
  four.position([-330, -720]);
  stage().add(four);
  const fourTitle = new Txt({x: -230, y: -720, offset: [-1, 0], text: 'Paling penting', fontFamily: ROUND, fontWeight: 800, fontSize: 70, fill: TERRA, opacity: 0});
  stage().add(fourTitle);
  const legs = new Node({position: [0, -300], scale: 0.85});
  const leftLeg = calf();
  leftLeg.position([-170, 0]);
  const rightLeg = calf();
  rightLeg.position([170, 0]);
  legs.add(leftLeg);
  legs.add(rightLeg);
  stage().add(legs);
  yield* all(pop(four), fourTitle.opacity(1, 0.3), rise(legs, 0.5));
  yield* until(c.bengkak2 - 0.15);
  yield* rightLeg.scale([1.25, 1], 0.6, easeInOutSine);
  const oneSide = chip('satu sisi', TERRA, 44);
  oneSide.position([210, 120]);
  stage().add(oneSide);
  yield* pop(oneSide);
  yield* until(c.hangat - 0.15);
  const warm = new Circle({position: [150, -330], size: [300, 460], fill: GOLD, opacity: 0});
  stage().add(warm);
  yield* warm.opacity(0.35, 0.4);
  yield* until(c.nyeri - 0.15);
  const bolt = boltIcon();
  bolt.position([360, -470]);
  bolt.scale(0);
  stage().add(bolt);
  yield* bolt.scale(0.8, 0.3, easeOutBack);
  yield* until(c.kemerahan - 0.15);
  yield* warm.fill(TERRA, 0.4);
  yield* until(c.gumpalan - 0.2);
  yield* all(legs.opacity(0.25, 0.3), warm.opacity(0.1, 0.3), bolt.opacity(0, 0.3), oneSide.opacity(0, 0.3));
  const clot = vein();
  clot.position([0, -330]);
  stage().add(clot);
  yield* pop(clot, 0.5);
  yield* until(c.dipijat - 0.25);
  const noMassage = new Rect({position: [0, -100], layout: true, gap: 18, alignItems: 'center', padding: [14, 36], radius: 50, fill: WHITE, stroke: TERRA, lineWidth: 6, scale: 0, opacity: 0,
    children: [<Txt text="Jangan dipijat" fontFamily={ROUND} fontWeight={800} fontSize={58} fill={TERRA} />]});
  stage().add(noMassage);
  yield* pop(noMassage);
  yield* until(c.periksa - 0.15);
  const doc = doctorIcon();
  doc.position([0, 140]);
  doc.scale(0);
  stage().add(doc);
  yield* pop(doc);

  /* 5. Ringkasan: ragu? tanya dokter. Simpan video */
  yield* until(c.kalau - 0.2);
  yield* all(fade(four), fade(fourTitle), fade(legs), fade(warm), fade(clot), fade(noMassage), fade(doc), fade(bolt), fade(oneSide));
  const labels = ['Demam', 'Luka/kulit', 'Cedera baru', 'Betis bengkak'];
  const tiles: Node[] = labels.map((text, i) => {
    const tile = card(400, 180);
    tile.position([i % 2 ? 215 : -215, -600 + Math.floor(i / 2) * 210]);
    tile.scale(0);
    const b = badge(i + 1, i === 3 ? TERRA : SAGE_DARK);
    b.scale(0.55);
    b.opacity(1);
    b.position([-130, 0]);
    tile.add(b);
    tile.add(<Txt x={-70} offset={[-1, 0]} width={250} textWrap text={text} fontFamily={ROUND} fontWeight={800} fontSize={44} fill={INK} />);
    stage().add(tile);
    return tile;
  });
  yield* all(...tiles.map((t, i) => function* () {
    yield* waitFor(i * 0.08);
    yield* t.scale(1, 0.4, easeOutBack);
  }()));
  yield* until(c.ragu - 0.15);
  const ask = chip('Ragu? Tanya dokter dulu', SAGE_DARK, 52);
  ask.position([0, -130]);
  stage().add(ask);
  yield* pop(ask);
  yield* until(c.simpan - 0.15);
  const save = bookmark();
  save.position([0, 110]);
  stage().add(save);
  const saveText = new Txt({y: 240, text: 'Simpan, siapa tahu butuh', fontFamily: ROUND, fontWeight: 800, fontSize: 48, fill: INK, opacity: 0});
  stage().add(saveText);
  yield* all(pop(save), saveText.opacity(1, 0.3));
  yield* until(job.duration);
  yield* waitFor(0);
}

