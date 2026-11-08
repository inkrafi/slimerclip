/**
 * Video dari proyek aplikasi, 9:16 atau 16:9, dengan gaya contoh channel: tiap adegan punya latar dan bentuk sendiri.
 * Latar dan bentuk dipilih backend/klik_render.py. Isinya dari scene.motion, yang bisa diedit di studio.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, createSignal, easeInOutCubic, easeOutBack, easeOutCubic, linear, sequence, spawn, ThreadGenerator, tween, useThread, Vector2} from '@revideo/core';
import {bowl, commentBubble, laptop, phone, receiptShape, tire, tremble, wallet} from './illustrations';
import {
  Backdrop, Backdrops, captions, DARK_INK, DARK_MUTED, DEEP_GREEN, DEEP_RED, EDGE, GREEN, INK, MONO, MUTED, PANEL, PAPER, PAPER_CARD, PAPER_EDGE, pointer, RED, SANS, statusBar, typeLine, until,
} from './system';

const LEAD = 0.18;

export interface Tone { ink: string; muted: string; accent: string; bad: string; card: string; edge: string; shadow: string }
export interface Box { wide: boolean; width: number; top: number; bottom: number }
type Motion = Record<string, any>;

export function toneFor(backdrop: Backdrop): Tone {
  if (backdrop === 'paper') return {ink: DARK_INK, muted: DARK_MUTED, accent: DEEP_GREEN, bad: DEEP_RED, card: PAPER_CARD, edge: PAPER_EDGE, shadow: '#00000000'};
  if (backdrop === 'red' || backdrop.startsWith('red:')) return {ink: INK, muted: INK, accent: INK, bad: INK, card: DARK_INK, edge: INK, shadow: '#00000000'};
  if (backdrop === 'green') return {ink: DARK_INK, muted: DARK_INK, accent: DARK_INK, bad: DEEP_RED, card: DARK_INK, edge: DARK_INK, shadow: '#00000000'};
  return {ink: INK, muted: MUTED, accent: GREEN, bad: RED, card: PANEL, edge: EDGE, shadow: '#000000'};
}

/** Angka besar dibulatkan ke ribuan, supaya hitungan berjalan tidak terlihat seperti Rp528.798 */
function amount(value: number, motion: Motion, digits = 0) {
  const shown = Math.abs(value) >= 100000 ? Math.round(value / 1000) * 1000 : value;
  return `${motion.prefix ?? ''}${shown.toLocaleString('id-ID', {minimumFractionDigits: digits, maximumFractionDigits: digits})}${motion.suffix ?? ''}`;
}

export function* kinetic(group: Node, motion: Motion, tone: Tone, box: Box, seconds: number): ThreadGenerator {
  const words: string[] = motion.words;
  const refs = words.map(() => createRef<Txt>());
  const big = box.wide ? 118 : 128;
  const gap = big * 1.2;
  const top = -(words.length - 1) * gap / 2;
  if (motion.lead) group.add(<Txt text={motion.lead} fontFamily={MONO} fontWeight={600} fontSize={46} fill={tone.accent} y={top - gap * 0.9} shadowColor={tone.shadow} shadowBlur={20} />);
  words.forEach((word, i) => group.add(
    <Txt ref={refs[i]} text={word} fontFamily={SANS} fontWeight={700} fontSize={word.length > (box.wide ? 20 : 12) ? big * 0.72 : big} fill={i === words.length - 1 ? tone.accent : tone.ink}
      y={top + i * gap} opacity={0} scale={0.82} shadowColor={tone.shadow} shadowBlur={28} />,
  ));
  if (motion.note) group.add(<Txt text={motion.note} fontFamily={SANS} fontWeight={500} fontSize={42} fill={tone.ink} y={top + words.length * gap} width={box.width} textAlign="center" textWrap shadowColor={tone.shadow} shadowBlur={20} />);
  yield* sequence(Math.max(0.28, (seconds * 0.7) / words.length), ...refs.map(ref => all(ref().opacity(1, 0.12), ref().scale(1, 0.3, easeOutBack))));
}

export function* data(group: Node, motion: Motion, tone: Tone, box: Box, seconds: number): ThreadGenerator {
  const values: number[] = motion.values;
  const digits = values.some(v => !Number.isInteger(v)) ? 1 : 0;
  const number = createRef<Txt>();
  const draw = createSignal(0);
  const CW = box.wide ? 900 : 780;
  const CH = box.wide ? 480 : 340;
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const cx = box.wide ? 300 : 0;
  const cy = box.wide ? 60 : 170;
  const points = values.map((v, i) => new Vector2(cx - CW / 2 + (i / (values.length - 1)) * CW, cy + CH / 2 - ((v - low) / span) * CH));
  const tx = box.wide ? -500 : 0;
  group.add(<Txt text={motion.title} fontFamily={SANS} fontWeight={700} fontSize={box.wide ? 54 : 62} fill={tone.ink} x={tx} y={box.wide ? -130 : -410} width={box.wide ? 560 : 840} textAlign="center" textWrap />);
  group.add(<Txt ref={number} text={amount(values[0], motion, digits)} fontFamily={MONO} fontWeight={600} fontSize={values.join('').length > 12 ? 82 : 110} fill={tone.accent} x={tx} y={box.wide ? 30 : -200} />);
  if (motion.caption) group.add(<Txt text={motion.caption} fontFamily={MONO} fontWeight={500} fontSize={36} fill={tone.muted} x={tx} y={box.wide ? 115 : -110} />);
  if (motion.note) group.add(<Txt text={motion.note} fontFamily={SANS} fontWeight={500} fontSize={32} fill={tone.muted} x={tx} y={box.wide ? 190 : 395} width={box.wide ? 560 : 840} textAlign="center" textWrap />);
  group.add(<Rect size={[CW + 70, CH + 70]} x={cx} y={cy} radius={18} fill={tone.card} stroke={tone.edge} lineWidth={2} />);
  group.add(<Line points={points} stroke={tone.accent} lineWidth={10} lineCap="round" lineJoin="round" end={draw} />);
  const run = Math.min(3, Math.max(0.8, seconds - 0.8));
  yield* all(draw(1, run, easeInOutCubic), tween(run, t => {
    number().text(amount(values[0] + (values[values.length - 1] - values[0]) * easeInOutCubic(t), motion, digits));
  }));
}

export function* compare(group: Node, motion: Motion, tone: Tone, box: Box, seconds: number): ThreadGenerator {
  const sides = [motion.left, motion.right];
  const cards = sides.map(() => createRef<Node>());
  const size: [number, number] = box.wide ? [760, 560] : [860, 410];
  const place = box.wide ? [{x: -410, y: 20, from: [-1300, 20]}, {x: 410, y: 20, from: [1300, 20]}] : [{x: 0, y: -250, from: [-1100, -250]}, {x: 0, y: 190, from: [1100, 190]}];
  sides.forEach((side, s) => group.add(
    <Node ref={cards[s]} position={place[s].from as [number, number]}>
      <Rect size={size} radius={20} fill={tone.card} stroke={s === 1 ? tone.accent : tone.edge} lineWidth={s === 1 ? 5 : 2} />
      <Txt text={side.title} fontFamily={SANS} fontWeight={700} fontSize={58} fill={s === 1 ? tone.accent : tone.ink} x={-size[0] / 2 + 45} y={-size[1] / 2 + 65} offset={[-1, 0]} />
      {side.items.map((item: string, i: number) => (
        <Txt text={item} fontFamily={SANS} fontWeight={500} fontSize={44} fill={tone.ink} x={-size[0] / 2 + 45} y={-size[1] / 2 + 155 + i * 84} offset={[-1, 0]} />
      ))}
    </Node>,
  ));
  yield* sequence(Math.max(0.5, seconds * 0.4), ...cards.map((card, s) => card().position([place[s].x, place[s].y], 0.42, easeOutCubic)));
}

export function* flow(group: Node, motion: Motion, tone: Tone, box: Box, seconds: number): ThreadGenerator {
  const steps: {head: string; body: string}[] = motion.steps;
  const rows = steps.map(() => createRef<Node>());
  const wide = box.wide;
  const GAP = wide ? 400 : 190;
  const start = -(steps.length - 1) * GAP / 2;
  const rail = createSignal(0);
  const at = (i: number): [number, number] => (wide ? [start + i * GAP, 40] : [0, start + i * GAP + 60]);
  group.add(<Txt text={motion.title} fontFamily={SANS} fontWeight={700} fontSize={62} fill={tone.ink} y={wide ? -230 : start - 130} width={box.width} textAlign="center" textWrap />);
  group.add(<Line points={wide ? [[start, -30], [start + (steps.length - 1) * GAP, -30]] : [[-370, start + 60], [-370, start + 60 + (steps.length - 1) * GAP]]} stroke={tone.accent} lineWidth={8} end={rail} />);
  steps.forEach((step, i) => group.add(
    <Node ref={rows[i]} position={at(i)} opacity={0}>
      <Circle size={54} x={wide ? 0 : -370} y={wide ? -70 : 0} fill={tone.accent} />
      <Txt text={String(i + 1)} fontFamily={MONO} fontWeight={600} fontSize={32} fill={tone.card} x={wide ? 0 : -370} y={wide ? -70 : 0} />
      <Txt text={step.head} fontFamily={SANS} fontWeight={700} fontSize={wide ? 46 : 56} fill={tone.ink} x={wide ? 0 : -300} y={wide ? 20 : step.body ? -30 : 0} offset={wide ? [0, 0] : [-1, 0]} />
      {step.body ? <Txt text={step.body} fontFamily={SANS} fontWeight={500} fontSize={wide ? 32 : 38} fill={tone.muted} x={wide ? 0 : -300} y={wide ? 90 : 34} width={wide ? 340 : 700} textWrap textAlign={wide ? 'center' : 'left'} offset={wide ? [0, 0] : [-1, 0]} /> : null}
    </Node>,
  ));
  spawn(rail(1, Math.max(0.6, seconds - 0.6), linear));
  yield* sequence(Math.max(0.25, (seconds - 0.8) / steps.length), ...rows.map(row => row().opacity(1, 0.25)));
}

/** Struk di 9:16, tabel bergaris di 16:9. Tiap baris muncul saat labelnya diucapkan, saldo ikut berkurang. */
export function* ledger(group: Node, motion: Motion, tone: Tone, box: Box, cues: number[]): ThreadGenerator {
  const list: {label: string; value: number}[] = motion.rows;
  const refs = list.map(() => createRef<Node>());
  const remain = createRef<Txt>();
  const start = motion.start ?? 0;
  const wide = box.wide;
  const paperInk = DARK_INK;
  const W = wide ? 1100 : 800;
  const ROW = wide ? 76 : 92;
  const H = 300 + list.length * ROW;
  const LX = -W / 2 + 46;
  const rowTop = -H / 2 + 200;
  const biggest = Math.max(...list.map(row => row.value));
  group.add(<Node>
    {wide
      ? <Rect size={[W, H]} radius={16} fill={PAPER_CARD} stroke={PAPER_EDGE} lineWidth={2} shadowColor="#14201a33" shadowBlur={40} shadowOffset={[0, 14]} />
      : receiptShape(W, H)}
    <Txt text={motion.title} fontFamily={wide ? SANS : MONO} fontWeight={wide ? 700 : 600} fontSize={wide ? 44 : 40} fill={paperInk} y={-H / 2 + 62} x={wide ? LX : 0} offset={wide ? [-1, 0] : [0, 0]} />
    {start ? <>
      <Txt text="Awal" fontFamily={SANS} fontWeight={500} fontSize={40} fill={DARK_MUTED} x={LX} y={-H / 2 + 130} offset={[-1, 0]} />
      <Txt text={amount(start, motion)} fontFamily={MONO} fontWeight={600} fontSize={40} fill={paperInk} x={-LX} y={-H / 2 + 130} offset={[1, 0]} />
    </> : null}
    {list.map((row, i) => (
      <Node ref={refs[i]} y={rowTop + i * ROW} opacity={0}>
        <Txt text={row.label} fontFamily={SANS} fontWeight={500} fontSize={44} fill={paperInk} x={LX} offset={[-1, 0]} />
        {wide ? <Rect size={[420 * (row.value / biggest), 22]} radius={11} x={LX + 300} offset={[-1, 0]} fill={DEEP_GREEN} /> : null}
        <Txt text={`${start ? '-' : ''}${amount(row.value, motion)}`} fontFamily={MONO} fontWeight={500} fontSize={40} fill={start ? DEEP_RED : paperInk} x={-LX} offset={[1, 0]} />
      </Node>
    ))}
    <Rect size={[W - 92, 3]} y={H / 2 - 90} fill={PAPER_EDGE} />
    <Txt text={motion.result || (start ? 'Sisa' : 'Total')} fontFamily={SANS} fontWeight={700} fontSize={46} fill={paperInk} x={LX} y={H / 2 - 45} offset={[-1, 0]} />
    <Txt ref={remain} text={amount(start, motion)} fontFamily={MONO} fontWeight={600} fontSize={52} fill={paperInk} x={-LX} y={H / 2 - 45} offset={[1, 0]} />
  </Node>);
  let current = start;
  for (let i = 0; i < list.length; i++) {
    yield* until(cues[i] ?? 0);
    const from = current;
    const to = start ? current - list[i].value : current + list[i].value;
    current = to;
    const y = rowTop + i * ROW;
    refs[i]().y(y - 24);
    spawn(all(refs[i]().opacity(1, 0.12), refs[i]().y(y, 0.22, easeOutCubic)));
    spawn(tween(0.4, t => remain().text(amount(from + (to - from) * easeOutCubic(t), motion))));
  }
}

export function* numberScene(group: Node, motion: Motion, tone: Tone, box: Box, seconds: number): ThreadGenerator {
  const figure = createRef<Txt>();
  const value: number = motion.value;
  const digits = Number.isInteger(value) ? 0 : 1;
  const big = amount(value, motion, digits).length > 11 ? 110 : box.wide ? 190 : 148;
  group.add(<Txt text={motion.label} fontFamily={MONO} fontWeight={600} fontSize={54} fill={tone.ink} y={-big * 0.95} width={box.width} textAlign="center" textWrap />);
  group.add(<Txt ref={figure} text={amount(0, motion, digits)} fontFamily={MONO} fontWeight={600} fontSize={big} fill={tone.accent} scale={0.8} />);
  if (motion.note) group.add(<Txt text={motion.note} fontFamily={SANS} fontWeight={500} fontSize={44} fill={tone.ink} y={big * 0.95} width={box.width} textAlign="center" textWrap />);
  yield* all(figure().scale(1, 0.3, easeOutBack), tween(Math.min(1, seconds * 0.4), t => figure().text(amount(value * easeOutCubic(t), motion, digits))));
  figure().text(amount(value, motion, digits));
}

export function* share(group: Node, motion: Motion, tone: Tone, box: Box, seconds: number): ThreadGenerator {
  const sweep = createSignal(-90);
  const text = createRef<Txt>();
  const percent: number = motion.percent;
  const size = box.wide ? 480 : 520;
  group.add(<Circle size={size} stroke={tone.edge} lineWidth={40} y={-20} />);
  group.add(<Circle size={size} stroke={tone.accent} lineWidth={40} lineCap="round" startAngle={-90} endAngle={sweep} y={-20} />);
  group.add(<Txt ref={text} text="0%" fontFamily={MONO} fontWeight={600} fontSize={120} fill={tone.ink} y={-20} />);
  group.add(<Txt text={motion.label} fontFamily={SANS} fontWeight={700} fontSize={54} fill={tone.ink} y={-20 - size / 2 - 80} width={box.width} textAlign="center" textWrap />);
  if (motion.note) group.add(<Txt text={motion.note} fontFamily={SANS} fontWeight={500} fontSize={42} fill={tone.muted} y={-20 + size / 2 + 70} width={box.width} textAlign="center" textWrap />);
  const run = Math.min(2, Math.max(0.7, seconds - 0.6));
  yield* all(sweep(-90 + 3.6 * percent, run, easeInOutCubic), tween(run, t => text().text(`${Math.round(percent * easeInOutCubic(t))}%`)));
}

export function* verdict(group: Node, motion: Motion, tone: Tone, box: Box, cues: number[]): ThreadGenerator {
  const stamp = createRef<Node>();
  group.add(<Txt text={motion.question} fontFamily={SANS} fontWeight={700} fontSize={box.wide ? 110 : 128} lineHeight="108%" fill={tone.ink} y={-70} width={box.width} textAlign="center" textWrap />);
  group.add(<Node ref={stamp} y={box.wide ? 210 : 280} rotation={-6} opacity={0} scale={1.6}>
    <Rect size={[Math.max(420, motion.answer.length * 48 + 90), 130]} radius={14} stroke={DEEP_RED} lineWidth={10} />
    <Txt text={motion.answer} fontFamily={MONO} fontWeight={600} fontSize={72} fill={DEEP_RED} />
  </Node>);
  yield* until(cues[0] ?? 0);
  yield* all(stamp().opacity(1, 0.08), stamp().scale(1, 0.18, easeOutCubic));
}

function* picture(group: Node, motion: Motion, tone: Tone, box: Box, seconds: number, duration: number): ThreadGenerator {
  const art = createRef<Node>();
  const wide = box.wide;
  const artX = wide ? 420 : 0;
  const artY = wide ? 20 : 160;
  const textX = wide ? -860 : 0;
  group.add(<Txt text={motion.title} fontFamily={SANS} fontWeight={700} fontSize={wide ? 84 : 76} fill={tone.ink} x={textX} y={wide ? -100 : -500} offset={wide ? [-1, 0] : [0, 0]} width={wide ? 840 : box.width} textAlign={wide ? 'left' : 'center'} textWrap />);
  if (motion.note) group.add(<Txt text={motion.note} fontFamily={SANS} fontWeight={500} fontSize={44} fill={tone.muted} x={textX} y={wide ? 40 : -390} offset={wide ? [-1, 0] : [0, 0]} width={wide ? 840 : box.width} textAlign={wide ? 'left' : 'center'} textWrap />);
  void duration;
  if (motion.name === 'tire') {
    const wheel = tire(tone.card === PAPER_CARD ? PAPER : '#0a0f0d');
    group.add(<Node x={artX} y={artY} scale={wide ? 1.2 : 1.3}>{wheel.node}</Node>);
    yield* wheel.deflate(Math.max(0.6, seconds - 0.8));
    return;
  }
  if (motion.name === 'phone') {
    const beat = createSignal(0);
    group.add(<Node x={artX} y={artY + (wide ? 0 : 40)} scale={wide ? 0.95 : 0.84}>{phone(motion.screen || '', art, beat, {app: motion.title.slice(0, 16), caption: '', footer: ''})}</Node>);
    spawn(beat(1, 0.8, easeInOutCubic));
    spawn(tremble(art(), Math.max(0.5, seconds - 0.4)));
    return;
  }
  const make = motion.name === 'bowl' ? bowl : motion.name === 'laptop' ? laptop : wallet;
  group.add(<Node ref={art} x={artX} y={artY + 60} scale={0.7} opacity={0}>{make(wide ? 1.5 : 1.7)}</Node>);
  yield* all(art().opacity(1, 0.15), art().scale(1, 0.34, easeOutBack));
}

function* choice(group: Node, motion: Motion, tone: Tone, box: Box, cues: number[]): ThreadGenerator {
  const options: string[] = motion.options;
  const chips = options.map(() => createRef<Rect>());
  const line = createRef<Txt>();
  const wide = box.wide;
  const COLS = wide ? 3 : 1;
  const CW = wide ? 480 : 760;
  const CH = wide ? 130 : 108;
  const x = (i: number) => (wide ? (i % COLS - (Math.min(options.length, COLS) - 1) / 2) * (CW + 30) : 0);
  const y = (i: number) => Math.floor(i / COLS) * (CH + 24) + (wide ? 0 : -110);
  group.add(<Txt ref={line} text={motion.title} fontFamily={SANS} fontWeight={700} fontSize={wide ? 72 : 76} fill={INK} y={wide ? -210 : -340} width={box.width} textAlign="center" textWrap shadowColor="#000000" shadowBlur={24} />);
  options.forEach((option, i) => group.add(
    <Rect ref={chips[i]} size={[CW, CH]} radius={16} x={x(i)} y={y(i)} fill={PANEL} stroke={EDGE} lineWidth={2}>
      <Txt text={option} fontFamily={SANS} fontWeight={700} fontSize={44} fill={INK} />
    </Rect>,
  ));
  const picked = Math.min(motion.pick ?? 0, options.length - 1);
  yield* until(cues[0] ?? 0);
  if (motion.result) {
    line().text(motion.result);
    line().fill(GREEN);
  }
  spawn(all(...chips.map((chip, i) => (i === picked ? chip().stroke(GREEN, 0.3) : chip().opacity(0.32, 0.4)))));
  const cursor = pointer(group, [wide ? 860 : 430, wide ? 500 : 800], 1.8);
  yield* cursor.clickAt([x(picked) + 10, y(picked) + 24], 0.45);
  yield* chips[picked]().scale(1.06, 0.2, easeOutBack);
  void tone;
}

function statement(group: Node, text: string, tone: Tone, box: Box) {
  group.add(<Txt text={text} fontFamily={SANS} fontWeight={700} fontSize={box.wide ? (text.length > 150 ? 62 : 80) : text.length > 110 ? 64 : 84} lineHeight="125%" fill={tone.ink} width={box.wide ? 1500 : 850} textAlign="left" textWrap y={box.wide ? 0 : -60} />);
}

function* question(group: Node, text: string, box: Box, end: number, seconds: number): ThreadGenerator {
  const w = box.wide ? 1300 : 880;
  const h = box.wide ? 480 : 560;
  group.add(<Node y={box.wide ? 0 : -90}>{commentBubble(w, h)}</Node>);
  group.add(<Txt text={text} fontFamily={SANS} fontWeight={700} fontSize={text.length > 90 ? 60 : 74} lineHeight="122%" fill={INK} width={w - 100} textAlign="left" textWrap y={box.wide ? 0 : -90} />);
  const cursor = pointer(group, box.wide ? [900, 620] : [430, 800]);
  yield* until(end - Math.min(1, seconds * 0.3));
  yield* cursor.clickAt(box.wide ? [460, 150] : [250, 130], 0.4);
}

/** Pembuka bab: judul diketik di layar, seperti contoh longform. */
function* chapterCard(group: Node, title: string, index: number, seconds: number): ThreadGenerator {
  const text = createRef<Txt>();
  const tail = createRef<Rect>();
  const X = -760;
  const size = title.length > 28 ? 56 : 72;
  group.add(<Txt text={`BAB ${String(index).padStart(2, '0')}`} fontFamily={MONO} fontWeight={600} fontSize={44} fill={GREEN} x={X} y={-95} offset={[-1, 0]} />);
  group.add(<Txt ref={text} text="" fontFamily={MONO} fontWeight={600} fontSize={size} fill={INK} x={X} y={10} offset={[-1, 0]} />);
  group.add(<Rect ref={tail} size={[size * 0.55, size * 1.1]} fill={GREEN} x={X} y={10} />);
  yield* typeLine(text, tail, title, X, size, Math.min(1, seconds * 0.5));
}

export function* auto(view: View2D, job: Record<string, any>): ThreadGenerator {
  const wide = job.layout === 'long';
  const W = wide ? 1920 : 1080;
  const H = wide ? 1080 : 1920;
  const box: Box = wide ? {wide, width: 1500, top: -400, bottom: 440} : {wide, width: 860, top: -660, bottom: 370};
  const backs = new Backdrops(view, W, H, job.duration);
  const scenes: Record<string, any>[] = job.scenes;
  backs.set(scenes[0].chapter && wide ? 'grid' : scenes[0].backdrop);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} x={wide ? 0 : -30} y={wide ? 20 : -110} />);
  backs.mountCover();
  const channel = String(job.channel || '').toUpperCase();
  if (wide) statusBar(view, -480, 880, 'SUMBER DI DESKRIPSI', 26, channel);
  if (job.words.length) captions(view, job.words, 500, 62, job.duration);
  spawn(stage().scale(wide ? 1.03 : 1.04, job.duration, linear));

  let current: Node | null = null;
  let chapters = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const motion: Motion = scene.motion ?? {};
    const tone = toneFor(scene.backdrop);
    const cues: number[] = scene.cues ?? [];
    const cover = scene.backdrop === 'green' ? INK : scene.backdrop === 'paper' ? DARK_INK : GREEN;
    const hasCard = wide && !!scene.chapter && scene.end - scene.start > 3;

    const group = new Node({});
    const show = (node: Node) => () => {
      current?.remove();
      stage().add(node);
      current = node;
    };
    if (i > 0) yield* until(scene.start - LEAD);

    if (hasCard) {
      // Kartu bab di kisi gelap dulu, baru isi adegan
      chapters += 1;
      const card = new Node({});
      const swap = show(card);
      if (i === 0) swap();
      else yield* backs.shutter('grid', swap, cover);
      yield* chapterCard(card, scene.chapter, chapters, scene.end - scene.start);
      yield* until(Math.min(scene.start + 2.2, scene.end - 1));
      yield* backs.iris(scene.backdrop, [0, 0], show(group), cover);
    } else if (i === 0) {
      show(group)();
    } else if (i % 3 === 1) {
      yield* backs.shutter(scene.backdrop, show(group), cover);
    } else if (i % 3 === 2) {
      yield* backs.iris(scene.backdrop, [0, wide ? 0 : 200], show(group), cover);
    } else {
      yield* backs.slide(scene.backdrop, show(group));
    }

    const seconds = Math.max(0.5, scene.end - useThread().time());
    if (scene.template === 'kinetic') yield* kinetic(group, motion, tone, box, seconds);
    else if (scene.template === 'data') yield* data(group, motion, tone, box, seconds);
    else if (scene.template === 'compare') yield* compare(group, motion, tone, box, seconds);
    else if (scene.template === 'flow') yield* flow(group, motion, tone, box, seconds);
    else if (scene.template === 'ledger') yield* ledger(group, motion, tone, box, cues);
    else if (scene.template === 'number') yield* numberScene(group, motion, tone, box, seconds);
    else if (scene.template === 'share') yield* share(group, motion, tone, box, seconds);
    else if (scene.template === 'verdict') yield* verdict(group, motion, tone, box, cues);
    else if (scene.template === 'picture') yield* picture(group, motion, tone, box, seconds, job.duration);
    else if (scene.template === 'choice') yield* choice(group, motion, tone, box, cues);
    else if (scene.template === 'statement') statement(group, scene.text, tone, box);
    else if (scene.template === 'question') yield* question(group, scene.text, box, scene.end, seconds);
  }
  yield* until(job.duration);
}
