/** Ilustrasi vektor buatan sendiri: bebas lisensi, ringan dirender, dan warnanya mengikuti sistem channel. */
import {Circle, Line, Node, Rect, Txt} from '@revideo/2d';
import {createRef, createSignal, easeInOutCubic, Reference, ThreadGenerator, tween} from '@revideo/core';
import {DARK_INK, EDGE, GREEN, INK, MONO, MUTED, PANEL, PAPER_CARD, RED, SANS} from './system';

/** Ponsel m-banking dengan garis detak jantung. */
export function phone(saldo: string, ref: Reference<Node>, beat: ReturnType<typeof createSignal<number>>, labels = {app: 'm-banking', caption: 'Saldo rekening', footer: 'Tanggal 20'}) {
  const pulse: [number, number][] = [[-170, 0], [-90, 0], [-65, -18], [-40, 0], [-15, 0], [5, -90], [30, 70], [50, 0], [85, 0], [105, -24], [125, 0], [170, 0]];
  return (
    <Node ref={ref}>
      <Rect size={[470, 860]} radius={64} fill="#050806" stroke="#3b4a42" lineWidth={8} />
      <Rect size={[140, 26]} radius={13} y={-385} fill="#1d2622" />
      <Rect size={[420, 760]} radius={42} y={10} fill={PANEL} />
      <Txt text={labels.app} fontFamily={SANS} fontWeight={700} fontSize={40} fill={INK} x={-175} y={-310} offset={[-1, 0]} />
      <Txt text={labels.caption} fontFamily={SANS} fontWeight={500} fontSize={32} fill={MUTED} x={-175} y={-200} offset={[-1, 0]} />
      <Txt text={saldo} fontFamily={MONO} fontWeight={600} fontSize={56} fill={RED} x={-175} y={-135} offset={[-1, 0]} />
      <Rect size={[350, 2]} y={-65} fill={EDGE} />
      <Line points={pulse} y={80} stroke={RED} lineWidth={7} lineCap="round" lineJoin="round" end={beat} />
      {labels.footer ? <Rect size={[350, 90]} radius={18} y={270} fill={RED} opacity={0.16} /> : null}
      {labels.footer ? <Txt text={labels.footer} fontFamily={MONO} fontWeight={600} fontSize={34} fill={RED} y={270} /> : null}
    </Node>
  );
}

/** Goyang kecil yang terus berulang selama durasi tertentu. */
export function* tremble(node: Node, seconds: number, degrees = 1.6): ThreadGenerator {
  yield* tween(seconds, t => node.rotation(Math.sin(t * seconds * 34) * degrees * (1 - t * 0.5)));
  node.rotation(0);
}

/** Struk belanja dengan tepi bawah bergerigi. */
export function receiptShape(width: number, height: number) {
  const left = -width / 2;
  const tooth = 34;
  const points: [number, number][] = [[left, -height / 2], [-left, -height / 2], [-left, height / 2]];
  for (let x = -left - tooth, down = false; x >= left; x -= tooth, down = !down) points.push([x, height / 2 + (down ? 0 : 20)]);
  points.push([left, height / 2]);
  return <Line points={points} closed fill={PAPER_CARD} shadowColor="#000000aa" shadowBlur={50} shadowOffset={[0, 18]} />;
}

/** Mangkuk nasi. */
export function bowl(scale = 1) {
  return (
    <Node scale={scale}>
      <Circle size={230} y={-22} startAngle={180} endAngle={360} fill={INK} />
      <Circle size={330} startAngle={0} endAngle={180} fill={GREEN} />
      <Rect size={[338, 14]} radius={7} fill={INK} />
      <Rect size={[120, 18]} radius={9} y={170} fill={GREEN} />
      <Line points={[[60, -60], [190, -230]]} stroke={DARK_INK} lineWidth={10} lineCap="round" />
      <Line points={[[95, -50], [225, -210]]} stroke={DARK_INK} lineWidth={10} lineCap="round" />
    </Node>
  );
}

/** Roda yang pelan-pelan kempes: bodinya turun ke aspal dan bagian bawahnya rata, velgnya ikut mendekati tanah. */
export function tire(ground: string) {
  const body = createRef<Node>();
  const hub = createRef<Node>();
  const GROUND_Y = 232;
  const node = (
    <Node>
      <Node ref={body}>
        <Circle size={460} fill="#1a211d" />
        <Circle size={392} stroke="#39463f" lineWidth={6} />
      </Node>
      <Node ref={hub}>
        <Circle size={230} fill="#cbd4ce" />
        <Circle size={64} fill="#6d7a72" />
        {[0, 60, 120].map(angle => <Rect size={[210, 12]} rotation={angle} fill="#6d7a72" />)}
      </Node>
      <Rect size={[3200, 500]} y={GROUND_Y + 250} fill={ground} />
      <Rect size={[3200, 10]} y={GROUND_Y} fill="#14201a" />
    </Node>
  );
  return {
    node,
    *deflate(seconds: number): ThreadGenerator {
      yield* tween(seconds, t => {
        const value = easeInOutCubic(t);
        body().y(value * 74);
        body().scale([1 + value * 0.06, 1 - value * 0.05]);
        hub().y(value * 58);
      });
    },
  };
}

/** Dompet. */
export function wallet(scale = 1) {
  return (
    <Node scale={scale}>
      <Rect size={[320, 220]} radius={28} fill="#1a211d" stroke={GREEN} lineWidth={6} />
      <Rect size={[120, 76]} x={120} radius={18} fill={GREEN} />
      <Circle size={26} x={92} fill={DARK_INK} />
      <Rect size={[220, 14]} radius={7} y={-70} x={-30} fill="#39463f" />
    </Node>
  );
}

/** Laptop. */
export function laptop(scale = 1) {
  return (
    <Node scale={scale}>
      <Rect size={[340, 220]} radius={18} y={-40} fill="#1a211d" stroke="#39463f" lineWidth={6} />
      <Rect size={[300, 180]} radius={8} y={-40} fill={PANEL} />
      <Rect size={[150, 14]} radius={7} x={-60} y={-90} fill={GREEN} />
      <Rect size={[220, 12]} radius={6} x={-20} y={-55} fill="#39463f" />
      <Rect size={[180, 12]} radius={6} x={-40} y={-25} fill="#39463f" />
      <Rect size={[420, 24]} radius={12} y={84} fill="#39463f" />
    </Node>
  );
}

/** Balon komentar. */
export function commentBubble(width: number, height: number) {
  return (
    <Node>
      <Rect size={[width, height]} radius={28} fill={DARK_INK} />
      <Line points={[[-width / 2 + 60, height / 2 - 2], [-width / 2 + 60, height / 2 + 40], [-width / 2 + 110, height / 2 - 2]]} closed fill={DARK_INK} />
    </Node>
  );
}

