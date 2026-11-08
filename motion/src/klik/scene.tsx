import {makeScene2D} from '@revideo/2d';
import {useScene} from '@revideo/core';
import {auto} from './auto';
import {clipMotion} from './clip';
import {long} from './long';
import {short} from './short';
import {loadFonts} from './system';

export default makeScene2D('klik', function* (view) {
  const job = useScene().variables.get<Record<string, any>>('job', {})();
  yield loadFonts();
  yield* (job.format === 'clipmotion' ? clipMotion : job.format === 'auto' ? auto : job.format === 'long' ? long : short)(view, job);
});
