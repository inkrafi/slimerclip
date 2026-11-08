/** The Equator Ledger, cold open nikel. Isi adegan mengikuti waktu kata pada narasi. */
import {Img, makeScene2D, Node, Rect, Spline, Txt} from '@revideo/2d';
import {
  all, createRef, createSignal, delay, easeInOutCubic, easeOutBack, easeOutCubic, linear, spawn, ThreadGenerator, tween,
  useScene, useThread, waitFor,
} from '@revideo/core';
import {BODY, CORAL, DARK, Geo, INK, LAND, loadFonts, logo, mixColor, MONO, NAVY, PAPER, project, SAFFRON, SLATE, TEAL, TITLE} from './system';

async function loadAssets() {
  await loadFonts();
  return (await fetch('/equator/data/world.json')).json();
}

function* until(second: number): ThreadGenerator {
  const left = second - useThread().time();
  if (left > 0) yield* waitFor(left);
}

export default makeScene2D('equator', function* (view) {
  const job = useScene().variables.get<Record<string, any>>('job', {})();
  const world: any = yield loadAssets();
  const cue: Record<string, number> = job.cues;
  const total: number = job.duration;

  /* Kamera */
  const camLon = createSignal(0);
  const camLat = createSignal(18);
  const zoom = createSignal(1);
  const centre = () => project(camLon(), camLat());
  const toScreen = (lon: number, lat: number): [number, number] => {
    const [x, y] = project(lon, lat);
    const [cx, cy] = centre();
    return [(x - cx) * zoom(), (y - cy) * zoom()];
  };
  function* fly(lon: number, lat: number, target: number, seconds: number): ThreadGenerator {
    const [lon0, lat0, zoom0] = [camLon(), camLat(), zoom()];
    yield* tween(seconds, value => {
      const t = easeInOutCubic(value);
      camLon(lon0 + (lon - lon0) * t);
      camLat(lat0 + (lat - lat0) * t);
      zoom(Math.exp(Math.log(zoom0) + (Math.log(target) - Math.log(zoom0)) * t));
    });
  }

  /* Peta */
  const stage = createRef<Node>();
  const china = createSignal(0);
  const russia = createSignal(0);
  const indonesia = createSignal(0);
  const mapDim = createSignal(0.45);
  view.add(<Rect size={[1920, 1080]} fill={NAVY} />);
  view.add(<Node ref={stage} position={() => { const [x, y] = centre(); return [-x * zoom(), -y * zoom()]; }} scale={zoom} />);
  const special = ['CHN', 'RUS', 'IDN'];
  const rest = Object.entries<string>(world.countries).filter(([code]) => !special.includes(code)).map(([, d]) => d).join('');
  stage().add(new Geo(rest, () => LAND, zoom));
  stage().add(new Geo(world.countries.CHN, () => mixColor(LAND, '#6E3B37', china()), zoom));
  stage().add(new Geo(world.countries.RUS, () => mixColor(LAND, '#6E3B37', russia()), zoom));
  stage().add(new Geo(world.countries.IDN, () => mixColor(LAND, TEAL, indonesia()), zoom));
  const flows = createRef<Node>();
  stage().add(<Node ref={flows} />);
  view.add(<Rect size={[1920, 1080]} fill={NAVY} opacity={mapDim} />);
  const overlay = createRef<Node>();
  view.add(<Node ref={overlay} />);

  /* Sumber dan watermark */
  const source = createRef<Txt>();
  view.add(<Txt ref={source} x={-920} y={498} offset={[-1, 0]} text="Source: USGS, Mineral Commodity Summaries 2026 (2025 estimates)" fontFamily={BODY} fontWeight={500} fontSize={24} fill={INK} opacity={0.72} />);
  const mark = createRef<Node>();
  view.add(<Node ref={mark} position={[866, -484]} opacity={0.75} />);
  logo(mark(), 62);

  /* Tekstur kertas yang sangat tipis */
  view.add(<Img src="/equator/grain.png" size={[1920, 1080]} opacity={0.025} compositeOperation="overlay" />);

  /* 1. Dua dari tiga ton */
  const hook = createRef<Node>();
  overlay().add(<Node ref={hook} opacity={0} />);
  const ingots = [-300, 0, 300].map(x => {
    const box = createRef<Rect>();
    const fill = createSignal(0);
    hook().add(<Rect ref={box} x={x} y={-190} size={[260, 150]} radius={14} scale={0}
      stroke={SLATE} lineWidth={3} fill={() => mixColor('#1A2B43', SAFFRON, fill())} />);
    return {box, fill};
  });
  const hookTitle = createRef<Txt>();
  hook().add(<Txt ref={hookTitle} y={40} text="2 of every 3 tons" fontFamily={TITLE} fontWeight={800} fontSize={112} fill={INK} opacity={0} />);
  const hookNote = createRef<Txt>();
  hook().add(<Txt ref={hookNote} y={150} text="of the nickel mined in 2025 came from one country" fontFamily={BODY} fontWeight={500} fontSize={42} fill={INK} opacity={0} />);
  spawn(tween(cue.notChina, value => { zoom(1 + 0.08 * value); }));
  yield* hook().opacity(1, 0.2);
  yield* all(ingots[0].box().scale(1, 0.35, easeOutBack), delay(0.3, ingots[1].box().scale(1, 0.35, easeOutBack)));
  yield* until(cue.three);
  yield* ingots[2].box().scale(1, 0.3, easeOutBack);
  yield* all(ingots[0].fill(1, 0.3), delay(0.14, ingots[1].fill(1, 0.3)), hookTitle().opacity(1, 0.3));
  yield* until(cue.oneCountry);
  yield* hookNote().opacity(1, 0.3);
  yield* until(cue.notChina - 0.3);

  /* 2. Bukan Tiongkok, bukan Rusia */
  yield* all(hook().opacity(0, 0.25), mapDim(0, 0.45), fly(100, 42, 2.35, 0.7));
  function* strike(lon: number, lat: number, name: string, tons: string): ThreadGenerator {
    const [x, y] = toScreen(lon, lat);
    const label = createRef<Node>();
    const line = createRef<Rect>();
    overlay().add(<Node ref={label} position={[x, y]} opacity={0}>
      <Txt y={-32} text={name} fontFamily={TITLE} fontWeight={800} fontSize={76} fill={INK} />
      <Rect ref={line} y={-32} width={name.length * 44} height={7} fill={CORAL} scale={[0, 1]} />
      <Txt y={36} text={tons} fontFamily={MONO} fontWeight={500} fontSize={36} fill={INK} />
    </Node>);
    yield* label().opacity(1, 0.18);
    yield* line().scale([1, 1], 0.24, easeOutCubic);
  }
  yield* until(cue.china - 0.05);
  yield* all(china(1, 0.3), strike(103, 34, 'China', '120,000 t'));
  yield* until(cue.russia - 0.05);
  yield* all(russia(1, 0.3), strike(96, 61, 'Russia', '200,000 t'));
  yield* until(cue.indonesia - 0.12);

  /* 3. Indonesia */
  const hit = createRef<Node>();
  const counter = createRef<Txt>();
  yield* all(overlay().opacity(0, 0.25), fly(118, -3, 5.6, 0.6), china(0, 0.45), russia(0, 0.45));
  overlay().removeChildren();
  overlay().opacity(1);
  overlay().add(<Node ref={hit} y={-310} opacity={0}>
    <Txt y={-42} text="Indonesia" fontFamily={TITLE} fontWeight={800} fontSize={118} fill={SAFFRON} />
    <Txt ref={counter} y={62} text="0 t" fontFamily={MONO} fontWeight={600} fontSize={70} fill={INK} />
  </Node>);
  yield* all(indonesia(1, 0.4), hit().opacity(1, 0.25), tween(1.1, value => {
    counter().text(`${(Math.round((2600000 * easeOutCubic(value)) / 10000) * 10000).toLocaleString('en-US')} t`);
  }));
  counter().text('2,600,000 t');
  yield* hit().scale(1.05, 0.1).to(1, 0.16);
  yield* until(cue.in2020 - 0.85);

  /* 4. Larangan ekspor, lalu pabrik dipanggil masuk */
  const flowLine = createRef<Spline>();
  const flowDash = createSignal(0);
  const flowColor = createSignal(0);
  const sulawesi = project(121.8, -2.6);
  const chinaCoast = project(113, 26);
  yield* all(hit().opacity(0, 0.3), fly(112, 12, 3.45, 0.85));
  source().text('Sources: USGS; WTO dispute DS592 (EU v. Indonesia)');
  overlay().removeChildren();
  const unit = () => 1 / zoom();
  flows().add(<Spline ref={flowLine} points={[sulawesi, [(sulawesi[0] + chinaCoast[0]) / 2 + 26, (sulawesi[1] + chinaCoast[1]) / 2], chinaCoast]}
    smoothness={0.45} end={0} opacity={0} stroke={() => mixColor(SAFFRON, CORAL, flowColor())} lineWidth={() => 7 * unit()} lineCap="round"
    lineDash={() => [20 * unit(), 16 * unit()]} lineDashOffset={flowDash} endArrow arrowSize={() => 22 * unit()} />);
  spawn(tween(cue.world - cue.in2020 + 1, value => { flowDash(-value * 260 * unit()); }, linear));
  const year = createRef<Node>();
  overlay().add(<Node ref={year} position={[-860, -400]} opacity={0}>
    <Txt offset={[-1, 0]} text="JAN 2020" fontFamily={MONO} fontWeight={600} fontSize={64} fill={SAFFRON} />
    <Txt offset={[-1, 0]} y={68} text="Raw nickel ore exports" fontFamily={BODY} fontWeight={600} fontSize={40} fill={INK} />
  </Node>);
  yield* until(cue.in2020);
  flowLine().opacity(1);
  yield* all(year().opacity(1, 0.25), flowLine().end(1, 0.8, easeInOutCubic));
  yield* until(cue.banned);
  const stamp = createRef<Rect>();
  const [mx, my] = toScreen(116.5, 9);
  overlay().add(<Rect ref={stamp} position={[mx, my]} rotation={-7} scale={1.6} opacity={0} padding={[12, 30]} layout radius={10} stroke={CORAL} lineWidth={7} fill="#0F1B2Dee">
    <Txt text="BANNED" fontFamily={TITLE} fontWeight={800} fontSize={72} fill={CORAL} />
  </Rect>);
  yield* all(stamp().scale(1, 0.18, easeOutCubic), stamp().opacity(1, 0.1), flowColor(1, 0.2));
  yield* until(cue.factories - 0.25);
  const inbound = [project(72, 24), project(139, 36), project(150, -28), project(88, 8)];
  const incoming: Spline[] = [];
  yield* all(stamp().opacity(0, 0.25), flowLine().opacity(0, 0.25), year().opacity(0, 0.25));
  inbound.forEach(from => {
    const ref = createRef<Spline>();
    flows().add(<Spline ref={ref} points={[from, [(from[0] + sulawesi[0]) / 2, (from[1] + sulawesi[1]) / 2 - 8], [sulawesi[0], sulawesi[1]]]} smoothness={0.4} end={0} opacity={0}
      stroke={SAFFRON} lineWidth={() => 6 * unit()} lineCap="round" lineDash={() => [16 * unit(), 14 * unit()]} lineDashOffset={flowDash}
      endArrow arrowSize={() => 18 * unit()} />);
    incoming.push(ref());
  });
  spawn(tween(cue.europe - cue.factories, value => { flowDash(-value * 220 * unit()); }, linear));
  incoming.forEach(line => line.opacity(1));
  yield* all(...incoming.map((line, i) => delay(i * 0.12, line.end(1, 0.8, easeInOutCubic))));
  yield* until(cue.build);
  const pin = createRef<Rect>();
  const [px, py] = toScreen(121.8, -2.6);
  overlay().add(<Rect ref={pin} position={[px, py - 92]} scale={0} layout padding={[12, 28]} radius={10} fill={SAFFRON}>
    <Txt text="Build here" fontFamily={TITLE} fontWeight={800} fontSize={60} fill={DARK} />
  </Rect>);
  yield* pin().scale(1, 0.32, easeOutBack);
  yield* until(cue.europe - 0.4);

  /* 5. Kartu ringkasan WTO */
  const sheet = createRef<Rect>();
  overlay().add(<Rect ref={sheet} y={1200} rotation={-1.2} size={[1240, 800]} radius={10} fill={PAPER} shadowColor="#00000088" shadowBlur={50} shadowOffsetY={18} />);
  sheet().add(<Txt x={-550} y={-310} offset={[-1, 0]} text="SUMMARY · WTO DISPUTE DS592" fontFamily={MONO} fontWeight={600} fontSize={32} fill="#5B6577" />);
  sheet().add(<Txt x={-550} y={-222} offset={[-1, 0]} text="EU v. Indonesia" fontFamily={TITLE} fontWeight={800} fontSize={92} fill={DARK} />);
  const rows: [string, string, number, boolean][] = [
    ['Complaint', 'The EU challenges the ore export ban', cue.sued, false],
    ['2022 ruling', 'The panel rules against Indonesia', cue.ruling, true],
    ['Next move', 'Indonesia appeals in December 2022', cue.appealed, false],
    ['The ban', 'It stays in place', cue.kept, true],
  ];
  const rowNodes = rows.map(([label, text, at, marked], i) => {
    const row = createRef<Node>();
    const glow = createRef<Rect>();
    sheet().add(<Node ref={row} y={-92 + i * 120} opacity={0}>
      <Rect ref={glow} x={-568} offset={[-1, 0]} size={[1136, 86]} radius={8} fill={SAFFRON} opacity={0.42} scale={[0, 1]} />
      <Txt x={-540} offset={[-1, 0]} text={label} fontFamily={MONO} fontWeight={500} fontSize={32} fill="#5B6577" />
      <Txt x={-270} offset={[-1, 0]} text={text} fontFamily={BODY} fontWeight={600} fontSize={42} fill={DARK} />
    </Node>);
    return {row, glow, at, marked};
  });
  yield* sheet().y(0, 0.55, easeOutCubic);
  flows().removeChildren();
  pin().remove();
  for (const item of rowNodes) {
    yield* until(item.at);
    if (item.marked) yield* all(item.row().opacity(1, 0.15), item.glow().scale([1, 1], 0.3, easeOutCubic));
    else yield* item.row().opacity(1, 0.2);
  }
  yield* until(cue.factoriesCame - 0.55);

  /* 6. Pabrik datang */
  source().text('Factory positions are illustrative');
  yield* all(sheet().y(1200, 0.42, easeInOutCubic), fly(124, -2, 10.5, 0.8));
  sheet().remove();
  const sites: [number, number][] = [[122.0, -2.7], [122.5, -3.95], [121.45, -4.95], [127.45, -1.45], [127.9, 0.55]];
  const icons = sites.map(([lon, lat]) => {
    const [x, y] = toScreen(lon, lat);
    const icon = createRef<Node>();
    overlay().add(<Node ref={icon} position={[x, y]} scale={0}>
      <Rect y={6} size={[66, 40]} radius={3} fill={SAFFRON} stroke={NAVY} lineWidth={3} />
      <Rect x={18} y={-22} size={[16, 44]} radius={2} fill={SAFFRON} stroke={NAVY} lineWidth={3} />
      <Rect x={-14} y={8} size={[14, 16]} fill={NAVY} />
      <Rect x={8} y={8} size={[14, 16]} fill={NAVY} />
    </Node>);
    return icon;
  });
  yield* until(cue.came - 0.25);
  yield* all(...icons.map((icon, i) => delay(i * 0.07, icon().scale(0.8, 0.26, easeOutBack))));
  yield* until(cue.but - 0.1);

  /* 7. Pertanyaan */
  const asks = [['But who', INK, -210], ['actually', INK, 0], ['won?', SAFFRON, 220]] as const;
  source().opacity(0);
  const question = asks.map(([text, color, y]) => {
    const ref = createRef<Txt>();
    overlay().add(<Txt ref={ref} y={y} text={text} fontFamily={TITLE} fontWeight={800} fontSize={190} fill={color} opacity={0} />);
    return ref;
  });
  yield* all(mapDim(0.86, 0.3), question[0]().opacity(1, 0.18), ...icons.map(icon => icon().opacity(0, 0.18)));
  yield* until(cue.actually);
  yield* question[1]().opacity(1, 0.15);
  yield* until(cue.won);
  yield* all(question[2]().opacity(1, 0.12), question[2]().scale(1.06, 0.12).to(1, 0.14));
  yield* until(cue.sting - 0.28);

  /* 8. Title sting */
  const wipe = createRef<Rect>();
  view.add(<Rect ref={wipe} size={[1920, 1080]} fill={NAVY} opacity={0} />);
  const swoop = createSignal(0);
  const emblem = createRef<Node>();
  view.add(<Node ref={emblem} y={-90} scale={0.7} opacity={0} />);
  logo(emblem(), 300, swoop);
  const wordmark = createRef<Rect>();
  view.add(<Rect ref={wordmark} y={160} opacity={0} layout gap={26}>
    <Txt text="THE EQUATOR" fontFamily={TITLE} fontWeight={800} fontSize={92} fill={INK} />
    <Txt text="LEDGER" fontFamily={TITLE} fontWeight={800} fontSize={92} fill={SAFFRON} />
  </Rect>);
  yield* all(wipe().opacity(1, 0.28), mark().opacity(0, 0.2));
  yield* all(emblem().opacity(1, 0.22), emblem().scale(1, 0.4, easeOutCubic), swoop(1, 0.75, easeInOutCubic));
  yield* wordmark().opacity(1, 0.3);
  yield* until(total);
});
