/** Sistem visual Klik Digital ID: layar kerja gelap, angka sebagai bintang, kursor dan klik sebagai ciri khas. */
import {Circle, Gradient, Line, Node, Rect, Txt, Video, View2D} from '@revideo/2d';
import {
  all, createRef, easeOutCubic, linear, Reference, spawn, ThreadGenerator, tween, useThread, Vector2, waitFor,
} from '@revideo/core';

export const BG = '#0a0f0d';
export const PANEL = '#111815';
export const EDGE = '#26332e';
export const INK = '#eef4ef';
export const MUTED = '#93a59c';
export const GREEN = '#3dffa2';
export const RED = '#ff5c57';
export const PAPER = '#f3efe4';
export const PAPER_CARD = '#fffdf6';
export const PAPER_EDGE = '#d6cfbc';
export const DARK_INK = '#14201a';
export const DARK_MUTED = '#5e665d';
export const DEEP_GREEN = '#08824c';
export const DEEP_RED = '#c62f2b';
export const SANS = 'IBM Plex Sans';
export const MONO = 'IBM Plex Mono';

/** Lebar satu karakter font mono, dipakai untuk menaruh kursor tepat di ujung teks */
const MONO_RATIO = 0.6;

const FONTS: [string, string, string][] = [
  [SANS, '/klik/fonts/ibm-plex-sans-latin-500-normal.woff2', '500'],
  [SANS, '/klik/fonts/ibm-plex-sans-latin-700-normal.woff2', '700'],
  [MONO, '/klik/fonts/ibm-plex-mono-latin-500-normal.woff2', '500'],
  [MONO, '/klik/fonts/ibm-plex-mono-latin-600-normal.woff2', '600'],
];

export async function loadFonts() {
  await Promise.all(FONTS.map(async ([family, url, weight]) => {
    const face = new FontFace(family, `url(${url})`, {weight});
    await face.load();
    document.fonts.add(face);
  }));
}

/** Dibulatkan ke ribuan, supaya angka yang sedang menghitung tidak berakhir seperti Rp1.900.008 */
export const rupiah = (value: number) => `Rp${(Math.round(value / 1000) * 1000).toLocaleString('id-ID')}`;

/** Tunggu sampai detik tertentu. Kalau sudah lewat, langsung lanjut, jadi animasi panjang tidak menggeser cue berikutnya. */
export function* until(second: number): ThreadGenerator {
  const left = second - useThread().time();
  if (left > 0) yield* waitFor(left);
}

/** Latar: kisi halus yang bergeser pelan dan pendaran tipis, supaya tidak ada frame yang benar-benar diam. */
export function background(view: Node, width: number, height: number, duration: number) {
  const grid = createRef<Node>();
  const STEP = 120;
  view.add(<Rect size={[width, height]} fill={BG} />);
  view.add(<Node ref={grid}>
    {Array.from({length: Math.ceil(width / STEP) + 3}, (_, i) => (
      <Rect width={2} height={height + STEP * 3} x={(i - Math.ceil(width / STEP / 2) - 1) * STEP} fill="#ffffff09" />
    ))}
    {Array.from({length: Math.ceil(height / STEP) + 3}, (_, i) => (
      <Rect width={width + STEP * 3} height={2} y={(i - Math.ceil(height / STEP / 2) - 1) * STEP} fill="#ffffff09" />
    ))}
  </Node>);
  view.add(<Rect size={[width, height]} fill={new Gradient({
    type: 'radial', fromRadius: 0, toRadius: Math.max(width, height) * 0.62, from: [0, -height * 0.18], to: [0, -height * 0.18],
    stops: [{offset: 0, color: '#3dffa21c'}, {offset: 1, color: '#3dffa200'}],
  })} />);
  spawn(grid().position(new Vector2(-STEP, -STEP), duration, linear));
}

/** Label tetap di tepi layar, di atas pelat gelap supaya terbaca di latar apa pun. "Angka contoh" sengaja selalu terlihat. */
export function statusBar(view: View2D, y: number, halfWidth: number, note: string, fontSize: number, name = 'KLIK DIGITAL ID') {
  const plate = fontSize * 1.9;
  const nameWidth = (name.length * 0.6 + 2.2) * fontSize;
  const noteWidth = note.length * fontSize * 0.6 + fontSize * 1.4;
  view.add(<Node y={y}>
    <Rect size={[nameWidth, plate]} radius={plate / 2} x={-halfWidth + nameWidth / 2} fill="#0a0f0ddd" />
    <Circle size={fontSize * 0.5} x={-halfWidth + fontSize * 0.8} fill={GREEN} />
    <Txt text={name} fontFamily={MONO} fontWeight={600} fontSize={fontSize} fill={INK} x={-halfWidth + fontSize * 1.35} offset={[-1, 0]} />
    <Rect size={[noteWidth, plate]} radius={plate / 2} x={halfWidth - noteWidth / 2} fill="#0a0f0ddd" />
    <Txt text={note} fontFamily={MONO} fontWeight={500} fontSize={fontSize} fill={INK} x={halfWidth - fontSize * 0.7} offset={[1, 0]} />
  </Node>);
}

export type Backdrop = 'grid' | 'paper' | 'red' | 'green' | `video:${string}` | `red:${string}`;

/**
 * Latar yang berganti: kisi, kertas, warna penuh, atau video stok yang digelapkan.
 * Transisi menutup layar lebih dulu, lalu onCovered menukar isi adegan di balik penutup.
 */
export class Backdrops {
  private root = createRef<Node>();
  private cover = createRef<Node>();
  private current: Node | null = null;

  public constructor(private view: View2D, private width: number, private height: number, private duration: number) {
    view.add(<Node ref={this.root} />);
  }

  /** Panggil setelah panggung ditambahkan, supaya penutup transisi ada di atas isi adegan. */
  public mountCover() {
    this.view.add(<Node ref={this.cover} />);
  }

  private make(kind: Backdrop): Node {
    const size: [number, number] = [this.width, this.height];
    const node = new Node({});
    if (kind.startsWith('red:')) {
      /* Latar merah tembus pandang: video stok tetap terlihat di bawahnya */
      const [src, cover] = kind.slice(4).split('|');
      const clip = createRef<Video>();
      node.add(<Video ref={clip} src={src} size={size} play />);
      node.add(<Rect size={size} fill={DEEP_RED} opacity={Number(cover ?? 0.68)} />);
      spawn(clip().scale(1.07, 9, linear));
    } else if (kind.startsWith('video:')) {
      const [src, dim] = kind.slice(6).split('|');
      const clip = createRef<Video>();
      node.add(<Video ref={clip} src={src} size={size} play />);
      node.add(<Rect size={size} fill={DARK_INK} opacity={Number(dim ?? 0.6)} />);
      spawn(clip().scale(1.07, 9, linear));
    } else if (kind === 'grid') {
      background(node, this.width, this.height, this.duration);
    } else if (kind === 'paper') {
      node.add(<Rect size={size} fill={PAPER} />);
      for (let y = -this.height / 2; y < this.height / 2; y += 72) node.add(<Rect size={[this.width, 2]} y={y} fill="#14201a10" />);
    } else {
      node.add(<Rect size={size} fill={kind === 'red' ? DEEP_RED : GREEN} />);
    }
    return node;
  }

  public set(kind: Backdrop) {
    this.current?.remove();
    this.current = this.make(kind);
    this.root().add(this.current);
  }

  /** Larut pelan, untuk perubahan tanpa pergantian adegan. */
  public *fade(kind: Backdrop, seconds = 0.5): ThreadGenerator {
    const old = this.current;
    const next = this.make(kind);
    next.opacity(0);
    this.root().add(next);
    this.current = next;
    yield* next.opacity(1, seconds);
    old?.remove();
  }

  /** Tirai warna lewat dari kiri ke kanan. */
  public *shutter(kind: Backdrop, onCovered: () => void, color = GREEN): ThreadGenerator {
    const bar = createRef<Rect>();
    this.cover().add(<Rect ref={bar} size={[this.width * 1.3, this.height * 1.3]} x={-this.width * 1.3} rotation={-6} fill={color} />);
    yield* bar().x(0, 0.2, easeOutCubic);
    this.set(kind);
    onCovered();
    yield* bar().x(this.width * 1.3, 0.24, easeOutCubic);
    bar().remove();
  }

  /** Lingkaran membesar dari titik klik, ciri khas channel. */
  public *iris(kind: Backdrop, at: [number, number], onCovered: () => void, color = GREEN): ThreadGenerator {
    const dot = createRef<Circle>();
    this.cover().add(<Circle ref={dot} size={0} position={at} fill={color} />);
    yield* dot().size(Math.hypot(this.width, this.height) * 2.2, 0.28, easeOutCubic);
    this.set(kind);
    onCovered();
    yield* dot().opacity(0, 0.18);
    dot().remove();
  }

  /** Kartu layar baru naik menimpa layar lama. */
  public *slide(kind: Backdrop, onCovered: () => void): ThreadGenerator {
    const sheet = createRef<Rect>();
    const fill = kind === 'paper' ? PAPER : kind === 'red' ? DEEP_RED : kind === 'green' ? GREEN : BG;
    this.cover().add(<Rect ref={sheet} size={[this.width, this.height]} y={this.height} fill={fill} />);
    yield* sheet().y(0, 0.26, easeOutCubic);
    this.set(kind);
    onCovered();
    sheet().remove();
  }
}

/** Masuk: naik sedikit sambil membesar. Keluar: terangkat sambil mengecil, seperti berpindah jendela. */
export function* enter(group: Node, seconds = 0.42): ThreadGenerator {
  const y = group.y();
  group.y(y + 90);
  group.scale(0.96);
  group.opacity(0);
  yield* all(group.y(y, seconds, easeOutCubic), group.scale(1, seconds, easeOutCubic), group.opacity(1, seconds * 0.6));
}

export function* leave(group: Node, seconds = 0.26): ThreadGenerator {
  yield* all(group.y(group.y() - 70, seconds), group.scale(0.95, seconds), group.opacity(0, seconds));
  group.remove();
}

/** Teks mengetik dengan kursor blok di ujungnya. x adalah tepi kiri teks. */
export function* typeLine(line: Reference<Txt>, block: Reference<Rect>, text: string, x: number, fontSize: number, seconds: number): ThreadGenerator {
  yield* tween(seconds, t => {
    const count = Math.round(text.length * t);
    line().text(text.slice(0, count));
    block().x(x + count * fontSize * MONO_RATIO + fontSize * 0.34);
  });
}

/** Panah kursor, ciri khas channel: terbang ke titik sasaran lalu mengklik dengan riak hijau. */
export function pointer(parent: Node, from: [number, number], scale = 2) {
  const root = createRef<Node>();
  const ripple = createRef<Circle>();
  const arrow = createRef<Line>();
  parent.add(<Node ref={root} position={from}>
    <Circle ref={ripple} size={0} stroke={GREEN} lineWidth={6} opacity={0} />
    <Line ref={arrow} closed fill={INK} stroke={BG} lineWidth={2} scale={scale} opacity={0}
      points={[[0, 0], [0, 44], [12, 34], [20, 52], [28, 48], [20, 31], [36, 31]]} />
  </Node>);
  return {
    *clickAt(to: [number, number], travel = 0.45): ThreadGenerator {
      arrow().opacity(1);
      yield* root().position(to, travel, easeOutCubic);
      yield* arrow().scale(scale * 0.86, 0.06);
      ripple().opacity(0.9);
      spawn(all(ripple().size(190, 0.42, easeOutCubic), ripple().opacity(0, 0.42)));
      yield* arrow().scale(scale, 0.1);
    },
    *hide(): ThreadGenerator {
      yield* arrow().opacity(0, 0.2);
    },
  };
}

/** p: kata ini diikuti tanda baca di naskah, jadi halaman subtitle berakhir di sini */
export interface Word { w: string; s: number; e: number; p?: boolean }

/** Subtitle per kata: halaman pendek yang pecah di jeda bicara, kata yang sedang diucapkan menyala hijau. */
export function captionPages(words: Word[], maxChars = 22) {
  const pages: Word[][] = [];
  let page: Word[] = [];
  words.forEach((word, i) => {
    const size = page.reduce((sum, item) => sum + item.w.length + 1, 0) + word.w.length;
    if (page.length && size > maxChars) {
      pages.push(page);
      page = [];
    }
    page.push(word);
    const next = words[i + 1];
    if (!next || word.p || next.s - word.e > 0.3) {
      pages.push(page);
      page = [];
    }
  });
  return pages;
}

export function captions(view: View2D, words: Word[], y: number, fontSize: number, duration: number) {
  const pages = captionPages(words);
  const box = createRef<Rect>();
  view.add(<Rect ref={box} layout direction="row" gap={fontSize * 0.28} justifyContent="center" alignItems="center" y={y}
    padding={[fontSize * 0.2, fontSize * 0.45]} radius={fontSize * 0.28} fill="#0a0f0dea" opacity={0} />);
  let shown = -1;
  spawn(function* () {
    while (useThread().time() < duration) {
      const now = useThread().time();
      const index = pages.findIndex((page, i) => {
        const end = pages[i + 1] ? Math.min(pages[i + 1][0].s, page[page.length - 1].e + 0.45) : page[page.length - 1].e + 0.45;
        return now >= page[0].s && now < end;
      });
      if (index !== shown) {
        shown = index;
        box().removeChildren();
        box().opacity(index >= 0 ? 1 : 0);
        if (index >= 0) {
          box().add(pages[index].map(word => (
            <Txt text={word.w} fontFamily={SANS} fontWeight={700} fontSize={fontSize} fill={INK} />
          )));
        }
      }
      if (index >= 0) {
        const page = pages[index];
        const age = Math.min(1, (now - page[0].s) / 0.12);
        box().scale(0.92 + 0.08 * easeOutCubic(age));
        box().children().forEach((node, i) => (node as Txt).fill(now >= page[i].s ? GREEN : INK));
      }
      yield;
    }
    box().removeChildren();
    box().opacity(0);
  });
}
