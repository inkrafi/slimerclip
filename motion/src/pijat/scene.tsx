import {makeScene2D} from '@revideo/2d';
import {useScene} from '@revideo/core';
import {jangan, janganThumb} from './jangan';
import {krekThumb, krekVideo} from './krek';
import {leher, leherThumb} from './leher';
import {ngantuk, ngantukThumb} from './ngantuk';
import {pegal, pegalThumb} from './pegal';
import {loadFonts} from './system';
import {usapan, usapanThumb} from './usapan';

export default makeScene2D('pijat', function* (view) {
  const job = useScene().variables.get<Record<string, any>>('job', {})();
  yield loadFonts();
  if (job.format === 'ngantuk') yield* (job.thumb ? ngantukThumb(view) : ngantuk(view, job));
  else if (job.format === 'jangan') yield* (job.thumb ? janganThumb(view) : jangan(view, job));
  else if (job.format === 'pegal') yield* (job.thumb ? pegalThumb(view) : pegal(view, job));
  else if (job.format === 'krek') yield* (job.thumb ? krekThumb(view) : krekVideo(view, job));
  else if (job.format === 'usapan') yield* (job.thumb ? usapanThumb(view) : usapan(view, job));
  else yield* (job.thumb ? leherThumb(view) : leher(view, job));
});
