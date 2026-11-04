import {useThread, ThreadGenerator, waitFor} from '@revideo/core';

export const INK = '#f4f1ff';
export const MUTED = '#cfcbe6';
export const LINE = '#ffffff55';
export const PANEL = '#14122ed9';
export const ACCENT = '#ff5fa2';
export const COOL = '#6cc8ff';
export const DISPLAY = 'Instrument Serif';
export const BOLD = 'Poppins ExtraBold';
export const SANS = 'Poppins SemiBold';

const FONTS: [string, string, string][] = [
  [DISPLAY, '/fonts/InstrumentSerif-Italic.ttf', 'italic'],
  [BOLD, '/fonts/Poppins-ExtraBold.ttf', 'normal'],
  [SANS, '/fonts/Poppins-SemiBold.ttf', 'normal'],
];

/** Font bawaan proyek harus selesai dimuat sebelum frame pertama, supaya hasil sama di komputer dan server. */
export async function loadFonts() {
  await Promise.all(FONTS.map(async ([family, url, style]) => {
    const face = new FontFace(family, `url(${url})`, {style});
    await face.load();
    document.fonts.add(face);
  }));
}

export interface Timing {
  /** Pengali durasi animasi: < 1 lebih cepat untuk adegan pendek */
  pace: number;
  /** Tahan sampai sisa adegan, sisakan waktu untuk memudar */
  hold: () => ThreadGenerator;
}

/** Animasi menyesuaikan panjang narasi: adegan pendek dipercepat, sisanya ditahan sampai narasi selesai. */
export function timing(seconds: number, base: number, fadeOut = 0.35): Timing {
  const room = Math.max(0.5, seconds - fadeOut);
  const pace = Math.min(1.25, Math.max(0.4, room / base));
  return {
    pace,
    hold: function* () {
      const left = room - useThread().time();
      if (left > 0) yield* waitFor(left);
    },
  };
}
