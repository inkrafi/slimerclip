/** Ilustrasi bergerak 2D flat. Semua digambar dari kode supaya konsisten dan tidak ada aset berlisensi. */
import {Circle, Line, Node, Rect, Txt} from '@revideo/2d';
import {all, createRef, createSignal, delay, easeInCubic, easeOutBack, easeOutCubic, linear, spawn, ThreadGenerator, tween, waitFor} from '@revideo/core';
import {BODY, CORAL, INK, MONO, NAVY, PAPER, SAFFRON, SLATE, TEAL, TITLE} from './system';

export type Ctx = {
  later: (at: number | undefined, task: () => ThreadGenerator) => void;
  now: () => number;
  clock: () => number;
  dur: number;
};

const ORE = '#9A5236';
const STEEL = '#AEB9C7';
const DARKSTEEL = '#54657C';
const WATER = '#1C4663';
const GROUND = '#24364F';

/** Satu fungsi yang dipanggil tiap frame selama adegan berlangsung, t dalam detik */
const run = (seconds: number, fn: (t: number) => void) => spawn(tween(Math.max(0.1, seconds), v => fn(v * seconds), linear));

function caption(root: Node, s: any) {
  if (!s.kicker && !s.text) return;
  if (s.kicker) root.add(<Txt x={-860} y={346} offset={[-1, 0]} text={s.kicker} fontFamily={MONO} fontWeight={600} fontSize={38} fill={SAFFRON} />);
  if (s.text) root.add(<Txt x={-860} y={410} offset={[-1, 0]} text={s.text} fontFamily={TITLE} fontWeight={800} fontSize={58} fill={INK} />);
}

function smoke(parent: Node, x: number, y: number, seconds: number, tone = '#7B8798', scale = 1, count = 6) {
  const puffs = Array.from({length: count}, () => {
    const ref = createRef<Circle>();
    parent.add(<Circle ref={ref} x={x} y={y} size={30 * scale} fill={tone} opacity={0} />);
    return ref;
  });
  run(seconds, t => puffs.forEach((p, i) => {
    const phase = (t * 0.42 + i / count) % 1;
    p().position([x + Math.sin(phase * 5 + i) * 22 * scale + phase * 46 * scale, y - phase * 210 * scale]);
    p().size((26 + phase * 74) * scale);
    p().opacity(0.55 * (1 - phase) * Math.min(1, phase * 8));
  }));
}

export const helmet = (parent: Node, x: number, y: number, scale = 1, tone = SAFFRON) => {
  parent.add(<Node x={x} y={y} scale={scale}>
    <Rect y={70} size={[96, 84]} radius={[30, 30, 6, 6]} fill={DARKSTEEL} />
    <Circle y={-4} size={66} fill={STEEL} />
    <Circle y={-16} size={78} fill={tone} startAngle={180} endAngle={360} closed />
    <Rect y={-16} size={[100, 10]} radius={4} fill={tone} />
  </Node>);
};

export const factory = (parent: Node, x: number, y: number, scale = 1, tone = SAFFRON) => {
  parent.add(<Node x={x} y={y} scale={scale}>
    <Rect y={30} size={[190, 110]} radius={6} fill={tone} />
    <Rect x={54} y={-68} size={[40, 110]} radius={4} fill={tone} />
    <Rect x={-16} y={-46} size={[34, 70]} radius={4} fill={tone} />
    <Rect x={-54} y={36} size={[40, 44]} fill={NAVY} /><Rect x={6} y={36} size={[40, 44]} fill={NAVY} /><Rect x={62} y={36} size={[32, 44]} fill={NAVY} />
  </Node>);
};

export const batteryIcon = (parent: Node, x: number, y: number, scale = 1, level = 0.3) => {
  parent.add(<Node x={x} y={y} scale={scale}>
    <Rect size={[160, 260]} radius={22} stroke={INK} lineWidth={12} fill="#16263C" />
    <Rect y={-146} size={[70, 26]} radius={6} fill={INK} />
    <Rect y={(1 - level) * 105} size={[122, 222 * level]} radius={10} fill={SAFFRON} />
  </Node>);
};

const pot = (parent: Node, x: number, y: number) => parent.add(<Node x={x} y={y}>
  <Rect y={20} size={[200, 130]} radius={[6, 6, 34, 34]} fill={STEEL} /><Rect y={-50} size={[220, 18]} radius={8} fill={DARKSTEEL} />
  <Rect x={-128} y={0} size={[50, 16]} radius={8} fill={DARKSTEEL} /><Rect x={128} y={0} size={[50, 16]} radius={8} fill={DARKSTEEL} />
</Node>);
const sink = (parent: Node, x: number, y: number) => parent.add(<Node x={x} y={y}>
  <Rect y={40} size={[250, 90]} radius={[0, 0, 26, 26]} fill={STEEL} /><Rect y={-4} size={[280, 16]} radius={6} fill={DARKSTEEL} />
  <Rect x={0} y={-56} size={[18, 96]} radius={6} fill={DARKSTEEL} /><Rect x={32} y={-100} size={[80, 16]} radius={6} fill={DARKSTEEL} /><Rect x={68} y={-84} size={[14, 30]} fill={DARKSTEEL} />
</Node>);
const gear = (parent: Node, x: number, y: number) => {
  const ref = createRef<Node>();
  parent.add(<Node ref={ref} x={x} y={y}>
    {Array.from({length: 8}, (_, i) => <Rect size={[34, 210]} radius={4} rotation={i * 22.5} fill={STEEL} />)}
    <Circle size={160} fill={STEEL} /><Circle size={60} fill={NAVY} />
  </Node>);
  return ref;
};
const building = (parent: Node, x: number, y: number) => parent.add(<Node x={x} y={y}>
  <Rect size={[170, 260]} radius={4} fill={STEEL} />
  {Array.from({length: 12}, (_, i) => <Rect x={-44 + (i % 3) * 44} y={-92 + Math.floor(i / 3) * 62} size={[26, 36]} fill={NAVY} />)}
</Node>);

function mine(root: Node, s: any, ctx: Ctx) {
  root.add(<Line points={[[-1000, 300], [-620, 40], [-330, 150], [-60, 300]]} closed fill={ORE} />);
  root.add(<Rect y={420} size={[2000, 260]} fill={GROUND} />);
  const arm = createSignal(0);
  const excavator = <Node x={160} y={190} />;
  root.add(excavator);
  excavator.add(<Rect y={78} size={[260, 44]} radius={22} fill="#26354B" stroke={SLATE} lineWidth={4} />);
  excavator.add(<Rect y={10} size={[210, 96]} radius={8} fill={SAFFRON} />);
  excavator.add(<Rect x={-54} y={-42} size={[84, 70]} radius={6} fill="#2F4562" />);
  const boom = createRef<Node>();
  excavator.add(<Node ref={boom} x={-70} y={-10} rotation={() => -18 + arm() * 22}>
    <Rect x={-120} size={[250, 30]} radius={10} fill={SAFFRON} />
    <Node x={-240} rotation={() => -70 - arm() * 30}>
      <Rect x={-80} size={[170, 24]} radius={8} fill={SAFFRON} />
      <Line x={-170} points={[[-34, -24], [34, -24], [20, 40], [-44, 26]]} closed fill={DARKSTEEL} />
    </Node>
  </Node>);
  const truck = createRef<Node>();
  root.add(<Node ref={truck} x={1200} y={230}>
    <Line points={[[-120, -60], [90, -60], [66, 30], [-96, 30]]} closed fill={DARKSTEEL} />
    <Line points={[[-92, -60], [-30, -112], [70, -60]]} closed fill={ORE} />
    <Rect x={136} y={-16} size={[90, 92]} radius={8} fill={STEEL} />
    <Circle x={-60} y={52} size={58} fill="#111C2C" stroke={SLATE} lineWidth={6} />
    <Circle x={120} y={52} size={58} fill="#111C2C" stroke={SLATE} lineWidth={6} />
  </Node>);
  run(ctx.dur, t => {
    arm(Math.sin(t * 1.6) * 0.5 + 0.5);
    truck().x(1200 - Math.min(t / Math.max(1, ctx.dur - 1), 1) * 660);
  });
  caption(root, s);
}

function ship(root: Node, s: any, ctx: Ctx) {
  const wave = createSignal(0);
  const body = createRef<Node>();
  root.add(<Node ref={body} x={-1200} y={110}>
    <Line points={[[-340, -30], [340, -30], [270, 100], [-290, 100]]} closed fill="#2E4A68" stroke={INK} lineWidth={4} />
    <Rect y={72} size={[570, 34]} fill={CORAL} />
    <Line points={[[-250, -30], [-110, -130], [60, -130], [200, -30]]} closed fill={ORE} />
    <Rect x={258} y={-90} size={[96, 120]} radius={6} fill={STEEL} />
    <Rect x={258} y={-98} size={[70, 30]} fill={NAVY} />
    <Rect x={288} y={-178} size={[34, 64]} fill={DARKSTEEL} />
  </Node>);
  [0, 1, 2].forEach(n => root.add(<Line
    points={() => Array.from({length: 26}, (_, i) => {
      const x = -1000 + i * 80;
      return [x, 210 + n * 60 + Math.sin(i * 0.8 + wave() * (1.2 + n * 0.3) + n) * (15 - n * 2)] as [number, number];
    })}
    stroke={n === 0 ? '#3A7FA6' : WATER} lineWidth={10} lineCap="round" radius={40} />));
  run(ctx.dur, t => {
    wave(t * 2);
    const x = -1200 + (t / ctx.dur) * 1500;
    body().position([x, 110 + Math.sin(t * 1.8) * 7]);
    body().rotation(Math.sin(t * 1.3) * 1.2);
  });
  caption(root, s);
}

function furnace(root: Node, s: any, ctx: Ctx) {
  root.add(<Line points={[[-640, 300], [-640, -120], [-540, -280], [-300, -280], [-200, -120], [-200, 300]]} closed fill={DARKSTEEL} stroke={STEEL} lineWidth={5} />);
  root.add(<Rect x={-420} y={70} size={[210, 150]} radius={10} fill={SAFFRON} />);
  smoke(root, -420, -290, ctx.dur, '#7B8798', 1.3, 7);
  const stream = createSignal(0);
  root.add(<Rect x={-150} y={170} size={[150, 30]} radius={8} fill={SAFFRON} opacity={() => 0.7 + Math.sin(stream() * 8) * 0.25} />);
  root.add(<Rect x={150} y={270} size={[900, 28]} fill={SLATE} />);
  const bars = Array.from({length: 7}, () => {
    const ref = createRef<Line>();
    root.add(<Line ref={ref} points={[[-68, 24], [68, 24], [50, -24], [-50, -24]]} closed fill={STEEL} y={228} />);
    return ref;
  });
  run(ctx.dur, t => {
    stream(t);
    bars.forEach((bar, i) => bar().x(-120 + ((t * 120 + i * 180) % 1200)));
  });
  caption(root, s);
}

function goods(root: Node, s: any, ctx: Ctx) {
  const items: any[] = s.items;
  const step = 1600 / items.length;
  const spin: ReturnType<typeof createRef<Node>>[] = [];
  items.forEach((item, i) => {
    const x = -800 + step * (i + 0.5);
    const ref = createRef<Node>();
    root.add(<Node ref={ref} x={x} y={-60} scale={0} />);
    if (item.draw === 'pot') pot(ref(), 0, 0);
    if (item.draw === 'sink') sink(ref(), 0, 0);
    if (item.draw === 'gear') spin.push(gear(ref(), 0, 0));
    if (item.draw === 'building') building(ref(), 0, 0);
    ref().add(<Txt y={210} text={item.label} fontFamily={TITLE} fontWeight={800} fontSize={54} fill={INK} />);
    ctx.later(item.t ?? ctx.now() + i * 0.3, () => ref().scale(1, 0.34, easeOutBack));
  });
  run(ctx.dur, t => spin.forEach(g => g().rotation(t * 40)));
  caption(root, s);
}

function crane(root: Node, s: any, ctx: Ctx) {
  root.add(<Rect y={400} size={[2000, 260]} fill={GROUND} />);
  const positions = [-640, -300, 40, 380, 700];
  positions.forEach((x, i) => {
    const ref = createRef<Node>();
    root.add(<Node ref={ref} x={x} y={500} />);
    factory(ref(), 0, 0, 1.25);
    smoke(root, x + 68, 90, ctx.dur, '#7B8798', 0.9, 4);
    ctx.later(ctx.now() + 0.2 + i * 0.5, () => ref().y(190, 0.7, easeOutBack));
  });
  root.add(<Rect x={-820} y={-20} size={[28, 760]} fill={SAFFRON} />);
  const jib = createSignal(0);
  root.add(<Node x={-820} y={-380} rotation={() => Math.sin(jib()) * 4}>
    <Rect x={440} size={[960, 22]} fill={SAFFRON} />
    <Rect x={() => 300 + (Math.sin(jib() * 0.7) * 0.5 + 0.5) * 460} y={150} size={[6, 300]} fill={STEEL} />
  </Node>);
  run(ctx.dur, t => jib(t));
  if (s.count) {
    const number = createRef<Txt>();
    root.add(<Txt ref={number} x={560} y={-300} text="0" fontFamily={MONO} fontWeight={600} fontSize={170} fill={SAFFRON} />);
    root.add(<Txt x={560} y={-190} text={s.countLabel} fontFamily={TITLE} fontWeight={800} fontSize={48} fill={INK} />);
    spawn(tween(Math.min(2.2, ctx.dur), v => number().text(String(Math.round(s.count * easeOutCubic(v))))));
  }
  caption(root, s);
}

function gavel(root: Node, s: any, ctx: Ctx) {
  const swing = createSignal(-52);
  root.add(<Rect x={-300} y={230} size={[520, 60]} radius={10} fill="#7A5230" />);
  root.add(<Rect x={-300} y={282} size={[640, 44]} radius={8} fill="#5B3C22" />);
  root.add(<Node x={120} y={120} rotation={swing}>
    <Rect x={-210} size={[420, 34]} radius={12} fill="#9C6B3F" />
    <Rect x={-420} size={[120, 170]} radius={18} fill="#A9744A" stroke="#D6A873" lineWidth={6} />
  </Node>);
  const rays = Array.from({length: 7}, (_, i) => {
    const ref = createRef<Rect>();
    root.add(<Rect ref={ref} x={-300 + Math.cos((i / 6) * Math.PI) * 300} y={170 - Math.sin((i / 6) * Math.PI) * 180} rotation={90 - (i / 6) * 180} size={[12, 90]} radius={6} fill={SAFFRON} opacity={0} />);
    return ref;
  });
  const text = createRef<Txt>();
  root.add(<Txt ref={text} x={-860} y={-300} offset={[-1, 0]} width={1700} textWrap text={s.text} fontFamily={TITLE} fontWeight={800} fontSize={84} fill={INK} opacity={0} />);
  ctx.later(s.t, function* () {
    yield* swing(0, 0.18, easeInCubic);
    yield* all(...rays.map(r => r().opacity(1, 0.05)), text().opacity(1, 0.2));
    yield* all(...rays.map(r => r().opacity(0, 0.4)), swing(-20, 0.35, easeOutCubic));
  });
  caption(root, s);
}

function ring(root: Node, s: any, ctx: Ctx) {
  const value = createSignal(0);
  root.add(<Circle x={-430} y={-20} size={560} stroke={SLATE} lineWidth={78} />);
  root.add(<Circle x={-430} y={-20} size={560} stroke={SAFFRON} lineWidth={78} rotation={-90} end={value} />);
  const number = createRef<Txt>();
  root.add(<Txt ref={number} x={-430} y={-20} text="0%" fontFamily={MONO} fontWeight={600} fontSize={120} fill={INK} />);
  spawn(tween(1.2, v => {
    const t = easeOutCubic(v);
    value(t * s.value / 100);
    number().text(`${Math.round(t * s.value)}%`);
  }));
  root.add(<Txt x={40} y={-260} offset={[-1, 0]} width={830} textWrap text={s.title} fontFamily={TITLE} fontWeight={800} fontSize={62} fill={INK} />);
  (s.legend as any[]).forEach((item, i) => {
    const ref = createRef<Node>();
    root.add(<Node ref={ref} y={-40 + i * 140} opacity={0}>
      <Rect x={60} size={[40, 40]} radius={8} fill={item.tone === 'slate' ? SLATE : SAFFRON} />
      <Txt x={110} offset={[-1, 0]} text={item.text} fontFamily={BODY} fontWeight={600} fontSize={54} fill={INK} />
    </Node>);
    ctx.later(item.t ?? ctx.now() + i * 0.4, () => ref().opacity(1, 0.25));
  });
}

function workers(root: Node, s: any, ctx: Ctx) {
  const rows = 3;
  const cols = 11;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ref = createRef<Node>();
    root.add(<Node ref={ref} x={-800 + c * 160} y={-60 + r * 150} scale={0} />);
    helmet(ref(), 0, 0, 0.92);
    ctx.later(ctx.now() + 0.05 + (r * cols + c) * 0.035, () => ref().scale(1, 0.2, easeOutBack));
  }
  const number = createRef<Txt>();
  root.add(<Txt ref={number} x={-860} y={-300} offset={[-1, 0]} text="0" fontFamily={MONO} fontWeight={600} fontSize={130} fill={SAFFRON} />);
  root.add(<Txt x={-860} y={-190} offset={[-1, 0]} text={s.label} fontFamily={TITLE} fontWeight={800} fontSize={56} fill={INK} />);
  spawn(tween(1.4, v => number().text(Math.round(s.count * easeOutCubic(v)).toLocaleString('en-US'))));
}

function coal(root: Node, s: any, ctx: Ctx) {
  root.add(<Rect y={420} size={[2000, 260]} fill={GROUND} />);
  [-620, -260].forEach(x => {
    root.add(<Line points={[[x - 150, 290], [x - 90, -40], [x - 112, -210], [x + 112, -210], [x + 90, -40], [x + 150, 290]]} closed fill={DARKSTEEL} stroke={STEEL} lineWidth={4} />);
    smoke(root, x, -210, ctx.dur, '#8A94A6', 1.8, 8);
  });
  root.add(<Rect x={140} y={140} size={[320, 300]} fill="#33465F" />);
  root.add(<Rect x={220} y={-80} size={[52, 300]} fill={DARKSTEEL} />);
  smoke(root, 220, -220, ctx.dur, '#5F6B7C', 1.4, 7);
  root.add(<Line points={[[320, 290], [520, 110], [860, 290]]} closed fill="#111820" />);
  const lumps = Array.from({length: 8}, () => {
    const ref = createRef<Circle>();
    root.add(<Circle ref={ref} size={34} fill="#0C1219" stroke="#3B4655" lineWidth={3} y={250} />);
    return ref;
  });
  root.add(<Rect x={360} y={270} size={[600, 16]} fill={SLATE} />);
  run(ctx.dur, t => lumps.forEach((lump, i) => lump().x(660 - ((t * 110 + i * 75) % 600))));
  caption(root, s);
}

function tailings(root: Node, s: any, ctx: Ctx) {
  root.add(<Rect y={330} size={[2000, 440]} fill={WATER} />);
  root.add(<Line points={[[-1000, 110], [-260, 110], [-120, 330], [-1000, 330]]} closed fill={GROUND} />);
  factory(root, -640, 0, 1.3, DARKSTEEL);
  root.add(<Rect x={-270} y={140} size={[300, 40]} radius={10} fill={SLATE} />);
  const drops = Array.from({length: 18}, () => {
    const ref = createRef<Circle>();
    root.add(<Circle ref={ref} size={22} fill="#B7A06C" opacity={0} />);
    return ref;
  });
  const cloud = createSignal(0);
  root.add(<Circle x={0} y={420} size={() => [200 + cloud() * 1400, 90 + cloud() * 260]} fill="#8E7F58" opacity={() => 0.15 + cloud() * 0.45} />);
  const fish = Array.from({length: 5}, (_, i) => {
    const ref = createRef<Node>();
    root.add(<Node ref={ref} x={200 + i * 150} y={380 + (i % 2) * 90}>
      <Circle size={[90, 44]} fill={TEAL} /><Line x={-58} points={[[18, 0], [-22, -24], [-22, 24]]} closed fill={TEAL} />
    </Node>);
    return ref;
  });
  run(ctx.dur, t => {
    cloud(Math.min(1, t / Math.max(1, ctx.dur * 0.8)));
    drops.forEach((drop, i) => {
      const phase = (t * 0.7 + i / drops.length) % 1;
      drop().position([-120 + phase * 90 + (i % 3) * 8, 150 + phase * 300]);
      drop().opacity(0.9 * (1 - phase * 0.4));
    });
    fish.forEach((f, i) => {
      f().x(200 + i * 150 + Math.sin(t + i) * 40 + t * 18);
      f().opacity(Math.max(0, 1 - cloud() * 1.2));
    });
  });
  caption(root, s);
}

function waffle(root: Node, s: any, ctx: Ctx) {
  const size = 62;
  const gap = 8;
  const x0 = -800;
  const y0 = -300;
  /* Kisi tipis tampil sejak awal supaya layar tidak kosong sebelum angka disebut */
  if (s.title) root.add(<Txt x={x0 - size / 2} y={y0 - 110} offset={[-1, 0]} text={s.title} fontFamily={TITLE} fontWeight={800} fontSize={58} fill={INK} />);
  for (let i = 0; i < 100; i++) {
    const ref = createRef<Rect>();
    const col = i % 10;
    const row = Math.floor(i / 10);
    const isFirst = i < s.first;
    root.add(<Rect x={x0 + col * (size + gap)} y={y0 + row * (size + gap)} size={size} radius={8} stroke={SLATE} lineWidth={3} opacity={0.45} />);
    root.add(<Rect ref={ref} x={x0 + col * (size + gap)} y={y0 + row * (size + gap)} size={size} radius={8} scale={0} fill={isFirst ? SAFFRON : '#2FA598'} />);
    ctx.later((isFirst ? s.firstAt?.t : s.secondAt?.t) ?? ctx.now(), function* () {
      yield* waitFor((isFirst ? i : i - s.first) * 0.012);
      yield* ref().scale(1, 0.2, easeOutBack);
    });
  }
  const a = createRef<Node>();
  const b = createRef<Node>();
  root.add(<Node ref={a} opacity={0}>
    <Txt x={40} y={-210} offset={[-1, 0]} text={`${s.first}%`} fontFamily={MONO} fontWeight={600} fontSize={170} fill={SAFFRON} />
    <Txt x={40} y={-90} offset={[-1, 0]} text={s.firstLabel} fontFamily={TITLE} fontWeight={800} fontSize={66} fill={INK} />
  </Node>);
  root.add(<Node ref={b} opacity={0}>
    <Txt x={40} y={110} offset={[-1, 0]} text={`${100 - s.first}%`} fontFamily={MONO} fontWeight={600} fontSize={170} fill="#2FA598" />
    <Txt x={40} y={230} offset={[-1, 0]} text={s.secondLabel} fontFamily={TITLE} fontWeight={800} fontSize={66} fill={INK} />
  </Node>);
  ctx.later(s.firstAt?.t, () => a().opacity(1, 0.25));
  ctx.later(s.secondAt?.t, () => b().opacity(1, 0.25));
}

function car(root: Node, s: any, ctx: Ctx) {
  const dash = createSignal(0);
  root.add(<Rect y={330} size={[2000, 220]} fill={GROUND} />);
  root.add(<Line points={[[-1000, 290], [1000, 290]]} stroke={SLATE} lineWidth={8} lineDash={[70, 60]} lineDashOffset={dash} />);
  const body = createRef<Node>();
  const spin = createSignal(0);
  root.add(<Node ref={body} x={-1300} y={110}>
    <Line points={[[-420, 90], [-420, 10], [-300, -20], [-170, -130], [170, -130], [300, -20], [420, 10], [420, 90]]} closed radius={22} fill={STEEL} />
    <Line points={[[-150, -112], [-10, -112], [-10, -22], [-250, -22]]} closed fill={NAVY} />
    <Line points={[[20, -112], [150, -112], [250, -22], [20, -22]]} closed fill={NAVY} />
    <Rect y={108} size={[440, 34]} radius={6} fill={SAFFRON} />
    {[-240, 240].map(x => <Node x={x} y={100} rotation={spin}><Circle size={124} fill="#111C2C" stroke={DARKSTEEL} lineWidth={12} /><Rect size={[10, 96]} fill={SLATE} /><Rect size={[96, 10]} fill={SLATE} /></Node>)}
  </Node>);
  run(ctx.dur, t => {
    const p = Math.min(1, t / 1.6);
    body().x(-1300 + easeOutCubic(p) * 1800);
    spin(t * (p < 1 ? 720 : 120));
    dash(-t * 300);
  });
  caption(root, s);
}

function cells(root: Node, s: any, ctx: Ctx) {
  const cell = (x: number, title: string, note: string, hasNickel: boolean, at?: number) => {
    const ref = createRef<Node>();
    root.add(<Node ref={ref} x={x} y={-30} opacity={0}>
      <Rect size={[360, 520]} radius={40} fill="#16263C" stroke={INK} lineWidth={10} />
      <Rect y={-278} size={[150, 34]} radius={8} fill={INK} />
      <Txt y={-180} text={title} fontFamily={TITLE} fontWeight={800} fontSize={72} fill={INK} />
      <Rect size={[180, 180]} radius={14} fill={hasNickel ? SAFFRON : 'transparent'} stroke={hasNickel ? SAFFRON : SLATE} lineWidth={6} />
      <Txt text="Ni" fontFamily={TITLE} fontWeight={800} fontSize={110} fill={hasNickel ? NAVY : SLATE} />
      {hasNickel ? null : <Rect size={[250, 14]} radius={7} rotation={-40} fill={CORAL} />}
      <Txt y={180} text={note} fontFamily={BODY} fontWeight={600} fontSize={44} fill={INK} />
    </Node>);
    ctx.later(at, () => ref().opacity(1, 0.28));
  };
  cell(-300, 'Nickel-rich', 'Contains nickel', true);
  cell(300, 'LFP', 'No nickel', false, undefined);
}

function stockpile(root: Node, s: any, ctx: Ctx) {
  const level = createSignal(0);
  root.add(<Rect y={400} size={[2000, 260]} fill={GROUND} />);
  root.add(<Line points={() => {
    const h = 60 + level() * 470;
    const w = 300 + level() * 340;
    return [[-300 - w, 290], [-300 - w * 0.2, 290 - h], [-300 + w * 0.2, 290 - h * 0.92], [-300 + w, 290]] as [number, number][];
  }} closed fill={ORE} />);
  const end = createSignal(0);
  root.add(<Line points={[[260, -260], [470, -170], [560, -60], [720, 40], [860, 200]]} stroke={CORAL} lineWidth={18} lineCap="round" lineJoin="round" endArrow arrowSize={40} end={end} />);
  root.add(<Txt x={520} y={-340} text={s.price} fontFamily={MONO} fontWeight={600} fontSize={92} fill={CORAL} />);
  root.add(<Txt x={560} y={250} width={720} textWrap textAlign="center" text={s.label} fontFamily={TITLE} fontWeight={800} fontSize={48} fill={INK} />);
  spawn(tween(Math.min(2.5, ctx.dur), v => { level(easeOutCubic(v)); end(easeOutCubic(v)); }));
  caption(root, s);
}

function safety(root: Node, s: any, ctx: Ctx) {
  root.add(<Line x={-520} y={-30} points={[[0, -240], [260, 200], [-260, 200]]} closed radius={22} fill={SAFFRON} />);
  root.add(<Rect x={-520} y={-50} size={[34, 170]} radius={14} fill={NAVY} />);
  root.add(<Circle x={-520} y={100} size={44} fill={NAVY} />);
  root.add(<Txt x={-120} y={-250} offset={[-1, 0]} text={s.title} fontFamily={TITLE} fontWeight={800} fontSize={84} fill={SAFFRON} />);
  (s.items as any[]).forEach((item, i) => {
    const ref = createRef<Txt>();
    root.add(<Txt ref={ref} x={-120} y={-100 + i * 120} offset={[-1, 0]} width={960} textWrap text={item.text} fontFamily={TITLE} fontWeight={800} fontSize={58} fill={INK} opacity={0} />);
    ctx.later(item.t, () => ref().opacity(1, 0.25));
  });
}

/** Ciri khas channel: buku besar yang terisi tiap bab. Baris lama sudah tertulis, baris baru dicap saat disebut. */
function ledger(root: Node, s: any, ctx: Ctx) {
  const book = createRef<Rect>();
  const INK_DARK = '#1B2A3D';
  const MUTED = '#6B7486';
  root.add(<Rect ref={book} y={1200} rotation={-1} size={[1500, 860]} radius={12} fill={PAPER} shadowColor="#000000aa" shadowBlur={60} shadowOffsetY={22} />);
  const page = book();
  page.add(<Rect x={0} y={40} size={[5, 680]} fill="#C9BFA9" />);
  page.add(<Txt x={-690} y={-370} offset={[-1, 0]} text="THE LEDGER" fontFamily={MONO} fontWeight={600} fontSize={38} fill={MUTED} />);
  page.add(<Txt x={690} y={-370} offset={[1, 0]} text={s.page ?? ''} fontFamily={MONO} fontWeight={600} fontSize={38} fill={MUTED} />);
  page.add(<Rect y={-330} size={[1400, 4]} fill={INK_DARK} />);
  [['GAINED', -690, TEAL], ['PAID', 40, CORAL]].forEach(([label, x, color]) => page.add(
    <Txt x={x as number} y={-272} offset={[-1, 0]} text={label as string} fontFamily={TITLE} fontWeight={800} fontSize={66} fill={color as string} />));
  const slots: Record<string, number> = {gain: 0, paid: 0};
  (s.entries as any[]).forEach(entry => {
    const index = slots[entry.side]++;
    const x = entry.side === 'gain' ? -690 : 40;
    const y = -170 + index * 108;
    const rule = createRef<Rect>();
    page.add(<Rect x={entry.side === 'gain' ? -345 : 385} y={y + 50} size={[670, 2]} fill="#C9BFA9" />);
    const fresh = !!entry.fresh;
    page.add(<Txt x={x} y={y} offset={[-1, 0]} text={entry.text} fontFamily={BODY} fontWeight={fresh ? 800 : 600} fontSize={44} fill={INK_DARK} />);
    page.add(<Rect ref={rule} x={x + 625} y={y} size={fresh ? [20, 20] : [12, 12]} radius={10} fill={entry.side === 'gain' ? TEAL : CORAL} />);
  });
  if (s.stamp) {
    page.add(<Rect x={s.stamp.x ?? 330} y={s.stamp.y ?? 300} rotation={-8} layout padding={[10, 26]} radius={10} stroke={CORAL} lineWidth={7}>
      <Txt text={s.stamp.text} fontFamily={TITLE} fontWeight={800} fontSize={66} fill={CORAL} />
    </Rect>);
  }
  if (s.settled) book().y(10);
  else spawn(book().y(10, 0.5, easeOutCubic));
}

export const ILLUSTRATIONS: Record<string, (root: Node, s: any, ctx: Ctx) => void> = {
  ledger, mine, ship, furnace, goods, crane, gavel, ring, workers, coal, tailings, waffle, car, cells, stockpile, safety,
};
void PAPER;
