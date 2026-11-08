/** Animasi penuh 9:16 di dalam klip percakapan. Warnanya mengikuti highlight klip, tanpa label channel karena bisa untuk klien. */
import {Node, Rect, View2D} from '@revideo/2d';
import {createRef, ThreadGenerator} from '@revideo/core';
import {Box, compare, flow, ledger, numberScene, toneFor, verdict} from './auto';
import {until} from './system';

export function* clipMotion(view: View2D, job: Record<string, any>): ThreadGenerator {
  const seconds: number = job.seconds;
  const box: Box = {wide: false, width: 860, top: -660, bottom: 660};
  const tone = {...toneFor('grid'), accent: job.accent};
  const stage = createRef<Node>();
  view.add(<Rect size={[1080, 1920]} fill="#0b0b0d" />);
  view.add(<Node ref={stage} />);
  const group = stage();
  const motion = job.motion;
  if (job.template === 'number') yield* numberScene(group, motion, tone, box, seconds);
  else if (job.template === 'compare') yield* compare(group, motion, tone, box, seconds);
  else if (job.template === 'flow') yield* flow(group, motion, tone, box, seconds);
  else if (job.template === 'verdict') yield* verdict(group, motion, tone, box, [seconds * 0.4]);
  else if (job.template === 'ledger') {
    const rows = motion.rows.length;
    yield* ledger(group, motion, tone, box, motion.rows.map((_: unknown, i: number) => 0.4 + ((seconds - 1) * i) / Math.max(1, rows)));
  }
  yield* until(seconds);
}
