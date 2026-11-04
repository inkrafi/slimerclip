/** Cuplikan longform 16:9: lebih tenang dari Short, dengan latar berganti mengikuti isi cerita. */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, createSignal, easeInOutCubic, easeOutBack, easeOutCubic, linear, sequence, spawn, ThreadGenerator, tween, Vector2} from '@revideo/core';
import {tire} from './illustrations';
import {
  Backdrops, DARK_INK, DARK_MUTED, DEEP_GREEN, EDGE, enter, GREEN, INK, MONO, MUTED, PAPER, PAPER_CARD, PAPER_EDGE, PANEL, pointer, RED, rupiah, SANS, statusBar, typeLine, until,
} from './system';

const W = 1920;
const H = 1080;
const LEAD = 0.2;

/** Urutan awal sengaja acak, supaya perpindahan saat diurutkan terlihat */
const ITEMS: [string, number][] = [
  ['Transport', 1000000], ['Kos', 3000000], ['Langganan', 500000], ['Makan', 2500000], ['Nongkrong', 1000000], ['Cicilan', 1500000],
];
const SORTED = [...ITEMS.keys()].sort((a, b) => ITEMS[b][1] - ITEMS[a][1]);
const SALARY = 10000000;
/** Saldo contoh per tanggal, dalam juta rupiah */
const BALANCE: [number, number][] = [[1, 10], [3, 6.5], [5, 5.4], [10, 3.9], [15, 2.8], [20, 1.9], [25, 1.1], [30, 0.5]];

export function* long(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  const backs = new Backdrops(view, W, H, job.duration);
  backs.set('video:/klik/stock/bokeh_h.mp4|0.45');
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={20} />);
  backs.mountCover();
  statusBar(view, -480, 880, 'ANGKA CONTOH', 26);
  spawn(stage().scale(1.03, job.duration, linear));

  /* Pembuka bab di atas lampu kota */
  const open = createRef<Node>();
  const title = createRef<Txt>();
  const tail = createRef<Rect>();
  const TITLE_X = -640;
  stage().add(<Node ref={open}>
    <Txt text="BAB 02" fontFamily={MONO} fontWeight={600} fontSize={44} fill={GREEN} x={TITLE_X} y={-95} offset={[-1, 0]} />
    <Txt ref={title} text="" fontFamily={MONO} fontWeight={600} fontSize={72} fill={INK} x={TITLE_X} y={10} offset={[-1, 0]} />
    <Rect ref={tail} size={[40, 80]} fill={GREEN} x={TITLE_X} y={10} />
  </Node>);
  yield* enter(open(), 0.3);
  yield* typeLine(title, tail, 'Gajinya pergi ke mana?', TITLE_X, 72, 1.5);

  /* Kertas: tabel masuk, diurutkan, tiga teratas disorot satu per satu */
  yield* until(c.table - LEAD);
  const board = createRef<Node>();
  const TX = -860;
  const TW = 1020;
  const ROW = 96;
  const ROW_TOP = -190;
  const BOARD_CENTERED = -(TX + TW / 2);
  const rows = ITEMS.map(() => createRef<Node>());
  const fills = ITEMS.map(() => createRef<Rect>());
  const amounts = ITEMS.map(() => createRef<Txt>());
  const BAR_MAX = 300;
  yield* backs.shutter('paper', () => {
    open().remove();
    stage().add(<Node ref={board} x={BOARD_CENTERED}>
      <Rect size={[TW, 730]} radius={16} x={TX + TW / 2} y={45} fill={PAPER_CARD} stroke={PAPER_EDGE} lineWidth={2} shadowColor="#14201a33" shadowBlur={40} shadowOffset={[0, 14]} />
      <Txt text={`Pengeluaran dari gaji ${rupiah(SALARY)}`} fontFamily={SANS} fontWeight={700} fontSize={42} fill={DARK_INK} x={TX + 40} y={-275} offset={[-1, 0]} />
      {ITEMS.map(([label, value], i) => (
        <Node ref={rows[i]} y={ROW_TOP + i * ROW} opacity={0}>
          <Txt text={label} fontFamily={SANS} fontWeight={500} fontSize={40} fill={DARK_INK} x={TX + 40} offset={[-1, 0]} />
          <Rect ref={fills[i]} size={[BAR_MAX * (value / 3000000), 24]} radius={12} x={TX + 310} offset={[-1, 0]} fill={DARK_MUTED} />
          <Txt ref={amounts[i]} text={rupiah(value)} fontFamily={MONO} fontWeight={500} fontSize={36} fill={DARK_INK} x={TX + TW - 40} offset={[1, 0]} />
        </Node>
      ))}
    </Node>);
  });
  yield* sequence(0.1, ...rows.map(row => row().opacity(1, 0.2)));

  yield* until(c.sort);
  yield* all(...SORTED.map((item, rank) => rows[item]().y(ROW_TOP + rank * ROW, 0.6, easeInOutCubic)));
  yield* all(...SORTED.slice(3).map(item => rows[item]().opacity(0.4, 0.3)));
  for (let rank = 0; rank < 3; rank++) {
    yield* until(c[`t${rank}`]);
    const item = SORTED[rank];
    spawn(all(fills[item]().fill(DEEP_GREEN, 0.2), amounts[item]().fill(DEEP_GREEN, 0.2)));
    spawn(rows[item]().scale(1.03, 0.1).to(1, 0.2));
  }

  /* Total: cincin 70 persen di kanan tabel */
  yield* until(c.total);
  const ring = createRef<Node>();
  const sweep = createSignal(-90);
  const share = createRef<Txt>();
  const totalText = createRef<Txt>();
  const RX = 540;
  stage().add(<Node ref={ring} x={RX} y={45}>
    <Circle size={420} stroke={PAPER_EDGE} lineWidth={38} />
    <Circle size={420} stroke={DEEP_GREEN} lineWidth={38} lineCap="round" startAngle={-90} endAngle={sweep} />
    <Txt ref={share} text="0%" fontFamily={MONO} fontWeight={600} fontSize={108} fill={DARK_INK} />
    <Txt ref={totalText} text={rupiah(0)} fontFamily={MONO} fontWeight={600} fontSize={48} fill={DEEP_GREEN} y={305} />
    <Txt text="tiga pos terbesar" fontFamily={SANS} fontWeight={500} fontSize={34} fill={DARK_MUTED} y={-295} />
  </Node>);
  spawn(board().x(0, 0.5, easeInOutCubic));
  yield* enter(ring(), 0.3);
  yield* all(
    sweep(-90 + 360 * 0.7, 1.8, easeInOutCubic),
    tween(1.8, t => {
      const part = easeInOutCubic(t);
      share().text(`${Math.round(70 * part)}%`);
      totalText().text(rupiah(7000000 * part));
    }),
  );

  /* Grafik: turun tajam dulu, lalu pelan dan tidak pernah naik */
  yield* until(c.chart - LEAD);
  const chart = createRef<Node>();
  const drawn = createSignal(0);
  const CW = 1500;
  const CH = 560;
  const px = (day: number) => -CW / 2 + ((day - 1) / 29) * CW;
  const py = (million: number) => CH / 2 - (million / 10) * CH;
  const points = BALANCE.map(([day, value]) => new Vector2(px(day), py(value)));
  const steep = createRef<Txt>();
  const empty = createRef<Txt>();
  const first = createRef<Circle>();
  yield* backs.iris('grid', [RX, 60], () => {
    board().remove();
    ring().remove();
    stage().add(<Node ref={chart} y={40}>
      <Txt text="Saldo per tanggal" fontFamily={SANS} fontWeight={700} fontSize={46} fill={INK} x={-CW / 2} y={-CH / 2 - 75} offset={[-1, 0]} />
      {[0, 5, 10].map(value => (
        <Node y={py(value)}>
          <Rect size={[CW, 2]} fill={EDGE} />
          <Txt text={`${value} jt`} fontFamily={MONO} fontWeight={500} fontSize={28} fill={MUTED} x={-CW / 2 - 22} offset={[1, 0]} />
        </Node>
      ))}
      {[1, 10, 20, 30].map(day => (
        <Txt text={`tgl ${day}`} fontFamily={MONO} fontWeight={500} fontSize={28} fill={MUTED} x={px(day)} y={CH / 2 + 42} />
      ))}
      <Line points={points} stroke={GREEN} lineWidth={9} lineCap="round" lineJoin="round" end={drawn} />
      <Circle ref={first} size={26} fill={GREEN} position={points[0]} />
      <Txt text="Gajian" fontFamily={MONO} fontWeight={600} fontSize={32} fill={GREEN} x={px(1) + 28} y={py(10) + 2} offset={[-1, 0]} />
      <Txt ref={steep} text={`Tanggal 3: ${rupiah(6500000)}`} fontFamily={SANS} fontWeight={700} fontSize={40} fill={INK} x={px(3) + 40} y={py(6.5) - 34} offset={[-1, 0]} opacity={0} />
      <Txt ref={empty} text="Nggak pernah naik lagi" fontFamily={SANS} fontWeight={700} fontSize={40} fill={RED} x={px(30)} y={py(1.9) - 40} offset={[1, 0]} opacity={0} />
    </Node>);
  }, DEEP_GREEN);
  /* Titik 3 dari 8 ada di sekitar 35 persen panjang garis, jadi garis berhenti sebentar di tanggal 3 */
  const SHARE_TO_DAY_3 = points[0].sub(points[1]).magnitude / points.slice(1).reduce((sum, p, i) => sum + p.sub(points[i]).magnitude, 0);
  yield* until(c.payday);
  yield* drawn(SHARE_TO_DAY_3, c.three + 1.2 - c.payday, easeInOutCubic);
  yield* steep().opacity(1, 0.2);
  yield* until(c.slow);
  yield* drawn(1, 1.8, easeInOutCubic);
  yield* empty().opacity(1, 0.25);

  /* Analogi: ban bocor halus */
  yield* until(c.tire - LEAD);
  const scene = createRef<Node>();
  const wheel = tire(PAPER);
  yield* backs.shutter('paper', () => {
    chart().remove();
    stage().add(<Node ref={scene}>
      <Txt text="Ban bocor halus" fontFamily={SANS} fontWeight={700} fontSize={84} fill={DARK_INK} x={-820} y={-160} offset={[-1, 0]} />
      <Txt text="nggak kerasa, tahu-tahu kempes" fontFamily={SANS} fontWeight={500} fontSize={46} fill={DARK_MUTED} x={-820} y={-60} offset={[-1, 0]} />
      <Node x={420} y={20} scale={1.25}>{wheel.node}</Node>
    </Node>);
  }, DARK_INK);
  yield* wheel.deflate(Math.max(0.5, c.flat - c.tire));

  /* Kesimpulan di kantor malam: dari enam pos, cukup satu */
  yield* until(c.dont - LEAD);
  const choose = createRef<Node>();
  const chips = SORTED.map(() => createRef<Rect>());
  const line = createRef<Txt>();
  const CHIP_W = 480;
  const CHIP_H = 130;
  const chipX = (i: number) => (i % 3 - 1) * (CHIP_W + 30);
  const chipY = (i: number) => (i < 3 ? 0 : CHIP_H + 30) + 10;
  yield* backs.shutter('video:/klik/stock/office_h.mp4|0.68', () => {
    scene().remove();
    stage().add(<Node ref={choose}>
      <Txt ref={line} text="Jangan potong semuanya." fontFamily={SANS} fontWeight={700} fontSize={76} fill={INK} y={-210} shadowColor="#000000" shadowBlur={24} />
      {SORTED.map((item, i) => (
        <Rect ref={chips[i]} size={[CHIP_W, CHIP_H]} radius={14} x={chipX(i)} y={chipY(i)} fill={PANEL} stroke={EDGE} lineWidth={2}>
          <Txt text={ITEMS[item][0]} fontFamily={SANS} fontWeight={500} fontSize={44} fill={INK} />
        </Rect>
      ))}
    </Node>);
  });
  yield* until(c.pick);
  line().text('Pilih satu yang bisa ditawar.');
  line().fill(GREEN);
  const CHOSEN = 1;
  const cursor = pointer(choose(), [860, 500], 1.8);
  spawn(all(...chips.map((chip, i) => (i === CHOSEN ? chip().stroke(GREEN, 0.3) : chip().opacity(0.3, 0.4)))));
  yield* cursor.clickAt([chipX(CHOSEN) + 10, chipY(CHOSEN) + 20], 0.5);
  yield* chips[CHOSEN]().scale(1.08, 0.24, easeOutBack);
  yield* until(c.only);
  line().text('Satu aja.');
  yield* line().scale(1.18, 0.2, easeOutCubic);
  yield* until(job.duration);
}
