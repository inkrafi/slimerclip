import {makeProject} from '@revideo/core';
import scene from './scene?scene';

export default makeProject({
  scenes: [scene],
  // Latar transparan, lalu ditumpuk ke video stok oleh backend. Jangan pakai null: Revideo menjadikannya hitam pekat.
  settings: {shared: {size: {x: 1920, y: 1080}, background: '#00000000'}},
});
