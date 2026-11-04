import {Circle, Line, Rect, Txt, View2D} from '@revideo/2d';
import {
  all, createRef, createSignal, easeInOutCubic, easeOutBack, easeOutCubic, map, sequence, ThreadGenerator, tween, Vector2, waitFor,
} from '@revideo/core';
import {ACCENT, BOLD, COOL, DISPLAY, INK, LINE, MUTED, PANEL, SANS, timing} from './common';

type Job = Record<string, any>;

/** Teks kinetik: pengantar lalu kata kunci yang mendarat besar. */
export function* kinetic(view: View2D, job: Job): ThreadGenerator {
  const words: string[] = job.words;
  const {pace, hold} = timing(job.seconds, 1.2 + words.length * 0.6 + 1.4);
  const lead = createRef<Txt>();
  const note = createRef<Txt>();
  const rule = createRef<Rect>();
  const refs = words.map(() => createRef<Txt>());
  const top = -110 - (words.length - 1) * 70;
  if (job.lead) view.add(<Txt ref={lead} text={job.lead} fontFamily={SANS} fontSize={50} fill={MUTED} y={top - 125} opacity={0} />);
  words.forEach((word, i) => view.add(
    <Txt ref={refs[i]} text={word} fontFamily={DISPLAY} fontStyle="italic" fontSize={word.length > 18 ? 118 : 158}
      fill={i === words.length - 1 ? ACCENT : INK} y={top + i * 145} opacity={0} scale={1.14}
      shadowColor="#000000aa" shadowBlur={30} />,
  ));
  const after = top + (words.length - 1) * 145;
  if (job.note) {
    view.add(<Rect ref={rule} width={0} height={4} fill={ACCENT} y={after + 105} />);
    view.add(<Txt ref={note} text={job.note} fontFamily={SANS} fontSize={42} fill={INK} y={after + 170} opacity={0} />);
  }
  if (job.lead) yield* lead().opacity(1, 0.5 * pace);
  yield* sequence(0.5 * pace, ...refs.map(ref => all(ref().opacity(1, 0.25 * pace), ref().scale(1, 0.45 * pace, easeOutCubic))));
  if (job.note) yield* all(rule().width(620, 0.6 * pace, easeInOutCubic), note().opacity(1, 0.6 * pace));
  yield* hold();
  yield* all(...refs.map(ref => ref().opacity(0, 0.3)), ...(job.lead ? [lead().opacity(0, 0.3)] : []),
    ...(job.note ? [note().opacity(0, 0.3), rule().opacity(0, 0.3)] : []));
}

/** Data: judul, angka yang menghitung, dan grafik garis yang tergambar sendiri. */
export function* data(view: View2D, job: Job): ThreadGenerator {
  const values: number[] = job.values;
  const {pace, hold} = timing(job.seconds, 5.2);
  const W = 1320;
  const H = 400;
  const left = -W / 2;
  const base = 170;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const points = values.map((v, i) => new Vector2(left + (i / (values.length - 1)) * W, base - ((v - lo) / span) * H));
  const label = (v: number) => {
    const digits = Number.isInteger(values[0]) && Number.isInteger(values[values.length - 1]) ? 0 : 1;
    return `${job.prefix ?? ''}${v.toLocaleString('id-ID', {maximumFractionDigits: digits, minimumFractionDigits: digits})}${job.suffix ?? ''}`;
  };
  const draw = createSignal(0);
  const title = createRef<Txt>();
  const number = createRef<Txt>();
  const caption = createRef<Txt>();
  const note = createRef<Txt>();
  const axis = createRef<Rect>();
  view.add(<Txt ref={title} text={job.title} fontFamily={SANS} fontSize={52} fill={INK} y={-400} opacity={0} />);
  view.add(<Rect ref={axis} width={0} height={3} fill={LINE} y={base + 35} />);
  view.add(<Line points={points} stroke={ACCENT} lineWidth={10} lineCap="round" lineJoin="round" end={draw} />);
  view.add(<Txt ref={number} text={label(values[0])} fontFamily={BOLD} fontSize={112} fill={ACCENT} x={240} y={-280} opacity={0} />);
  if (job.caption) view.add(<Txt ref={caption} text={job.caption} fontFamily={SANS} fontSize={38} fill={COOL} x={240} y={-195} opacity={0} />);
  if (job.note) view.add(<Txt ref={note} text={job.note} fontFamily={SANS} fontSize={30} fill={MUTED} y={base + 85} opacity={0} />);
  yield* all(title().opacity(1, 0.5 * pace), axis().width(W + 80, 0.8 * pace, easeInOutCubic));
  yield* number().opacity(1, 0.25 * pace);
  yield* all(draw(1, 3.4 * pace, easeInOutCubic), tween(3.4 * pace, t => {
    number().text(label(map(values[0], values[values.length - 1], easeInOutCubic(t))));
  }));
  yield* all(...(job.caption ? [caption().opacity(1, 0.4 * pace)] : []), ...(job.note ? [note().opacity(1, 0.4 * pace)] : []));
  yield* hold();
  yield* all(title().opacity(0, 0.3), number().opacity(0, 0.3), axis().opacity(0, 0.3), draw(0, 0.3),
    ...(job.caption ? [caption().opacity(0, 0.3)] : []), ...(job.note ? [note().opacity(0, 0.3)] : []));
}

/** Perbandingan: dua kolom masuk dari sisi berlawanan, lalu poinnya muncul bergantian. */
export function* compare(view: View2D, job: Job): ThreadGenerator {
  const sides = [{...job.left, x: -440, color: COOL}, {...job.right, x: 440, color: ACCENT}];
  const count = sides[0].items.length + sides[1].items.length;
  const {pace, hold} = timing(job.seconds, 1.2 + count * 0.5 + 0.6);
  const panels = sides.map(() => createRef<Rect>());
  const heads = sides.map(() => createRef<Txt>());
  const rows = sides.map(side => side.items.map(() => createRef<Txt>()));
  sides.forEach((side, s) => {
    view.add(<Rect ref={panels[s]} size={[800, 600]} x={side.x + (s === 0 ? -1100 : 1100)} y={-50} radius={22} fill={PANEL} stroke={LINE} lineWidth={2} />);
    view.add(<Txt ref={heads[s]} text={side.title} fontFamily={SANS} fontSize={50} fill={side.color} x={side.x} y={-260} opacity={0} />);
    side.items.forEach((item: string, i: number) => view.add(
      <Txt ref={rows[s][i]} text={item} fontFamily={SANS} fontSize={38} fill={INK} x={side.x} y={-120 + i * 110}
        width={700} textAlign="center" textWrap opacity={0} />,
    ));
  });
  yield* all(panels[0]().x(sides[0].x, 0.6 * pace, easeOutCubic), panels[1]().x(sides[1].x, 0.6 * pace, easeOutCubic));
  yield* all(heads[0]().opacity(1, 0.35 * pace), heads[1]().opacity(1, 0.35 * pace));
  const most = Math.max(rows[0].length, rows[1].length);
  const order = Array.from({length: most}).flatMap((_, i) => [rows[0][i], rows[1][i]]).filter(Boolean);
  yield* sequence(0.5 * pace, ...order.map(row => row().opacity(1, 0.3 * pace)));
  yield* hold();
  yield* all(...panels.map(p => p().opacity(0, 0.3)), ...heads.map(h => h().opacity(0, 0.3)), ...order.map(r => r().opacity(0, 0.3)));
}

/** Alur: garis tergambar dan tiap langkah menyala saat garisnya tiba. */
export function* flow(view: View2D, job: Job): ThreadGenerator {
  const steps: {head: string; body: string}[] = job.steps;
  const {pace, hold} = timing(job.seconds, 0.9 + steps.length * 1.15);
  const gap = 1320 / (steps.length - 1);
  const xs = steps.map((_, i) => -660 + i * gap);
  const draw = createSignal(0);
  const title = createRef<Txt>();
  const dots = steps.map(() => createRef<Circle>());
  const nums = steps.map(() => createRef<Txt>());
  const heads = steps.map(() => createRef<Txt>());
  const bodies = steps.map(() => createRef<Txt>());
  view.add(<Txt ref={title} text={job.title} fontFamily={SANS} fontSize={56} fill={INK} y={-310} opacity={0} />);
  view.add(<Line points={[new Vector2(xs[0], -80), new Vector2(xs[xs.length - 1], -80)]} stroke={ACCENT} lineWidth={6} end={draw} />);
  steps.forEach((step, i) => {
    view.add(<Circle ref={dots[i]} size={110} x={xs[i]} y={-80} fill={ACCENT} scale={0} />);
    view.add(<Txt ref={nums[i]} text={`${i + 1}`} fontFamily={BOLD} fontSize={46} fill="#14122e" x={xs[i]} y={-80} scale={0} />);
    view.add(<Txt ref={heads[i]} text={step.head} fontFamily={SANS} fontSize={40} fill={INK} x={xs[i]} y={35} width={gap - 30} textAlign="center" textWrap opacity={0} />);
    view.add(<Txt ref={bodies[i]} text={step.body} fontFamily={SANS} fontSize={28} fill={MUTED} x={xs[i]} y={125} width={gap - 30} textAlign="center" textWrap opacity={0} />);
  });
  yield* title().opacity(1, 0.5 * pace);
  const reveal = (i: number) => all(dots[i]().scale(1, 0.4 * pace, easeOutBack), nums[i]().scale(1, 0.4 * pace, easeOutBack),
    heads[i]().opacity(1, 0.35 * pace), bodies[i]().opacity(1, 0.35 * pace));
  yield* reveal(0);
  for (let i = 1; i < steps.length; i++) {
    yield* draw(i / (steps.length - 1), 0.7 * pace, easeInOutCubic);
    yield* reveal(i);
  }
  yield* hold();
  yield* all(title().opacity(0, 0.3), draw(0, 0.3), ...dots.map(d => d().opacity(0, 0.3)), ...nums.map(n => n().opacity(0, 0.3)),
    ...heads.map(h => h().opacity(0, 0.3)), ...bodies.map(b => b().opacity(0, 0.3)));
}

export const TEMPLATES = {kinetic, data, compare, flow};
export {waitFor};
