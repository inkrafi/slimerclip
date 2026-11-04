/** Short 9:16: bedah gaji. Isi dan latar berganti tepat pada kata yang diucapkan (lihat klik.ts). */
import {Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, createSignal, easeInOutCubic, easeOutBack, easeOutCubic, linear, sequence, spawn, ThreadGenerator, tween} from '@revideo/core';
import {bowl, commentBubble, phone, receiptShape, tremble} from './illustrations';
import {
  Backdrops, captions, DARK_INK, DARK_MUTED, DEEP_RED, enter, EDGE, GREEN, INK, MONO, MUTED, PAPER_EDGE, pointer, RED, rupiah, SANS, statusBar, until,
} from './system';

const W = 1080;
const H = 1920;

const ITEMS: [string, number][] = [
  ['Kos', 3000000], ['Makan', 2500000], ['Cicilan', 1500000], ['Transport', 1000000], ['Nongkrong', 1000000], ['Langganan', 500000],
];
const SALARY = 10000000;
const AT_DAY_20 = 1900000;
const LEFT = SALARY - ITEMS.reduce((sum, [, value]) => sum + value, 0);
const LEAD = 0.2;   // transisi mulai sedikit sebelum katanya, supaya layar baru terbuka tepat saat kata diucapkan

export function* short(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  const backs = new Backdrops(view, W, H, job.duration);
  backs.set('video:/klik/stock/office_v.mp4|0.62');
  const stage = createRef<Node>();
  view.add(<Node ref={stage} x={-30} y={-110} />);
  backs.mountCover();
  statusBar(view, -770, 470, 'ANGKA CONTOH', 30);
  captions(view, job.words, 500, 62, job.duration);
  spawn(stage().scale(1.04, job.duration, linear));

  /* Hook: gajian di kantor malam, angkanya langsung terkuras */
  const hook = createRef<Node>();
  const label = createRef<Txt>();
  const balance = createRef<Txt>();
  stage().add(<Node ref={hook}>
    <Txt ref={label} text="GAJIAN" fontFamily={MONO} fontWeight={600} fontSize={52} fill={GREEN} y={-110} />
    <Txt ref={balance} text={rupiah(SALARY)} fontFamily={MONO} fontWeight={600} fontSize={118} fill={INK} shadowColor="#000000" shadowBlur={30} />
  </Node>);
  yield* enter(hook(), 0.25);
  yield* until(c.drain);
  label().text('TANGGAL 20');
  label().fill(RED);
  yield* all(tween(0.9, t => balance().text(rupiah(SALARY + (AT_DAY_20 - SALARY) * easeInOutCubic(t)))), balance().fill(RED, 0.9));

  /* Ponsel deg-degan */
  yield* until(c.phone - LEAD);
  const device = createRef<Node>();
  const beat = createSignal(0);
  yield* backs.shutter('grid', () => {
    hook().remove();
    stage().add(phone(rupiah(AT_DAY_20), device, beat));
  });
  spawn(beat(1, 0.8, easeInOutCubic));
  spawn(tremble(device(), c.ask - c.phone - 0.3));

  /* Kertas: pertanyaan yang dibantah stempel */
  yield* until(c.ask - LEAD);
  const asks = createRef<Node>();
  const stamp = createRef<Node>();
  yield* backs.iris('paper', [0, 200], () => {
    device().remove();
    stage().add(<Node ref={asks}>
      <Txt text="Gaji lu" fontFamily={SANS} fontWeight={700} fontSize={150} fill={DARK_INK} y={-110} />
      <Txt text="kurang?" fontFamily={SANS} fontWeight={700} fontSize={150} fill={DARK_INK} y={50} />
      <Node ref={stamp} y={230} rotation={-7} opacity={0} scale={1.6}>
        <Rect size={[620, 130]} radius={14} stroke={DEEP_RED} lineWidth={10} />
        <Txt text="BELUM TENTU" fontFamily={MONO} fontWeight={600} fontSize={72} fill={DEEP_RED} />
      </Node>
    </Node>);
  });
  yield* until(c.stamp);
  yield* all(stamp().opacity(1, 0.08), stamp().scale(1, 0.18, easeOutCubic));

  /* Struk: tiap pos tercetak saat disebut */
  yield* until(c.open - LEAD);
  const receipt = createRef<Node>();
  const RW = 800;
  const RH = 980;
  const LX = -RW / 2 + 46;
  const ROW_TOP = -200;
  const ROW_H = 92;
  const rows = ITEMS.map(() => createRef<Node>());
  const remain = createRef<Txt>();
  yield* backs.shutter('video:/klik/stock/bokeh_v.mp4|0.35', () => {
    asks().remove();
    stage().add(<Node ref={receipt} y={-1500}>
      {receiptShape(RW, RH)}
      <Txt text="STRUK BULAN INI" fontFamily={MONO} fontWeight={600} fontSize={40} fill={DARK_INK} y={-RH / 2 + 62} />
      <Txt text="Gaji" fontFamily={SANS} fontWeight={500} fontSize={42} fill={DARK_MUTED} x={LX} y={-300} offset={[-1, 0]} />
      <Txt text={rupiah(SALARY)} fontFamily={MONO} fontWeight={600} fontSize={42} fill={DARK_INK} x={-LX} y={-300} offset={[1, 0]} />
      <Rect size={[RW - 92, 3]} y={-256} fill={PAPER_EDGE} />
      {ITEMS.map(([name, value], i) => (
        <Node ref={rows[i]} y={ROW_TOP + i * ROW_H} opacity={0}>
          <Txt text={name} fontFamily={SANS} fontWeight={500} fontSize={46} fill={DARK_INK} x={LX} offset={[-1, 0]} />
          <Txt text={`-${rupiah(value)}`} fontFamily={MONO} fontWeight={500} fontSize={42} fill={DEEP_RED} x={-LX} offset={[1, 0]} />
        </Node>
      ))}
      <Rect size={[RW - 92, 3]} y={345} fill={PAPER_EDGE} />
      <Txt text="Saldo" fontFamily={SANS} fontWeight={700} fontSize={46} fill={DARK_INK} x={LX} y={410} offset={[-1, 0]} />
      <Txt ref={remain} text={rupiah(SALARY)} fontFamily={MONO} fontWeight={600} fontSize={56} fill={DARK_INK} x={-LX} y={410} offset={[1, 0]} />
    </Node>);
  });
  yield* receipt().y(-30, 0.5, easeOutCubic);

  let current = SALARY;
  for (let i = 0; i < ITEMS.length; i++) {
    yield* until(c[`r${i}`]);
    const from = current;
    current -= ITEMS[i][1];
    const to = current;
    rows[i]().y(ROW_TOP + i * ROW_H - 24);
    spawn(all(rows[i]().opacity(1, 0.12), rows[i]().y(ROW_TOP + i * ROW_H, 0.22, easeOutCubic)));
    spawn(tween(0.4, t => remain().text(rupiah(from + (to - from) * easeOutCubic(t)))));
    spawn(receipt().y(-30 - 8 * (i + 1), 0.3, easeOutCubic));
    if (i === 3) spawn(backs.fade('video:/klik/stock/scooter_v.mp4|0.45', 0.4));
    if (i === 4) spawn(backs.fade('video:/klik/stock/bokeh_v.mp4|0.35', 0.4));
  }

  /* Sisa: layar merah penuh */
  yield* until(c.left - LEAD);
  const end = createRef<Node>();
  const figure = createRef<Txt>();
  yield* backs.slide('red', () => {
    receipt().remove();
    stage().add(<Node ref={end}>
      <Txt text="SISANYA" fontFamily={MONO} fontWeight={600} fontSize={54} fill={INK} y={-130} />
      <Txt ref={figure} text={rupiah(LEFT)} fontFamily={MONO} fontWeight={600} fontSize={148} fill={INK} scale={0.7} />
      <Txt text={`dari ${rupiah(SALARY)}`} fontFamily={MONO} fontWeight={500} fontSize={44} fill={INK} y={120} />
    </Node>);
  });
  yield* figure().scale(1, 0.3, easeOutBack);

  /* Tiga pos terakhir yang disepelekan */
  yield* until(c.last3 - LEAD);
  const small = createRef<Node>();
  const chips = ITEMS.slice(3).map(() => createRef<Node>());
  const total = createRef<Txt>();
  const totalLabel = createRef<Txt>();
  const equal = createRef<Node>();
  yield* backs.shutter('grid', () => {
    end().remove();
    stage().add(<Node ref={small}>
      {ITEMS.slice(3).map(([name, value], i) => (
        <Node ref={chips[i]} y={-470 + i * 118} opacity={0} x={60}>
          <Rect size={[820, 102]} radius={16} fill="#111815ee" stroke={EDGE} lineWidth={2} />
          <Txt text={name} fontFamily={SANS} fontWeight={500} fontSize={46} fill={INK} x={-370} offset={[-1, 0]} />
          <Txt text={rupiah(value)} fontFamily={MONO} fontWeight={500} fontSize={42} fill={MUTED} x={370} offset={[1, 0]} />
        </Node>
      ))}
      <Txt ref={totalLabel} text="TOTAL" fontFamily={MONO} fontWeight={500} fontSize={40} fill={MUTED} y={-120} opacity={0} />
      <Txt ref={total} text={rupiah(0)} fontFamily={MONO} fontWeight={600} fontSize={118} fill={GREEN} y={-30} opacity={0} />
      <Node ref={equal} y={235} opacity={0}>
        <Node x={-235}>{bowl(0.72)}</Node>
        <Txt text="= uang makan" fontFamily={SANS} fontWeight={700} fontSize={60} fill={INK} x={-60} y={-38} offset={[-1, 0]} />
        <Txt text="sebulan" fontFamily={SANS} fontWeight={700} fontSize={60} fill={INK} x={-60} y={38} offset={[-1, 0]} />
      </Node>
    </Node>);
  });
  yield* sequence(0.12, ...chips.map(chip => all(chip().opacity(1, 0.2), chip().x(0, 0.28, easeOutCubic))));
  yield* until(c.sum);
  spawn(totalLabel().opacity(1, 0.2));
  yield* all(total().opacity(1, 0.12), tween(0.7, t => total().text(rupiah(2500000 * easeOutCubic(t)))));
  yield* until(c.same);
  yield* all(equal().opacity(1, 0.15), equal().y(205, 0.28, easeOutBack));

  /* Penutup tanpa kata perpisahan: pertanyaan yang memancing komentar */
  yield* until(c.question - LEAD);
  const closing = createRef<Node>();
  const options = ['Transport', 'Nongkrong', 'Langganan'].map(() => createRef<Rect>());
  yield* backs.iris('green', [0, 260], () => {
    small().remove();
    stage().add(<Node ref={closing}>
      <Node y={-250}>{commentBubble(860, 410)}</Node>
      <Txt text="Mana yang paling" fontFamily={SANS} fontWeight={700} fontSize={78} fill={INK} y={-330} />
      <Txt text="susah dipotong?" fontFamily={SANS} fontWeight={700} fontSize={78} fill={GREEN} y={-235} />
      <Txt text="Tulis di komentar" fontFamily={MONO} fontWeight={500} fontSize={38} fill={MUTED} y={-140} />
      {options.map((option, i) => (
        <Rect ref={option} size={[700, 92]} radius={46} x={0} y={70 + i * 108} fill={DARK_INK}>
          <Txt text={['Transport', 'Nongkrong', 'Langganan'][i]} fontFamily={SANS} fontWeight={700} fontSize={46} fill={INK} />
        </Rect>
      ))}
    </Node>);
  }, INK);
  const cursor = pointer(closing(), [430, 640]);
  yield* until(job.duration - 1.1);
  yield* cursor.clickAt([40, 180], 0.4);
  yield* options[1]().scale(1.05, 0.16, easeOutCubic);
  yield* until(job.duration);
}
