import {makeScene2D} from '@revideo/2d';
import {useScene} from '@revideo/core';
import {loadFonts} from './common';
import {TEMPLATES} from './templates';

/** Satu adegan: template dan isinya datang dari variabel render (lihat backend/motion_scenes.py). */
export default makeScene2D('motion', function* (view) {
  const job = useScene().variables.get<Record<string, any>>('job', {})();
  yield loadFonts();
  yield* TEMPLATES[job.template as keyof typeof TEMPLATES](view, job);
});
