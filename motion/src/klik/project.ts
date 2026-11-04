import {makeProject} from '@revideo/core';
import scene from './scene?scene';

export default makeProject({
  scenes: [scene],
  settings: {shared: {size: {x: 1080, y: 1920}, background: '#0a0f0d'}},
});
