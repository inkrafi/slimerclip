/** Sistem visual akun belajar pijat: hangat, lembut, membulat. Krem, terakota, sage, cokelat kayu. */
import {Circle, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutSine, easeOutBack, easeOutCubic, spawn, ThreadGenerator, useThread, waitFor} from '@revideo/core';

export const CREAM = '#F8EEE3';
export const SAND = '#EBD5BE';
export const INK = '#4B3428';
export const SOFT_INK = '#8A6B58';
export const TERRA = '#C8664A';
export const PEACH = '#F2B48F';
export const SAGE = '#8DA787';
export const SAGE_DARK = '#5F7B5A';
export const GOLD = '#E3A857';
export const SKIN = '#EDBE9A';
export const SKIN_DARK = '#D49B76';
export const HAIR = '#3E2A22';
export const WHITE = '#FFFDF9';
export const ROUND = 'Nunito';

const FONTS: [string, string][] = [['/pijat/fonts/nunito-latin-600-normal.woff2', '600'], ['/pijat/fonts/nunito-latin-800-normal.woff2', '800']];

export async function loadFonts() {
  await Promise.all(FONTS.map(async ([url, weight]) => {
    const face = new FontFace(ROUND, `url(${url})`, {weight});
    await face.load();
    document.fonts.add(face);
  }));
}

export function* until(second: number): ThreadGenerator {
  const left = second - useThread().time();
  if (left > 0) yield* waitFor(left);
}

/** Latar krem dengan gumpalan warna lembut yang bergerak pelan seperti cahaya sore */
export function backdrop(view: View2D, duration: number) {
  view.add(<Rect size={[1080, 1920]} fill={CREAM} />);
  const blobs: [number, number, number, string][] = [[-380, -700, 620, PEACH], [420, -150, 560, SAGE], [-300, 650, 700, SAND], [380, 820, 520, PEACH]];
  blobs.forEach(([x, y, size, fill], i) => {
    const blob = createRef<Circle>();
    view.add(<Circle ref={blob} x={x} y={y} size={size} fill={fill} opacity={0.22} />);
    spawn(function* () {
      for (;;) yield* blob().position([x + (i % 2 ? -60 : 60), y + 50], 6 + i, easeInOutSine).to([x, y], 6 + i, easeInOutSine);
    });
  });
}

export function* pop(node: Node, seconds = 0.45): ThreadGenerator {
  node.opacity(1);
  yield* node.scale(1, seconds, easeOutBack);
}

export function* rise(node: Node, seconds = 0.6): ThreadGenerator {
  const y = node.y();
  node.y(y + 80);
  node.opacity(0);
  yield* all(node.y(y, seconds, easeOutCubic), node.opacity(1, seconds));
}

export function* fade(node: Node, seconds = 0.45): ThreadGenerator {
  yield* all(node.opacity(0, seconds), node.y(node.y() - 50, seconds, easeInOutSine));
  node.remove();
}

export const text = (value: string, size: number, fill = INK, weight = 800) => (
  <Txt text={value} fontFamily={ROUND} fontWeight={weight} fontSize={size} fill={fill} />
);

export function chip(value: string, fill: string, size = 46, ink = WHITE) {
  return new Rect({layout: true, padding: [size * 0.32, size * 0.7], radius: size, fill, scale: 0, opacity: 0, children: [text(value, size, ink)]});
}

/** Subtitle hangat: kartu krem membulat, kata yang sedang diucapkan berwarna terakota */
export interface Word { w: string; s: number; e: number; p?: boolean }
export function captions(view: View2D, words: Word[], y: number, size: number, duration: number) {
  const pages: Word[][] = [];
  let page: Word[] = [];
  words.forEach((word, i) => {
    const length = page.reduce((sum, item) => sum + item.w.length + 1, 0) + word.w.length;
    if (page.length && length > 20) {
      pages.push(page);
      page = [];
    }
    page.push(word);
    const next = words[i + 1];
    if (!next || word.p || next.s - word.e > 0.35) {
      pages.push(page);
      page = [];
    }
  });
  const box = createRef<Rect>();
  view.add(<Rect ref={box} layout gap={size * 0.26} justifyContent="center" alignItems="center" y={y} padding={[size * 0.22, size * 0.55]}
    radius={size} fill={WHITE} shadowColor="#4B342833" shadowBlur={30} shadowOffsetY={8} opacity={0} />);
  let shown = -1;
  spawn(function* () {
    while (useThread().time() < duration) {
      const now = useThread().time();
      const index = pages.findIndex((item, i) => {
        const end = pages[i + 1] ? Math.min(pages[i + 1][0].s, item[item.length - 1].e + 0.5) : item[item.length - 1].e + 0.5;
        return now >= item[0].s && now < end;
      });
      if (index !== shown) {
        shown = index;
        box().removeChildren();
        box().opacity(index >= 0 ? 1 : 0);
        if (index >= 0) box().add(pages[index].map(word => <Txt text={word.w} fontFamily={ROUND} fontWeight={800} fontSize={size} fill={INK} />));
      }
      if (index >= 0) {
        const current = pages[index];
        const age = Math.min(1, (now - current[0].s) / 0.18);
        box().scale(0.94 + 0.06 * easeOutCubic(age));
        box().children().forEach((node, i) => (node as Txt).fill(now >= current[i].s ? TERRA : INK));
      }
      yield;
    }
    box().opacity(0);
  });
}
