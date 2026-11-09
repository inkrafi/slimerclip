/**
 * Short animasi penuh Klik Digital ID: ke mana potongan QRIS pergi.
 * Semua gambar digambar kode, tanpa video stok dan tanpa watermark. Tiap adegan berganti tepat pada kata yang diucapkan.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeOutCubic, linear, spawn, ThreadGenerator, tween, waitFor} from '@revideo/core';
import {captions, DARK_INK, DARK_MUTED, DEEP_GREEN, DEEP_RED, MONO, PAPER, PAPER_CARD, PAPER_EDGE, SANS, until, Word} from './system';

const W = 1080;
const H = 1920;
const GOLD = '#E8A33A';
const BLUE = '#3B6FD6';
const NAVY = '#22324F';
const SOFT = '#E4DCC8';
const WHITE = '#FFFFFF';

export const rp = (value: number) => `Rp${Math.round(value).toLocaleString('id-ID')}`;

/* ---------- Bantuan gerak ---------- */
export function* pop(node: Node, seconds = 0.34): ThreadGenerator {
  node.opacity(1);
  yield* node.scale(1, seconds, easeOutBack);
}
export function* fadeIn(node: Node, seconds = 0.3): ThreadGenerator {
  yield* node.opacity(1, seconds);
}
export function* enterUp(node: Node, seconds = 0.4): ThreadGenerator {
  const y = node.y();
  node.y(y + 110);
  node.opacity(0);
  yield* all(node.y(y, seconds, easeOutCubic), node.opacity(1, seconds * 0.7));
}
export function* exit(node: Node, seconds = 0.28): ThreadGenerator {
  yield* all(node.y(node.y() - 90, seconds, easeInOutCubic), node.opacity(0, seconds));
  node.remove();
}
export function* count(label: Txt, from: number, to: number, seconds: number, format = rp): ThreadGenerator {
  yield* tween(seconds, t => label.text(format(from + (to - from) * easeOutCubic(t))));
  label.text(format(to));
}
export const label = (text: string, size: number, fill = DARK_INK, weight = 700, family = SANS) => (
  <Txt text={text} fontFamily={family} fontWeight={weight} fontSize={size} fill={fill} />
);

/* ---------- Ilustrasi ---------- */
export function backdrop(view: View2D, duration: number) {
  view.add(<Rect size={[W, H]} fill={PAPER} />);
  const dots = createRef<Node>();
  const STEP = 96;
  view.add(<Node ref={dots}>
    {Array.from({length: 14 * 24}, (_, i) => (
      <Circle x={(i % 14 - 6.5) * STEP} y={(Math.floor(i / 14) - 12) * STEP} size={7} fill="#00000012" />
    ))}
  </Node>);
  spawn(dots().y(STEP, duration, linear));
}

export function qrCode(size: number) {
  const n = 21;
  const cell = size / n;
  const root = new Node({});
  root.add(<Rect size={size + cell * 2} radius={8} fill={WHITE} />);
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const inFinder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8);
  const at = (r: number, c: number) => [-size / 2 + (c + 0.5) * cell, -size / 2 + (r + 0.5) * cell];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (inFinder(r, c) || random() < 0.52) continue;
    const [x, y] = at(r, c);
    root.add(<Rect x={x} y={y} size={cell + 0.5} fill={DARK_INK} />);
  }
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const [x, y] = at(r + 3, c + 3);
    root.add(<Rect x={x} y={y} size={cell * 7} fill={DARK_INK} />);
    root.add(<Rect x={x} y={y} size={cell * 5} fill={WHITE} />);
    root.add(<Rect x={x} y={y} size={cell * 3} fill={DARK_INK} />);
  }
  return root;
}

export function phone() {
  const root = new Node({});
  root.add(<Rect size={[400, 780]} radius={62} fill={DARK_INK} />);
  const screen = new Rect({size: [356, 728], radius: 44, fill: WHITE, clip: true});
  root.add(screen);
  root.add(<Rect y={-336} size={[120, 26]} radius={13} fill={DARK_INK} />);
  return {root, screen};
}

export function store(scale = 1) {
  const root = new Node({});
  const art = new Node({scale});
  root.add(art);
  art.add(<Rect y={60} size={[520, 380]} fill="#F6E7CF" stroke={DARK_INK} lineWidth={8} />);
  /* Kanopi bergaris */
  for (let i = 0; i < 6; i++) {
    art.add(<Rect x={-218 + i * 87} y={-170} size={[87, 90]} fill={i % 2 ? WHITE : DEEP_RED} />);
  }
  art.add(<Rect y={-170} size={[522, 90]} stroke={DARK_INK} lineWidth={8} />);
  art.add(<Rect y={-262} size={[380, 84]} radius={14} fill={NAVY} />);
  art.add(<Txt y={-262} text="RESTORAN" fontFamily={SANS} fontWeight={700} fontSize={52} fill={WHITE} letterSpacing={6} />);
  art.add(<Rect x={-120} y={110} size={[150, 280]} fill="#9C6B3E" stroke={DARK_INK} lineWidth={8} />);
  art.add(<Circle x={-70} y={120} size={18} fill={GOLD} />);
  art.add(<Rect x={120} y={40} size={[190, 150]} fill="#BFE3F2" stroke={DARK_INK} lineWidth={8} />);
  return root;
}

export function shopIcon(scale = 1, awning = DEEP_RED) {
  const root = new Node({});
  const art = new Node({scale});
  root.add(art);
  art.add(<Rect y={30} size={[150, 110]} fill="#F6E7CF" stroke={DARK_INK} lineWidth={6} />);
  for (let i = 0; i < 4; i++) art.add(<Rect x={-57 + i * 38} y={-45} size={[38, 40]} fill={i % 2 ? WHITE : awning} />);
  art.add(<Rect y={-45} size={[152, 40]} stroke={DARK_INK} lineWidth={6} />);
  art.add(<Rect x={-30} y={50} size={[44, 70]} fill="#9C6B3E" stroke={DARK_INK} lineWidth={5} />);
  return root;
}

export function bank(scale = 1, fill = BLUE) {
  const root = new Node({});
  const art = new Node({scale});
  root.add(art);
  art.add(<Line points={[[-150, -70], [0, -150], [150, -70]]} closed fill={fill} stroke={DARK_INK} lineWidth={7} lineJoin="round" />);
  art.add(<Rect y={-58} size={[300, 26]} fill={fill} stroke={DARK_INK} lineWidth={7} />);
  for (let i = 0; i < 4; i++) art.add(<Rect x={-105 + i * 70} y={20} size={[30, 130]} fill={WHITE} stroke={DARK_INK} lineWidth={6} />);
  art.add(<Rect y={100} size={[320, 34]} fill={fill} stroke={DARK_INK} lineWidth={7} />);
  return root;
}

function network(scale = 1) {
  const root = new Node({});
  const art = new Node({scale});
  root.add(art);
  const points: [number, number][] = [[-110, -60], [0, -110], [110, -50], [-70, 80], [80, 90], [0, 10]];
  const links = [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [0, 1], [1, 2], [3, 4], [0, 3], [2, 4]];
  for (const [a, b] of links) art.add(<Line points={[points[a], points[b]]} stroke={DARK_INK} lineWidth={7} />);
  points.forEach(([x, y], i) => art.add(<Circle x={x} y={y} size={i === 5 ? 64 : 46} fill={i === 5 ? GOLD : '#7FC8A9'} stroke={DARK_INK} lineWidth={6} />));
  return root;
}

function office(scale = 1) {
  const root = new Node({});
  const art = new Node({scale});
  root.add(art);
  art.add(<Rect y={10} size={[200, 250]} fill="#C9B8E8" stroke={DARK_INK} lineWidth={7} />);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    art.add(<Rect x={-60 + c * 60} y={-70 + r * 62} size={[34, 38]} fill={WHITE} stroke={DARK_INK} lineWidth={4} />);
  }
  art.add(<Circle x={92} y={-110} size={86} fill={DEEP_GREEN} stroke={DARK_INK} lineWidth={6} />);
  art.add(<Line points={[[72, -110], [88, -94], [114, -126]]} stroke={WHITE} lineWidth={10} lineCap="round" lineJoin="round" />);
  return root;
}

function miniPhone(scale = 1) {
  const root = new Node({});
  const art = new Node({scale});
  root.add(art);
  art.add(<Rect size={[150, 270]} radius={26} fill={DARK_INK} />);
  art.add(<Rect size={[128, 236]} radius={16} fill={WHITE} />);
  art.add(<Rect y={-20} size={[80, 80]} radius={6} fill={DARK_INK} />);
  art.add(<Rect y={-20} size={[44, 44]} fill={WHITE} />);
  art.add(<Rect y={70} size={[90, 22]} radius={11} fill={DEEP_GREEN} />);
  return root;
}

export function coin(text: string, size = 220) {
  const root = new Node({});
  root.add(<Circle size={size} fill={GOLD} stroke={DARK_INK} lineWidth={size * 0.04} />);
  root.add(<Circle size={size * 0.78} stroke="#B97A1E" lineWidth={size * 0.03} />);
  root.add(<Txt text={text} fontFamily={SANS} fontWeight={700} fontSize={size * 0.2} fill={DARK_INK} />);
  return root;
}

export function banknote() {
  const root = new Node({});
  root.add(<Rect size={[300, 150]} radius={14} fill="#7FC8A9" stroke={DARK_INK} lineWidth={7} />);
  root.add(<Circle size={86} stroke={DARK_INK} lineWidth={6} />);
  root.add(<Txt y={2} text="Rp" fontFamily={SANS} fontWeight={700} fontSize={38} fill={DARK_INK} />);
  return root;
}

export function person(shirt: string, scale = 1) {
  const root = new Node({});
  const art = new Node({scale});
  root.add(art);
  art.add(<Rect y={190} size={[300, 260]} radius={[120, 120, 20, 20]} fill={shirt} stroke={DARK_INK} lineWidth={8} />);
  art.add(<Circle y={10} size={190} fill="#E9B98F" stroke={DARK_INK} lineWidth={8} />);
  art.add(<Rect y={-62} size={[196, 70]} radius={[90, 90, 10, 10]} fill={DARK_INK} />);
  art.add(<Circle x={-36} y={20} size={18} fill={DARK_INK} />);
  art.add(<Circle x={36} y={20} size={18} fill={DARK_INK} />);
  art.add(<Line points={[[-30, 62], [0, 76], [30, 62]]} stroke={DARK_INK} lineWidth={7} lineCap="round" />);
  return root;
}

export function card(width: number, height: number, fill = PAPER_CARD) {
  return new Rect({size: [width, height], radius: 28, fill, stroke: PAPER_EDGE, lineWidth: 4, shadowColor: '#00000022', shadowBlur: 24, shadowOffsetY: 10});
}

export function chip(text: string, fill: string, size = 44, ink = WHITE) {
  return new Rect({layout: true, padding: [size * 0.3, size * 0.6], radius: size * 0.6, fill, children: [label(text, size, ink)]});
}

export function stamp(text: string, size = 74) {
  return new Rect({layout: true, padding: [size * 0.22, size * 0.45], radius: 14, stroke: DEEP_RED, lineWidth: 10, rotation: -9, scale: 0, opacity: 0,
    children: [label(text, size, DEEP_RED)]});
}

/* ---------- Thumbnail ----------
 * Satu fokus: koin Rp1.400 yang "hilang" di antara HP dan restoran. Teks 3 kata, celah rasa penasaran, tidak mengulang judul.
 * Isi penting di tengah 1080x1440 karena grid profil TikTok memotong cover jadi 3:4.
 */
export function* qrisThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const {root: hp, screen} = phone();
  hp.position([-300, -110]);
  hp.scale(0.62);
  hp.rotation(-8);
  const qr = qrCode(250);
  qr.y(-40);
  screen.add(qr);
  screen.add(<Rect y={160} layout padding={[10, 26]} radius={12} fill={DARK_INK}>{label('QRIS', 40, WHITE)}</Rect>);
  view.add(hp);
  const shop = store(0.55);
  shop.position([335, -60]);
  view.add(shop);
  view.add(<Line points={[[-170, -250], [190, -250]]} stroke={DARK_MUTED} lineWidth={10} lineDash={[24, 18]} endArrow arrowSize={30} />);
  const gap = coin('Rp1.400', 340);
  gap.position([0, 20]);
  gap.rotation(-10);
  view.add(gap);
  view.add(<Txt x={140} y={-170} text="?" fontFamily={SANS} fontWeight={700} fontSize={230} fill={DEEP_RED} rotation={12} />);
  view.add(<Rect y={-520} layout padding={[16, 34]} radius={18} fill={DARK_INK}>{label('Bayar Rp200.000', 64, WHITE)}</Rect>);
  view.add(<Txt y={300} text="Rp1.400-nya" fontFamily={SANS} fontWeight={700} fontSize={140} fill={DARK_INK} />);
  view.add(<Rect y={480} layout padding={[6, 40]} radius={24} fill={DEEP_RED} rotation={-2}>{label('KE MANA?', 150, WHITE)}</Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* qris(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={0} scale={1.12} />);
  captions(view, job.words as Word[], 640, 58, job.duration);

  /* 1. Bayar makan Rp200.000 pakai QRIS, saldo terpotong pas */
  const one = new Node({});
  stage().add(one);
  const {root: hp, screen} = phone();
  hp.position([-170, -40]);
  one.add(hp);
  const bill = card(330, 230);
  bill.position([250, -360]);
  bill.rotation(5);
  bill.add(<Txt y={-50} text="Makan" fontFamily={SANS} fontWeight={700} fontSize={44} fill={DARK_MUTED} />);
  bill.add(<Txt y={30} text="Rp200.000" fontFamily={MONO} fontWeight={600} fontSize={58} fill={DARK_INK} />);
  one.add(bill);
  const pay = createRef<Txt>();
  screen.add(<Txt ref={pay} y={-290} text="Bayar" fontFamily={SANS} fontWeight={700} fontSize={40} fill={DARK_INK} />);
  const qr = qrCode(250);
  qr.y(-40);
  screen.add(qr);
  const scan = createRef<Rect>();
  screen.add(<Rect ref={scan} y={-175} size={[290, 8]} radius={4} fill={DEEP_GREEN} opacity={0} />);
  const qrisTag = createRef<Rect>();
  screen.add(<Rect ref={qrisTag} y={160} layout padding={[10, 26]} radius={12} fill={DARK_INK}>{label('QRIS', 40, WHITE)}</Rect>);
  yield* all(enterUp(hp, 0.45), enterUp(bill, 0.45));
  yield* until(c.qris - 0.1);
  scan().opacity(1);
  yield* scan().y(95, 0.55, easeInOutCubic);
  scan().opacity(0);
  yield* until(c.saldo - 0.1);
  const wallet = createRef<Node>();
  const balance = createRef<Txt>();
  const minus = chip('-Rp200.000', DEEP_RED, 40);
  minus.position([0, 120]);
  minus.scale(0);
  minus.opacity(0);
  screen.add(<Node ref={wallet} opacity={0}>
    <Txt y={-120} text="Saldo" fontFamily={SANS} fontWeight={700} fontSize={42} fill={DARK_MUTED} />
    <Txt ref={balance} y={-40} text={rp(1000000)} fontFamily={MONO} fontWeight={600} fontSize={56} fill={DARK_INK} />
  </Node>);
  wallet().add(minus);
  yield* all(qr.opacity(0, 0.2), qrisTag().opacity(0, 0.2), pay().opacity(0, 0.2), wallet().opacity(1, 0.25));
  yield* all(count(balance(), 1000000, 800000, 0.8), pop(minus));
  yield* until(c.pas - 0.1);
  const tick = new Node({y: 260, scale: 0});
  tick.add(<Circle size={110} fill={DEEP_GREEN} />);
  tick.add(<Line points={[[-26, 2], [-6, 22], [28, -18]]} stroke={WHITE} lineWidth={14} lineCap="round" lineJoin="round" />);
  screen.add(tick);
  yield* pop(tick);

  /* 2. Yang masuk ke restoran cuma Rp198.600. Rp1.400 ke mana? */
  yield* until(c.tapi - 0.25);
  const shop = store(0.82);
  shop.position([150, 210]);
  shop.opacity(0);
  stage().add(shop);
  yield* all(bill.opacity(0, 0.25), hp.position([-280, -540], 0.45, easeInOutCubic), hp.scale(0.6, 0.45, easeInOutCubic), enterUp(shop, 0.45));
  const note = banknote();
  note.position([-280, -470]);
  note.scale(0.6);
  stage().add(note);
  yield* all(note.position([150, 140], 0.6, easeInOutCubic), note.scale(0.9, 0.6), note.rotation(-12, 0.6));
  yield* note.opacity(0, 0.15);
  yield* until(c.cuma - 0.15);
  const till = card(480, 150, NAVY);
  till.position([150, -170]);
  till.stroke(DARK_INK);
  const tillText = createRef<Txt>();
  till.add(<Txt ref={tillText} text={rp(0)} fontFamily={MONO} fontWeight={600} fontSize={72} fill="#9BF0C5" />);
  till.add(<Txt y={-104} text="Masuk ke restoran" fontFamily={SANS} fontWeight={700} fontSize={36} fill={DARK_INK} />);
  till.scale(0);
  stage().add(till);
  yield* pop(till);
  yield* count(tillText(), 0, 198600, 1.7);
  yield* until(c.seribu - 0.1);
  const gap = coin('Rp1.400', 230);
  gap.position([-250, -150]);
  gap.scale(0);
  stage().add(gap);
  yield* pop(gap, 0.4);
  yield* until(c.mana - 0.3);
  const ask = createRef<Txt>();
  stage().add(<Txt ref={ask} x={-105} y={-10} text="?" fontFamily={SANS} fontWeight={700} fontSize={180} fill={DEEP_RED} scale={0} />);
  yield* pop(ask());
  spawn(function* () {
    for (let i = 0; i < 3; i++) yield* gap.rotation(8, 0.12).to(-8, 0.24).to(0, 0.12);
  });

  /* 3. Namanya MDR: biaya dari penjual, 0,7% di restoran besar */
  yield* until(c.itu - 0.2);
  yield* all(exit(one), exit(shop), exit(till), exit(ask()), gap.position([0, 330], 0.45, easeInOutCubic), gap.scale(0.85, 0.45));
  const title = new Node({y: -560, scale: 0});
  title.add(<Txt text="MDR" fontFamily={SANS} fontWeight={700} fontSize={230} fill={DARK_INK} />);
  title.add(<Txt y={140} text="Merchant Discount Rate" fontFamily={MONO} fontWeight={600} fontSize={46} fill={DARK_MUTED} />);
  stage().add(title);
  yield* until(c.mdr - 0.15);
  yield* pop(title, 0.4);
  yield* until(c.biaya - 0.15);
  const seller = shopIcon(1.8);
  seller.position([-250, -170]);
  seller.scale(0);
  stage().add(seller);
  const cut = createRef<Line>();
  stage().add(<Line ref={cut} points={[[-200, 10], [-70, 215]]} stroke={DEEP_RED} lineWidth={14} endArrow arrowSize={34} lineCap="round" end={0} />);
  const fromSeller = createRef<Txt>();
  stage().add(<Txt ref={fromSeller} x={180} y={-170} width={420} textWrap textAlign="left" text="Dipotong dari penjual, bukan dari lu"
    fontFamily={SANS} fontWeight={700} fontSize={52} fill={DARK_INK} opacity={0} />);
  yield* all(pop(seller), cut().end(1, 0.5, easeOutCubic), fadeIn(fromSeller(), 0.4));
  yield* until(c.besar - 0.2);
  yield* all(seller.opacity(0, 0.25), cut().opacity(0, 0.25), fromSeller().opacity(0, 0.25), gap.opacity(0, 0.25));
  const meter = new Node({y: -40, opacity: 0});
  meter.add(<Txt y={-120} x={-430} offset={[-1, 0]} text="Bayar Rp200.000" fontFamily={SANS} fontWeight={700} fontSize={50} fill={DARK_INK} />);
  meter.add(<Rect size={[860, 110]} radius={20} fill={DEEP_GREEN} />);
  const sliver = createRef<Rect>();
  meter.add(<Rect ref={sliver} x={426} size={[8, 110]} fill={DEEP_RED} />);
  stage().add(meter);
  yield* fadeIn(meter, 0.3);
  yield* until(c.nol07 - 0.1);
  const zoom = new Node({position: [180, 330], scale: 0});
  zoom.add(<Line points={[[246, -385], [120, -150]]} stroke={DARK_INK} lineWidth={6} lineDash={[16, 12]} />);
  zoom.add(<Circle size={340} fill={PAPER_CARD} stroke={DEEP_RED} lineWidth={10} />);
  zoom.add(<Txt y={-40} text="0,7%" fontFamily={SANS} fontWeight={700} fontSize={100} fill={DEEP_RED} />);
  zoom.add(<Txt y={50} text="= Rp1.400" fontFamily={MONO} fontWeight={600} fontSize={50} fill={DARK_INK} />);
  stage().add(zoom);
  yield* pop(zoom, 0.4);

  /* 4. Dibagi ke empat pihak, Bank Indonesia tidak ambil bagian */
  yield* until(c.duit - 0.2);
  yield* all(exit(title), exit(meter), exit(zoom), seller.opacity(0, 0.1));
  const pot = coin('Rp1.400', 230);
  pot.position([0, -600]);
  pot.scale(0);
  stage().add(pot);
  yield* pop(pot);
  const spots: [number, number][] = [[-250, -170], [250, -170], [-250, 240], [250, 240]];
  const parties: [string, () => Node][] = [
    ['Aplikasi pembayaran lu', () => miniPhone(0.75)],
    ['Bank si penjual', () => bank(0.62)],
    ['Jaringan penghubung', () => network(0.78)],
    ['Lembaga pendukung', () => office(0.7)],
  ];
  const keys = ['app', 'bank', 'net', 'lembaga'];
  const boxes: Node[] = [];
  const links: Line[] = [];
  const back = new Node({});
  stage().add(back);
  pot.moveToTop();
  for (let i = 0; i < 4; i++) {
    yield* until(c[keys[i]] - 0.15);
    const [x, y] = spots[i];
    const link = new Line({points: [[0, -490], [x, y - 150]], stroke: GOLD, lineWidth: 10, lineDash: [22, 14], end: 0});
    back.add(link);
    links.push(link);
    const box = card(440, 360);
    box.position([x, y]);
    box.scale(0);
    const art = parties[i][1]();
    art.y(-40);
    box.add(art);
    box.add(<Txt y={128} width={400} textAlign="center" textWrap text={parties[i][0]} fontFamily={SANS} fontWeight={700} fontSize={40} fill={DARK_INK} />);
    stage().add(box);
    boxes.push(box);
    const piece = coin('', 70);
    piece.position([0, -490]);
    stage().add(piece);
    yield* all(link.end(1, 0.35, easeOutCubic), pop(box), piece.position([x, y - 150], 0.45, easeInOutCubic));
    piece.remove();
  }
  yield* until(c.bi - 0.2);
  yield* all(...boxes.map(b => exit(b, 0.3)), ...links.map(l => exit(l, 0.3)), pot.opacity(0, 0.3));
  const central = bank(1.35, NAVY);
  central.position([0, -330]);
  central.scale(0);
  stage().add(central);
  const centralName = createRef<Txt>();
  stage().add(<Txt ref={centralName} y={-40} text="Bank Indonesia" fontFamily={SANS} fontWeight={700} fontSize={68} fill={DARK_INK} opacity={0} />);
  yield* all(pop(central, 0.4), fadeIn(centralName(), 0.3));
  yield* until(c.nggak - 0.1);
  const zero = createRef<Node>();
  stage().add(<Node ref={zero} y={190} scale={0}>
    <Rect size={[420, 150]} radius={24} fill={PAPER_CARD} stroke={DARK_INK} lineWidth={6} />
    <Txt text="Rp0" fontFamily={MONO} fontWeight={600} fontSize={90} fill={DEEP_RED} />
  </Node>);
  const none = createRef<Txt>();
  stage().add(<Txt ref={none} y={330} text="tidak ambil bagian" fontFamily={SANS} fontWeight={700} fontSize={46} fill={DARK_MUTED} opacity={0} />);
  yield* all(pop(zero()), fadeIn(none(), 0.3));

  /* 5. Sejak 1 Oktober 2026 aturannya berubah */
  yield* until(c.nah - 0.15);
  yield* all(exit(central), exit(centralName()), exit(zero()), exit(none()));
  const calendar = new Node({y: -250});
  calendar.add(<Rect size={[520, 560]} radius={34} fill={PAPER_CARD} stroke={DARK_INK} lineWidth={8} />);
  calendar.add(<Rect y={-205} size={[520, 150]} radius={[34, 34, 0, 0]} fill={DEEP_RED} stroke={DARK_INK} lineWidth={8} />);
  calendar.add(<Txt y={-205} text="OKTOBER 2026" fontFamily={SANS} fontWeight={700} fontSize={56} fill={WHITE} />);
  for (const x of [-150, 150]) calendar.add(<Rect x={x} y={-285} size={[30, 80]} radius={15} fill={DARK_INK} />);
  const day = createRef<Txt>();
  calendar.add(<Txt ref={day} y={60} text="30" fontFamily={SANS} fontWeight={700} fontSize={290} fill={DARK_INK} />);
  stage().add(calendar);
  yield* enterUp(calendar, 0.4);
  yield* until(c.satu - 0.2);
  yield* day().scale([1, 0], 0.14);
  day().text('1');
  yield* day().scale([1, 1], 0.2, easeOutBack);
  yield* until(c.berubah - 0.1);
  const rule = chip('ATURAN BARU', DEEP_GREEN, 56);
  rule.position([0, 160]);
  rule.scale(0);
  rule.opacity(0);
  stage().add(rule);
  yield* pop(rule);

  /* 6. Sampai Rp100 ribu 0% untuk semua, usaha mikro 0% sampai Rp500 ribu */
  yield* until(c.transaksi - 0.2);
  yield* all(exit(calendar), exit(rule));
  const scale = new Node({});
  stage().add(scale);
  scale.add(<Txt y={-640} text="Potongan QRIS per transaksi" fontFamily={SANS} fontWeight={700} fontSize={56} fill={DARK_INK} />);
  const X0 = -420;
  const PX = 840 / 600;   // piksel per seribu rupiah, skala 0 sampai Rp600 ribu
  const rows: {name: string; y: number; fill: Rect; zero: Rect; rest: Txt}[] = [];
  for (const [name, y, rest] of [['Usaha kecil sampai besar', -400, '0,7%'], ['Usaha mikro', -40, '0,3%']] as [string, number, string][]) {
    scale.add(<Txt x={X0} y={y - 110} offset={[-1, 0]} text={name} fontFamily={SANS} fontWeight={700} fontSize={48} fill={DARK_INK} />);
    scale.add(<Rect x={0} y={y} size={[840, 84]} radius={18} fill={SOFT} />);
    const fill = new Rect({x: X0, y, offset: [-1, 0], size: [0, 84], radius: 18, fill: DEEP_GREEN});
    scale.add(fill);
    const zeroChip = chip('0%', DARK_INK, 44);
    zeroChip.position([X0 + 70, y]);
    zeroChip.scale(0);
    zeroChip.opacity(0);
    scale.add(zeroChip);
    const restText = new Txt({x: 380, y, text: rest, fontFamily: SANS, fontWeight: 700, fontSize: 44, fill: DARK_MUTED, opacity: 0});
    scale.add(restText);
    rows.push({name, y, fill, zero: zeroChip, rest: restText});
  }
  for (const [value, text] of [[0, '0'], [100, '100rb'], [500, '500rb']] as [number, string][]) {
    scale.add(<Line points={[[X0 + value * PX, 230], [X0 + value * PX, 260]]} stroke={DARK_INK} lineWidth={6} />);
    scale.add(<Txt x={X0 + value * PX} y={300} text={text} fontFamily={MONO} fontWeight={600} fontSize={40} fill={DARK_INK} />);
    scale.add(<Line points={[[X0 + value * PX, -470], [X0 + value * PX, 230]]} stroke="#00000022" lineWidth={4} lineDash={[12, 12]} />);
  }
  scale.add(<Line points={[[X0, 245], [X0 + 840, 245]]} stroke={DARK_INK} lineWidth={6} />);
  yield* enterUp(scale, 0.4);
  yield* until(c.seratus - 0.1);
  yield* all(...rows.map(r => r.fill.width(100 * PX, 0.5, easeOutCubic)));
  yield* until(c.nol1 - 0.15);
  yield* all(...rows.map(r => pop(r.zero)));
  yield* until(c.mikro - 0.1);
  yield* rows[0].fill.opacity(0.45, 0.3);
  yield* until(c.lima - 0.15);
  yield* all(rows[1].fill.width(500 * PX, 0.6, easeOutCubic), rows[1].zero.x(X0 + 250 * PX, 0.6, easeOutCubic));
  yield* all(...rows.map(r => r.rest.opacity(1, 0.3)));

  /* 7. Biaya ini tidak boleh dibebankan ke pembeli */
  yield* until(c.dan - 0.2);
  yield* exit(scale);
  const fact = chip('JARANG ORANG TAHU', GOLD, 50, DARK_INK);
  fact.position([0, -640]);
  fact.scale(0);
  fact.opacity(0);
  stage().add(fact);
  yield* until(c.jarang - 0.15);
  yield* pop(fact);
  yield* until(c.biaya2 - 0.2);
  const sellerSide = shopIcon(2.1);
  sellerSide.position([-270, -260]);
  const buyer = person(BLUE, 1.05);
  buyer.position([270, -400]);
  sellerSide.scale(0);
  buyer.scale(0);
  stage().add(sellerSide);
  stage().add(buyer);
  const fee = chip('Biaya MDR', DEEP_RED, 42);
  fee.position([-270, 60]);
  fee.scale(0);
  fee.opacity(0);
  stage().add(fee);
  yield* all(pop(sellerSide), pop(buyer), pop(fee));
  yield* until(c.boleh - 0.45);
  yield* fee.position([20, 60], 0.4, easeInOutCubic);
  const block = new Node({position: [130, 60], scale: 0});
  block.add(<Circle size={150} fill={DEEP_RED} />);
  block.add(<Line points={[[-36, -36], [36, 36]]} stroke={WHITE} lineWidth={18} lineCap="round" />);
  block.add(<Line points={[[36, -36], [-36, 36]]} stroke={WHITE} lineWidth={18} lineCap="round" />);
  stage().add(block);
  yield* all(pop(block, 0.3), fee.position([-270, 60], 0.5, easeOutBack));
  yield* until(c.pembeli - 0.1);
  const carry = createRef<Txt>();
  stage().add(<Txt ref={carry} x={-270} y={170} text="ditanggung penjual" fontFamily={SANS} fontWeight={700} fontSize={44} fill={DARK_INK} opacity={0} />);
  yield* fadeIn(carry(), 0.3);

  /* 8. Kasir minta tambahan biaya QRIS: tidak sesuai aturan */
  yield* until(c.jadi - 0.2);
  yield* all(exit(fact), exit(sellerSide), exit(buyer), exit(fee), exit(block), exit(carry()));
  const cashier = person(DEEP_GREEN, 1.05);
  cashier.position([-230, -60]);
  const counter = new Rect({x: 0, y: 300, size: [1000, 150], radius: 18, fill: '#9C6B3E', stroke: DARK_INK, lineWidth: 8});
  stage().add(cashier);
  stage().add(counter);
  yield* all(enterUp(cashier, 0.35), enterUp(counter, 0.35));
  yield* until(c.bilang - 0.2);
  const bubble = new Node({position: [150, -560], scale: 0});
  bubble.add(<Rect size={[560, 300]} radius={40} fill={PAPER_CARD} stroke={DARK_INK} lineWidth={8} />);
  bubble.add(<Line points={[[-200, 140], [-280, 230], [-120, 145]]} closed fill={PAPER_CARD} stroke={DARK_INK} lineWidth={8} lineJoin="round" />);
  bubble.add(<Rect y={137} size={[86, 20]} x={-160} fill={PAPER_CARD} />);
  const quote = createRef<Txt>();
  bubble.add(<Txt ref={quote} width={520} textWrap textAlign="center" text={'"Pakai QRIS nambah Rp2.000 ya"'} fontFamily={SANS} fontWeight={700} fontSize={56} fill={DARK_INK} />);
  stage().add(bubble);
  yield* pop(bubble, 0.38);
  yield* until(c.itu2 - 0.1);
  const no = stamp('TIDAK SESUAI ATURAN', 54);
  no.position([150, -330]);
  quote().fill(DARK_MUTED);
  bubble.add(<Line points={[[-250, 0], [250, 0]]} stroke={DEEP_RED} lineWidth={10} lineCap="round" />);
  stage().add(no);
  no.scale(1.6);
  yield* all(no.opacity(1, 0.12), no.scale(1, 0.22, easeOutCubic));
  yield* until(c.aturan - 0.1);
  const rulebook = chip('Aturan Bank Indonesia', NAVY, 46);
  rulebook.position([150, -205]);
  rulebook.scale(0);
  rulebook.opacity(0);
  stage().add(rulebook);
  yield* pop(rulebook);

  /* 9. Ajakan berkomentar */
  yield* until(c.pernah - 0.2);
  yield* all(exit(cashier), exit(counter), exit(bubble), exit(no), exit(rulebook));
  const talk = new Node({y: -300, scale: 0});
  talk.add(<Rect size={[700, 380]} radius={60} fill={DEEP_GREEN} stroke={DARK_INK} lineWidth={8} />);
  talk.add(<Line points={[[-220, 180], [-300, 290], [-110, 185]]} closed fill={DEEP_GREEN} stroke={DARK_INK} lineWidth={8} lineJoin="round" />);
  talk.add(<Rect x={-165} y={178} size={[110, 20]} fill={DEEP_GREEN} />);
  talk.add(<Txt text="Pernah ngalamin?" fontFamily={SANS} fontWeight={700} fontSize={76} fill={WHITE} />);
  stage().add(talk);
  yield* pop(talk, 0.4);
  yield* until(c.cerita - 0.15);
  const box = card(820, 130);
  box.position([0, 120]);
  box.scale(0);
  const dots: Circle[] = [0, 1, 2].map(i => new Circle({x: -40 + i * 40, size: 22, fill: DARK_MUTED}));
  box.add(<Txt x={-360} offset={[-1, 0]} text="Tulis komentar" fontFamily={SANS} fontWeight={700} fontSize={44} fill={DARK_MUTED} />);
  const dotRow = new Node({x: 290});
  dots.forEach(d => dotRow.add(d));
  box.add(dotRow);
  stage().add(box);
  yield* pop(box);
  spawn(function* () {
    for (;;) {
      for (const d of dots) yield* d.y(-12, 0.14).to(0, 0.14);
    }
  });
  yield* until(job.duration);
  yield* waitFor(0);
}
