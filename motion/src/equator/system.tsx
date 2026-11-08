/** Sistem visual The Equator Ledger: palet, font, dan logo. */
import {Circle, Line, Node, NodeProps, Rect} from '@revideo/2d';
import {createSignal} from '@revideo/core';

export const NAVY = '#0F1B2D';
export const LAND = '#1E2F47';
export const EDGE = '#0F1B2D';
export const PAPER = '#F3EDE2';
export const SAFFRON = '#E8A33D';
export const TEAL = '#1F7A72';
export const CORAL = '#D9553B';
export const SLATE = '#8A94A6';
export const INK = '#F3EDE2';
export const DARK = '#0F1B2D';
export const TITLE = 'Bricolage Grotesque';
export const BODY = 'Inter';
export const MONO = 'IBM Plex Mono';
export const MAP_W = 1920;
export const MAP_H = 960;

const FONTS: [string, string, string][] = [
  [TITLE, '/equator/fonts/bricolage-grotesque-latin-700-normal.woff2', '700'],
  [TITLE, '/equator/fonts/bricolage-grotesque-latin-800-normal.woff2', '800'],
  [BODY, '/equator/fonts/inter-latin-500-normal.woff2', '500'],
  [BODY, '/equator/fonts/inter-latin-600-normal.woff2', '600'],
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

/** Globe dengan garis khatulistiwa yang berbelok naik menjadi panah. Geometrinya sama dengan icon.svg. */
export function logo(parent: Node, size: number, line = createSignal(1)) {
  const unit = size / 200;
  parent.add(<Circle size={size} fill={NAVY} />);
  parent.add(<Circle size={[85 * unit, size * 0.93]} stroke="#2C4060" lineWidth={3.5 * unit} />);
  parent.add(<Rect size={[3.5 * unit, size * 0.93]} fill="#2C4060" />);
  parent.add(<Circle size={size * 0.965} stroke="#2C4060" lineWidth={3.5 * unit} />);
  parent.add(<Line
    points={[[-95 * unit, 28 * unit], [18 * unit, 28 * unit], [78 * unit, -54 * unit]]}
    stroke={SAFFRON} lineWidth={15 * unit} lineCap="butt" lineJoin="round" endArrow arrowSize={30 * unit}
    end={line}
  />);
}

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
export const mixColor = (a: string, b: string, t: number) =>
  `rgb(${[0, 1, 2].map(i => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t)).join(',')})`;
export const project = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];

/** Negara digambar langsung sebagai Path2D, jadi tetap tajam saat kamera mendekat. */
export class Geo extends Node {
  private shape: Path2D;
  private paint: () => string;
  private zoomLevel: () => number;

  public constructor(data: string, paint: () => string, zoomLevel: () => number, props: NodeProps = {}) {
    super(props);
    this.shape = new Path2D(data);
    this.paint = paint;
    this.zoomLevel = zoomLevel;
  }

  protected override async draw(context: CanvasRenderingContext2D) {
    context.fillStyle = this.paint();
    context.fill(this.shape);
    context.strokeStyle = EDGE;
    context.lineWidth = 1.3 / this.zoomLevel();
    context.lineJoin = 'round';
    context.stroke(this.shape);
    await this.drawChildren(context);
  }
}
