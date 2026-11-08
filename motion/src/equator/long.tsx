/** Mesin adegan video panjang: peta sebagai panggung, lalu lapisan isi yang berganti mengikuti narasi. */
import {Circle, Img, Line, makeScene2D, Node, Rect, Spline, Txt} from '@revideo/2d';
import {
  all, createRef, createSignal, delay, easeInOutCubic, easeOutBack, easeOutCubic, linear, spawn, ThreadGenerator, tween,
  useScene, useThread, waitFor,
} from '@revideo/core';
import {BODY, CORAL, DARK, Geo, INK, LAND, loadFonts, logo, mixColor, MONO, NAVY, PAPER, project, SAFFRON, SLATE, TEAL, TITLE} from './system';
import {batteryIcon, factory, helmet, ILLUSTRATIONS} from './illustrations';

const TONE: Record<string, string> = {saffron: SAFFRON, teal: '#2FA598', coral: CORAL, slate: SLATE};
const WARM = '#6E3B37';
const SPECIAL = ['IDN', 'CHN', 'PHL'];
const FACE = '#172A42';

export default makeScene2D('equator-long', function* (view) {
  const job = useScene().variables.get<Record<string, any>>('job', {})();
  yield loadFonts();
  const world: any = yield (fetch('/equator/data/world.json').then(r => r.json()));
  const total: number = job.duration;
  const now = () => useThread().time();
  function* until(second: number): ThreadGenerator {
    const left = second - now();
    if (left > 0) yield* waitFor(left);
  }
  /** Jalankan isi tepat pada detik `at`, tanpa menahan alur adegan */
  const later = (at: number | undefined, task: () => ThreadGenerator) => {
    const wait = Math.max(0, (at ?? now()) - now());
    spawn(delay(wait, task()));
  };

  /* Kamera */
  const camLon = createSignal<number>(job.camera?.lon ?? 20);
  const camLat = createSignal<number>(job.camera?.lat ?? 18);
  const camZoom = createSignal<number>(job.camera?.zoom ?? 1);
  const push = createSignal(1);
  const zoom = () => camZoom() * push();
  const centre = () => project(camLon(), camLat());
  const toScreen = (lon: number, lat: number): [number, number] => {
    const [x, y] = project(lon, lat);
    const [cx, cy] = centre();
    return [(x - cx) * zoom(), (y - cy) * zoom()];
  };
  function* fly(lon: number, lat: number, target: number, seconds: number): ThreadGenerator {
    const [lon0, lat0, zoom0] = [camLon(), camLat(), camZoom()];
    yield* tween(seconds, value => {
      const t = easeInOutCubic(value);
      camLon(lon0 + (lon - lon0) * t);
      camLat(lat0 + (lat - lat0) * t);
      camZoom(Math.exp(Math.log(zoom0) + (Math.log(target) - Math.log(zoom0)) * t));
    });
  }

  /* Peta */
  const stage = createRef<Node>();
  const hi: Record<string, {level: ReturnType<typeof createSignal<number>>; color: string}> = {};
  SPECIAL.forEach(code => { hi[code] = {level: createSignal(0), color: WARM}; });
  const mapDim = createSignal<number>(job.camera?.dim ?? 0.8);
  view.add(<Rect size={[1920, 1080]} fill={NAVY} />);
  view.add(<Node ref={stage} position={() => { const [x, y] = centre(); return [-x * zoom(), -y * zoom()]; }} scale={zoom} />);
  const rest = Object.entries<string>(world.countries).filter(([code]) => !SPECIAL.includes(code)).map(([, d]) => d).join('');
  stage().add(new Geo(rest, () => LAND, zoom));
  SPECIAL.forEach(code => stage().add(new Geo(world.countries[code], () => mixColor(LAND, hi[code].color, hi[code].level()), zoom)));
  const flows = createRef<Node>();
  stage().add(<Node ref={flows} />);
  view.add(<Rect size={[1920, 1080]} fill={NAVY} opacity={mapDim} />);
  const overlay = createRef<Node>();
  view.add(<Node ref={overlay} />);
  const fx = createRef<Node>();
  view.add(<Node ref={fx} />);
  const source = createRef<Txt>();
  view.add(<Txt ref={source} x={-900} y={494} offset={[-1, 0]} text="" fontFamily={BODY} fontWeight={500} fontSize={24} fill={INK} opacity={0.72} />);
  const mark = createRef<Node>();
  view.add(<Node ref={mark} position={[866, -484]} opacity={0.75} />);
  logo(mark(), 62);
  view.add(<Img src="/equator/grain.png" size={[1920, 1080]} opacity={0.025} compositeOperation="overlay" />);

  const dash = createSignal(0);
  /* Jam bersama: tampilan yang muncul pada detik tertentu membaca sinyal ini, tidak bergantung pada jadwal thread */
  const clock = createSignal(0);
  spawn(tween(total, value => { dash(-value * total * 42); push(1 + value * 0.05); clock(value * total); }, linear));
  const unit = () => 1 / zoom();

  /* ---------- Bagian isi ---------- */
  const rise = (node: Node, seconds = 0.32): ThreadGenerator => node.opacity(1, seconds, easeOutCubic);

  function headline(root: Node, s: any): ThreadGenerator {
    const size = s.size ?? 128;
    const lines: string[] = s.lines;
    const gap = size * 1.14;
    const nodes = lines.map((text, i) => {
      const ref = createRef<Txt>();
      root.add(<Txt ref={ref} y={(i - (lines.length - 1) / 2) * gap} text={text} fontFamily={TITLE} fontWeight={800} fontSize={size} scale={0.7}
        fill={i === s.accent ? '#FFC247' : INK} shadowColor={i === s.accent ? '#E8A33D' : '#00000000'} shadowBlur={i === s.accent ? 34 : 0} opacity={0} />);
      return ref;
    });
    /* Teks muncul dengan efek pop: membesar sedikit melewati ukuran akhir, lalu kembali */
    return all(...nodes.map((n, i) => delay(i * 0.1, all(n().opacity(1, 0.1), n().scale(1.08, 0.2, easeOutCubic).to(1, 0.14, easeInOutCubic)))));
  }

  function stat(root: Node, s: any): ThreadGenerator {
    const value = createRef<Txt>();
    const label = createRef<Txt>();
    const note = createRef<Txt>();
    const color = TONE[s.tone] ?? SAFFRON;
    const final = s.text ?? `${Number(s.value).toLocaleString('en-US')}${s.suffix ?? ''}`;
    root.add(<Txt ref={value} y={-70} text={s.text ?? `0${s.suffix ?? ''}`} fontFamily={MONO} fontWeight={600} fontSize={final.length > 8 ? 130 : 170} fill={color} opacity={0} />);
    root.add(<Txt ref={label} y={70} width={1500} textWrap textAlign="center" text={s.label} fontFamily={TITLE} fontWeight={800} fontSize={58} fill={INK} opacity={0} />);
    if (s.note) root.add(<Txt ref={note} y={160} width={1500} textWrap textAlign="center" text={s.note} fontFamily={BODY} fontWeight={500} fontSize={40} fill={INK} opacity={0} />);
    if (s.note) later(s.t, () => note().opacity(1, 0.3));
    const count = s.text ? waitFor(0) : tween(1, v => {
      const n = Math.round(Number(s.value) * easeOutCubic(v));
      value().text(`${n.toLocaleString('en-US')}${s.suffix ?? ''}`);
    });
    return all(value().opacity(1, 0.2), label().opacity(1, 0.3), count);
  }

  function ingots(root: Node, s: any): ThreadGenerator {
    const width = 260;
    const list = Array.from({length: s.total}, (_, i) => {
      const box = createRef<Rect>();
      const fill = createSignal(0);
      root.add(<Rect ref={box} x={(i - (s.total - 1) / 2) * (width + 40)} y={-180} size={[width, 150]} radius={14} scale={0} stroke={SLATE} lineWidth={3}
        fill={() => mixColor('#1A2B43', SAFFRON, fill())} />);
      return {box, fill};
    });
    const label = createRef<Txt>();
    const note = createRef<Txt>();
    root.add(<Txt ref={label} y={40} text={s.label} fontFamily={TITLE} fontWeight={800} fontSize={112} fill={INK} opacity={0} />);
    root.add(<Txt ref={note} y={150} text={s.note} fontFamily={BODY} fontWeight={500} fontSize={42} fill={INK} opacity={0} />);
    return all(
      ...list.map((item, i) => delay(i * 0.1, item.box().scale(1, 0.3, easeOutBack))),
      ...list.slice(0, s.filled).map((item, i) => delay(0.45 + i * 0.12, item.fill(1, 0.25))),
      delay(0.3, label().opacity(1, 0.3)), delay(0.4, note().opacity(1, 0.3)),
    );
  }

  function bars(root: Node, s: any): ThreadGenerator {
    const span = 1040;
    const top = Math.max(...s.items.map((item: any) => item.value));
    root.add(<Txt x={-780} y={-250} offset={[-1, 0]} text={s.title} fontFamily={TITLE} fontWeight={800} fontSize={64} fill={INK} />);
    const tasks = s.items.map((item: any, i: number) => {
      const y = -60 + i * 190;
      const size = createSignal(0);
      const row = createRef<Node>();
      const value = createRef<Txt>();
      const color = TONE[item.tone] ?? SAFFRON;
      root.add(<Node ref={row} y={y} opacity={0}>
        <Txt x={-780} y={-68} offset={[-1, 0]} text={item.label} fontFamily={BODY} fontWeight={600} fontSize={40} fill={INK} />
        <Rect x={-780} offset={[-1, 0]} height={72} width={() => Math.max(6, size() * ((item.value / top) * span + 220))} radius={6} fill={color} />
        <Txt ref={value} x={() => -780 + size() * ((item.value / top) * span + 220) + 26} offset={[-1, 0]} text={item.text} fontFamily={MONO} fontWeight={600} fontSize={46} fill={INK} />
      </Node>);
      return {item, row, size, value};
    });
    tasks.forEach((task: any, i: number) => later(task.item.t ?? now() + i * 0.25, () => all(task.row().opacity(1, 0.2), task.size(1, 0.7, easeOutCubic))));
    return waitFor(0);
  }

  function chart(root: Node, s: any): ThreadGenerator {
    const W = 1400;
    const H = 560;
    const xs = s.points.map((p: number[]) => p[0]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const px = (x: number) => -W / 2 + ((x - x0) / (x1 - x0)) * W;
    const py = (y: number) => 280 - (y / s.yMax) * H;
    const end = createSignal(0);
    root.add(<Txt x={-780} y={-400} offset={[-1, 0]} text={s.title} fontFamily={BODY} fontWeight={600} fontSize={42} fill={INK} />);
    root.add(<Rect x={0} y={282} size={[W + 80, 3]} fill={SLATE} />);
    s.points.forEach((p: number[]) => root.add(<Txt x={px(p[0])} y={330} text={String(p[0])} fontFamily={MONO} fontWeight={500} fontSize={36} fill={INK} />));
    root.add(<Line points={s.points.map((p: number[]) => [px(p[0]), py(p[1])] as [number, number])} stroke={TONE[s.color] ?? SAFFRON} lineWidth={9} lineCap="round" lineJoin="round" end={end} />);
    (s.marks ?? []).forEach((m: any) => {
      const point = s.points.find((p: number[]) => p[0] === m.x);
      const ref = createRef<Txt>();
      root.add(<Txt ref={ref} x={px(point[0])} y={py(point[1]) - 58} text={m.label} fontFamily={MONO} fontWeight={600} fontSize={60} fill={SAFFRON} opacity={0} />);
      later(m.t, () => ref().opacity(1, 0.2));
    });
    return end(1, Math.min(1.3, 0.5 + s.points.length * 0.25), easeInOutCubic);
  }

  function doc(root: Node, s: any): ThreadGenerator {
    const sheet = createRef<Rect>();
    root.add(<Rect ref={sheet} y={1200} rotation={-1} size={[1320, 760]} radius={10} fill={PAPER} shadowColor="#00000088" shadowBlur={50} shadowOffsetY={18} />);
    sheet().add(<Txt x={-600} y={-300} offset={[-1, 0]} text={s.kicker} fontFamily={MONO} fontWeight={600} fontSize={32} fill="#5B6577" />);
    sheet().add(<Txt x={-600} y={-210} offset={[-1, 0]} text={s.title} fontFamily={TITLE} fontWeight={800} fontSize={92} fill={DARK} />);
    s.rows.forEach((item: any, i: number) => {
      const row = createRef<Node>();
      const glow = createRef<Rect>();
      sheet().add(<Node ref={row} y={-50 + i * 130} opacity={0}>
        <Rect ref={glow} x={-620} offset={[-1, 0]} size={[1240, 96]} radius={8} fill={SAFFRON} opacity={0.42} scale={[0, 1]} />
        <Txt x={-590} offset={[-1, 0]} text={item.label} fontFamily={MONO} fontWeight={500} fontSize={34} fill="#5B6577" />
        <Txt x={-310} offset={[-1, 0]} text={item.text} fontFamily={BODY} fontWeight={600} fontSize={44} fill={DARK} />
      </Node>);
      later(item.t ?? now() + 0.6, () => all(row().opacity(1, 0.2), item.mark ? glow().scale([1, 1], 0.35, easeOutCubic) : waitFor(0)));
    });
    return sheet().y(0, 0.5, easeOutCubic);
  }

  function timeline(root: Node, s: any): ThreadGenerator {
    const count = s.items.length;
    const step = Math.min(620, 1500 / Math.max(1, count - 1 || 1));
    const start = -((count - 1) * step) / 2;
    if (s.title) root.add(<Txt y={-300} text={s.title} fontFamily={TITLE} fontWeight={800} fontSize={88} fill={INK} />);
    root.add(<Rect y={0} size={[1700, 5]} fill={SLATE} />);
    s.items.forEach((item: any, i: number) => {
      const ref = createRef<Node>();
      root.add(<Node ref={ref} x={start + i * step} opacity={0}>
        <Circle size={34} fill={SAFFRON} />
        <Txt y={-82} text={item.year} fontFamily={MONO} fontWeight={600} fontSize={64} fill={SAFFRON} />
        <Txt y={84} width={Math.min(560, step - 30)} textWrap textAlign="center" text={item.text} fontFamily={TITLE} fontWeight={800} fontSize={48} fill={INK} />
      </Node>);
      later(item.t ?? now() + i * 0.3, () => ref().opacity(1, 0.25));
    });
    return waitFor(0);
  }

  function steps(root: Node, s: any): ThreadGenerator {
    const items: any[] = s.items;
    const hasTitle = !!s.title;
    const offset = hasTitle ? 70 : 0;
    if (hasTitle) root.add(<Txt x={-640} y={-260} offset={[-1, 0]} text={s.title} fontFamily={TITLE} fontWeight={800} fontSize={88} fill={SAFFRON} />);
    items.forEach((item, i) => {
      const ref = createRef<Node>();
      root.add(<Node ref={ref} y={offset + (i - (items.length - 1) / 2) * 130} opacity={0}>
        <Rect x={-640} size={[22, 22]} radius={4} fill={SAFFRON} />
        <Txt x={-600} offset={[-1, 0]} text={item.text} fontFamily={TITLE} fontWeight={800} fontSize={70} fill={INK} />
      </Node>);
      later(item.t ?? now() + i * 0.25, () => ref().opacity(1, 0.22));
    });
    return waitFor(0);
  }

  function versus(root: Node, s: any): ThreadGenerator {
    const side = (data: any, x: number) => {
      const ref = createRef<Node>();
      root.add(<Node ref={ref} x={x} opacity={0}>
        <Rect size={[780, 560]} radius={14} fill={FACE} stroke={TONE[data.tone] ?? SLATE} lineWidth={4} />
        <Txt y={-180} width={700} textWrap textAlign="center" text={data.title} fontFamily={TITLE} fontWeight={800} fontSize={72} fill={TONE[data.tone] ?? INK} />
        {data.items.map((item: string, i: number) => <Txt y={-30 + i * 96} width={700} textWrap textAlign="center" text={item} fontFamily={BODY} fontWeight={600} fontSize={50} fill={INK} />)}
      </Node>);
      later(data.t ?? now(), () => rise(ref()));
    };
    side(s.left, -420);
    side(s.right, 420);
    return waitFor(0);
  }

  function quote(root: Node, s: any): ThreadGenerator {
    const ref = createRef<Node>();
    root.add(<Node ref={ref} opacity={0}>
      <Rect x={-760} y={-20} size={[10, 360]} fill={SAFFRON} />
      <Txt x={-710} y={-60} offset={[-1, 0]} width={1500} textWrap text={`"${s.text}"`} lineHeight="125%" fontFamily={TITLE} fontWeight={800} fontSize={72} fill={INK} />
      <Txt x={-710} y={170} offset={[-1, 0]} text={s.by} fontFamily={MONO} fontWeight={600} fontSize={40} fill={SAFFRON} />
    </Node>);
    return rise(ref());
  }

  function caption(root: Node, s: any): ThreadGenerator {
    const ref = createRef<Node>();
    const box = s.center ? {x: 0, y: 0, offset: [0, 0] as [number, number]} : {x: -860, y: 360, offset: [-1, 0] as [number, number]};
    root.add(<Node ref={ref} opacity={0}>
      <Txt x={box.x} y={box.y - 56} offset={box.offset} text={s.kicker} fontFamily={MONO} fontWeight={600} fontSize={40} fill={SAFFRON} />
      <Txt x={box.x} y={box.y + 18} offset={box.offset} text={s.text} fontFamily={TITLE} fontWeight={800} fontSize={s.center ? 92 : 64} fill={INK} />
    </Node>);
    return rise(ref());
  }

  function pinAt(root: Node, s: any): ThreadGenerator {
    const ref = createRef<Node>();
    root.add(<Node ref={ref} position={() => { const [x, y] = toScreen(s.lon, s.lat); return [x, y - 96]; }} scale={0}>
      <Rect layout padding={[12, 28]} radius={10} fill={SAFFRON}><Txt text={s.text} fontFamily={TITLE} fontWeight={800} fontSize={60} fill={DARK} /></Rect>
    </Node>);
    root.add(<Circle size={22} fill={SAFFRON} position={() => toScreen(s.lon, s.lat)} />);
    if (s.note) root.add(<Txt x={-860} y={400} offset={[-1, 0]} text={s.note} fontFamily={TITLE} fontWeight={800} fontSize={56} fill={INK} />);
    return ref().scale(1, 0.32, easeOutBack);
  }

  function labels(root: Node, s: any): ThreadGenerator {
    s.items.forEach((item: any) => {
      const ref = createRef<Node>();
      root.add(<Node ref={ref} position={() => toScreen(item.lon, item.lat)} opacity={0}>
        <Circle size={18} fill={SAFFRON} />
        <Txt y={-52} text={item.text} fontFamily={TITLE} fontWeight={800} fontSize={58} fill={INK} />
      </Node>);
      later(item.t ?? now() + 0.4, () => rise(ref()));
    });
    return waitFor(0);
  }

  function flowBeat(root: Node, s: any): ThreadGenerator {
    const lines: Spline[] = [];
    s.flows.forEach((flow: any) => {
      const from = project(flow.from[0], flow.from[1]);
      const to = project(flow.to[0], flow.to[1]);
      const ref = createRef<Spline>();
      const tone = createSignal(flow.tone === 'coral' ? 0 : 0);
      flows().add(<Spline ref={ref} points={[from, [(from[0] + to[0]) / 2 + 14, (from[1] + to[1]) / 2 - 8], to]} smoothness={0.42} end={0} opacity={0}
        stroke={() => mixColor(SAFFRON, CORAL, s.stamp ? stampOn() : tone())} lineWidth={() => 7 * unit()} lineCap="round"
        lineDash={() => [20 * unit(), 16 * unit()]} lineDashOffset={() => dash() * unit()} endArrow arrowSize={() => 22 * unit()} />);
      lines.push(ref());
    });
    if (s.caption) later(undefined, () => caption(root, s.caption));
    if (s.stamp) {
      const ref = createRef<Rect>();
      root.add(<Rect ref={ref} position={() => toScreen(s.stamp.lon, s.stamp.lat)} rotation={-7} scale={1.6} opacity={0} layout padding={[12, 30]} radius={10} stroke={CORAL} lineWidth={7} fill="#0F1B2Dee">
        <Txt text={s.stamp.text} fontFamily={TITLE} fontWeight={800} fontSize={72} fill={CORAL} />
      </Rect>);
      later(s.stamp.t, () => all(ref().scale(1, 0.18, easeOutCubic), ref().opacity(1, 0.1), stampOn(1, 0.2)));
    }
    if (s.pin) later(s.pin.t, () => pinAt(root, s.pin));
    lines.forEach(line => line.opacity(1));
    return all(...lines.map((line, i) => delay(i * 0.12, line.end(1, 0.8, easeInOutCubic))));
  }
  const stampOn = createSignal(0);

  function icons(root: Node, s: any): ThreadGenerator {
    const color = s.coal ? SLATE : SAFFRON;
    if (s.caption) later(undefined, () => caption(root, s.caption));
    s.sites.forEach((site: [number, number], i: number) => {
      const ref = createRef<Node>();
      root.add(<Node ref={ref} position={() => toScreen(site[0], site[1])} scale={0}>
        <Rect y={6} size={[66, 40]} radius={3} fill={color} stroke={NAVY} lineWidth={3} />
        <Rect x={18} y={-22} size={[16, 44]} radius={2} fill={color} stroke={NAVY} lineWidth={3} />
        {s.coal ? <Rect x={-12} y={-22} size={[16, 44]} radius={2} fill={color} stroke={NAVY} lineWidth={3} /> : null}
        {s.labels ? <Txt y={-74} text={s.labels[i]} fontFamily={TITLE} fontWeight={800} fontSize={48} fill={INK} /> : null}
      </Node>);
      later(now() + 0.3 + i * 0.28, () => ref().scale(0.85, 0.26, easeOutBack));
    });
    return waitFor(0);
  }

  function chairs(root: Node, s: any): ThreadGenerator {
    const note = createRef<Txt>();
    [-210, 0, 210].forEach(x => root.add(<Node x={x} y={-160}>
      <Rect y={-50} size={[110, 110]} radius={12} stroke={SLATE} lineWidth={5} />
      <Rect y={30} size={[150, 22]} radius={6} stroke={SLATE} lineWidth={5} />
      <Rect x={-58} y={78} size={[10, 72]} fill={SLATE} /><Rect x={58} y={78} size={[10, 72]} fill={SLATE} />
    </Node>));
    root.add(<Txt y={90} text={s.text} fontFamily={TITLE} fontWeight={800} fontSize={72} fill={INK} />);
    root.add(<Txt ref={note} y={190} text={s.note} fontFamily={BODY} fontWeight={500} fontSize={46} fill={SAFFRON} opacity={0} />);
    later(s.t, () => note().opacity(1, 0.3));
    return waitFor(0);
  }

  function verdict(root: Node, s: any): ThreadGenerator {
    const ref = createRef<Node>();
    const art = new Node({y: -320, scale: 0});
    root.add(art);
    if (s.icon === 'factory') factory(art, 0, 0, 0.8);
    if (s.icon === 'helmet') helmet(art, 0, -20, 1.5);
    if (s.icon === 'battery') batteryIcon(art, 0, 0, 0.62, 0.3);
    if (s.icon === 'smoke') factory(art, 0, 0, 0.8, SLATE);
    spawn(art.scale(1, 0.34, easeOutBack));
    root.add(<Node ref={ref} y={60} opacity={0}>
      <Txt y={-150} text={s.who} fontFamily={MONO} fontWeight={600} fontSize={54} fill={SAFFRON} />
      <Txt y={-30} width={1700} textAlign="center" textWrap text={s.what} fontFamily={TITLE} fontWeight={800} fontSize={s.what.length > 20 ? 88 : 118} fill={INK} />
      <Txt y={130} width={1500} textAlign="center" textWrap text={s.note} fontFamily={BODY} fontWeight={500} fontSize={46} fill={INK} />
    </Node>);
    return rise(ref());
  }

  const RENDER: Record<string, (root: Node, s: any) => ThreadGenerator> = {
    headline, stat, ingots, bars, chart, doc, timeline, steps, versus, quote, caption, pin: pinAt, labels, flow: flowBeat, icons, chairs, verdict,
  };

  /* ---------- Alur ---------- */
  let current: Node | null = null;
  let turn = job.seed ?? 0;
  const CYCLE = ['slide', 'wipe', 'up', 'zoom', 'slide', 'wipe', 'down', 'zoom'];

  /** Sapuan miring: isi berganti saat sapuan menutupi layar */
  function* wipe(swap: () => void): ThreadGenerator {
    const band = createRef<Node>();
    fx().add(<Node ref={band} rotation={12} x={-2700}>
      <Rect size={[2400, 2600]} fill="#16263C" />
      <Rect x={1230} size={[60, 2600]} fill={SAFFRON} />
      <Rect x={1300} size={[14, 2600]} fill={SAFFRON} opacity={0.6} />
    </Node>);
    yield* band().x(0, 0.26, easeInOutCubic);
    swap();
    yield* band().x(2800, 0.3, easeInOutCubic);
    band().remove();
  }

  function* change(style: string, build: () => Node | null): ThreadGenerator {
    const old = current;
    const dropOld = () => {
      old?.remove();
      flows().removeChildren();
      stampOn(0);
    };
    if (style === 'cut') {
      /* Potongan tanpa transisi: dipakai saat isi yang sama bertambah satu baris */
      dropOld();
      current = build();
      return;
    }
    if (style === 'wipe') {
      let next: Node | null = null;
      yield* wipe(() => { dropOld(); next = build(); current = next; });
      return;
    }
    const OUT: Record<string, [number, number]> = {slide: [-260, 0], up: [0, -180], down: [0, 180], zoom: [0, 0]};
    const [dx, dy] = OUT[style] ?? [0, 0];
    if (old) yield* all(old.opacity(0, 0.16), old.position([dx, dy], 0.16, easeInOutCubic), style === 'zoom' ? old.scale(1.08, 0.16) : waitFor(0));
    dropOld();
    const next = build();
    current = next;
    if (next) {
      next.position([-dx, -dy]);
      next.opacity(0);
      if (style === 'zoom') next.scale(0.94);
      spawn(all(next.position([0, 0], 0.3, easeOutCubic), next.opacity(1, 0.22), next.scale(1, 0.3, easeOutCubic)));
    }
  }

  if (job.card) {
    const card = createRef<Node>();
    const shade = createRef<Rect>();
    view.add(<Rect ref={shade} size={[1920, 1080]} fill={NAVY} />);
    view.add(<Node ref={card} opacity={0}>
      <Txt x={-780} y={-90} offset={[-1, 0]} text={`CHAPTER ${String(job.number).padStart(2, '0')}`} fontFamily={MONO} fontWeight={600} fontSize={54} fill={SAFFRON} />
      <Txt x={-780} y={20} offset={[-1, 0]} text={job.card} fontFamily={TITLE} fontWeight={800} fontSize={job.card.length > 20 ? 104 : 140} fill={INK} />
      <Rect x={0} y={130} size={[1560, 6]} fill={SAFFRON} />
    </Node>);
    if (job.cardSeconds > 0) {
      const tiles: Rect[] = [];
      const pattern = new Node({});
      view.add(pattern);
      for (let row = 0; row < 8; row++) for (let col = 0; col < 14; col++) {
        const ref = createRef<Rect>();
        pattern.add(<Rect ref={ref} x={-910 + col * 140} y={-490 + row * 140} size={96} rotation={45} scale={0} fill={row % 2 === col % 2 ? '#1B3050' : '#16263C'} stroke={SLATE} lineWidth={2} />);
        tiles.push(ref());
      }
      yield* all(...tiles.map((tile, i) => delay((i % 14) * 0.012, tile.scale(1.5, 0.22, easeOutCubic))), card().opacity(1, 0.3));
      card().moveToTop();
      yield* until(job.cardSeconds - 0.42);
      yield* all(...tiles.map((tile, i) => delay((i % 14) * 0.012, tile.scale(0, 0.22, easeInOutCubic))), card().opacity(0, 0.25), shade().opacity(0, 0.32));
      pattern.remove();
    } else {
      shade().remove();
      card().remove();
    }
  }

  for (let index = 0; index < job.beats.length; index++) {
    const beat = job.beats[index];
    const following = job.beats[index + 1];
    const beatEnd = following ? following.t : total;
    yield* until(Math.max(0, beat.t - 0.28));
    if (beat.src !== undefined) source().text(beat.src);
    if (beat.map) {
      const map = beat.map;
      if (map.dim !== undefined) spawn(mapDim(map.dim, 0.4));
      if (map.hi) SPECIAL.forEach(code => {
        const tone = map.hi[code];
        if (tone) hi[code].color = tone === 'teal' ? TEAL : WARM;
        spawn(hi[code].level(tone ? 1 : 0, 0.45));
      });
      if (map.zoom !== undefined) spawn(fly(map.lon, map.lat, map.zoom, 0.95));
    }
    const style = beat.trans ?? CYCLE[turn++ % CYCLE.length];
    let entrance: ThreadGenerator | null = null;
    yield* change(style, () => {
      if (!beat.show) return null;
      const root = new Node({});
      overlay().add(root);
      const illustration = ILLUSTRATIONS[beat.show.kind];
      if (illustration) {
        illustration(root, beat.show, {later, now, clock, dur: Math.max(1, beatEnd - now())});
      } else {
        entrance = RENDER[beat.show.kind](root, beat.show);
      }
      return root;
    });
    if (entrance) yield* entrance;
  }

  if (job.sting !== undefined) {
    yield* until(job.sting);
    current?.remove();
    flows().removeChildren();
    const wipe = createRef<Rect>();
    view.add(<Rect ref={wipe} size={[1920, 1080]} fill={NAVY} opacity={0} />);
    const swoop = createSignal(0);
    const emblem = createRef<Node>();
    view.add(<Node ref={emblem} y={-90} scale={0.72} opacity={0} />);
    logo(emblem(), 300, swoop);
    const wordmark = createRef<Rect>();
    view.add(<Rect ref={wordmark} y={160} opacity={0} layout gap={26}>
      <Txt text="THE EQUATOR" fontFamily={TITLE} fontWeight={800} fontSize={92} fill={INK} />
      <Txt text="LEDGER" fontFamily={TITLE} fontWeight={800} fontSize={92} fill={SAFFRON} />
    </Rect>);
    yield* all(wipe().opacity(1, 0.25), mark().opacity(0, 0.2), source().opacity(0, 0.2));
    yield* all(emblem().opacity(1, 0.22), emblem().scale(1, 0.45, easeOutCubic), swoop(1, 0.8, easeInOutCubic));
    yield* wordmark().opacity(1, 0.3);
  }
  yield* until(total);
});
