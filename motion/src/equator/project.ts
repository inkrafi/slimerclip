import {makeProject} from '@revideo/core';
import scene from './scene?scene';

export default makeProject({
  scenes: [scene],
  settings: {shared: {size: {x: 1920, y: 1080}, background: '#0F1B2D'}},
});
