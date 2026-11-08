/** Aset video channel: title sting dan end screen. */
import {Circle, makeScene2D, Node, Rect, Txt} from '@revideo/2d';
import {all, createRef, createSignal, easeInOutCubic, easeOutCubic, useScene, useThread, waitFor} from '@revideo/core';
import {BODY, INK, loadFonts, logo, NAVY, SAFFRON, SLATE, TITLE} from './system';

function* wordmarkIn(wordmark: Rect) {
  yield* wordmark.opacity(1, 0.3);
}

export default makeScene2D('equator-brand', function* (view) {
  const job = useScene().variables.get<Record<string, any>>('job', {})();
  yield loadFonts();
  view.add(<Rect size={[1920, 1080]} fill={NAVY} />);

  if (job.kind === 'sting') {
    const swoop = createSignal(0);
    const emblem = createRef<Node>();
    view.add(<Node ref={emblem} y={-90} scale={0.72} opacity={0} />);
    logo(emblem(), 300, swoop);
    const wordmark = createRef<Rect>();
    view.add(<Rect ref={wordmark} y={160} opacity={0} layout gap={26}>
      <Txt text="THE EQUATOR" fontFamily={TITLE} fontWeight={800} fontSize={92} fill={INK} />
      <Txt text="LEDGER" fontFamily={TITLE} fontWeight={800} fontSize={92} fill={SAFFRON} />
    </Rect>);
    yield* all(emblem().opacity(1, 0.22), emblem().scale(1, 0.45, easeOutCubic), swoop(1, 0.8, easeInOutCubic));
    yield* wordmarkIn(wordmark());
  } else {
    /* Kotak video dan lingkaran subscribe ditumpuk elemen end screen YouTube di posisi yang sama */
    const stage = createRef<Node>();
    view.add(<Node ref={stage} opacity={0} />);
    stage().add(<Txt x={-860} y={-420} offset={[-1, 0]} text="Watch next" fontFamily={TITLE} fontWeight={800} fontSize={64} fill={INK} />);
    stage().add(<Rect x={-310} y={30} size={[1100, 619]} radius={12} fill="#16263C" stroke={SLATE} lineWidth={2} />);
    stage().add(<Circle x={585} y={-130} size={250} fill="#16263C" stroke={SAFFRON} lineWidth={4} />);
    stage().add(<Txt x={585} y={60} text="Subscribe" fontFamily={TITLE} fontWeight={800} fontSize={60} fill={SAFFRON} />);
    stage().add(<Txt x={585} y={190} width={480} textWrap textAlign="center" lineHeight="130%" text="Southeast Asia's business stories, told with maps and data."
      fontFamily={BODY} fontWeight={500} fontSize={34} fill={INK} />);
    const mark = createRef<Node>();
    stage().add(<Node ref={mark} x={-842} y={468} />);
    logo(mark(), 56);
    stage().add(<Txt x={-796} y={468} offset={[-1, 0]} text="The Equator Ledger" fontFamily={BODY} fontWeight={600} fontSize={28} fill={INK} />);
    yield* stage().opacity(1, 0.5);
  }
  const left = job.duration - useThread().time();
  if (left > 0) yield* waitFor(left);
});
