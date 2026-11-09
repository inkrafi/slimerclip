/**
 * Short animasi Klik Digital ID: kenapa potongan pajak gaji Desember lebih besar (skema TER, PMK 168/2023).
 * Contoh sederhana: gaji Rp10 juta, TK/0, tanpa tunjangan dan iuran. Tanpa video stok dan tanpa watermark.
 */
import {Circle, Line, Node, Rect, Txt, View2D} from '@revideo/2d';
import {all, createRef, easeInOutCubic, easeOutBack, easeOutCubic, spawn, ThreadGenerator, waitFor} from '@revideo/core';
import {backdrop, card, chip as baseChip, count, enterUp, exit, label, person, pop, stamp} from './qris';
import {captions, DARK_INK, DARK_MUTED, DEEP_GREEN, DEEP_RED, MONO, PAPER_CARD, PAPER_EDGE, SANS, until, Word} from './system';

const GOLD = '#E8A33A';
const NAVY = '#22324F';
const SOFT = '#E4DCC8';
const WHITE = '#FFFFFF';
/** Chip yang mulai tersembunyi, muncul lewat pop */
const chip = (text: string, fill: string, size?: number, ink?: string) => {
  const node = baseChip(text, fill, size, ink);
  node.scale(0);
  node.opacity(0);
  return node;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov'];

/* ---------- Ilustrasi ---------- */

function monthTile(name: string, value: string, width = 150, height = 116, fill = PAPER_CARD) {
  const root = new Rect({size: [width, height], radius: 18, fill, stroke: PAPER_EDGE, lineWidth: 4, scale: 0});
  root.add(<Txt y={-height * 0.2} text={name} fontFamily={SANS} fontWeight={700} fontSize={height * 0.26} fill={DARK_MUTED} />);
  const amount = new Txt({y: height * 0.18, text: value, fontFamily: MONO, fontWeight: 600, fontSize: height * 0.26, fill: DEEP_RED});
  root.add(amount);
  return {root, amount};
}

/** Baris buku besar: label di kiri, angka di kanan */
function ledgerRow(left: string, right: string, y: number, ink = DARK_INK, size = 46) {
  const root = new Node({y, opacity: 0});
  root.add(<Txt x={-390} offset={[-1, 0]} text={left} fontFamily={SANS} fontWeight={700} fontSize={size} fill={ink} />);
  root.add(<Txt x={390} offset={[1, 0]} text={right} fontFamily={MONO} fontWeight={600} fontSize={size} fill={ink} />);
  return root;
}

/** Diagram 12 batang potongan pajak per bulan */
function bars(values: number[], colors: string[], scale = 0.3) {
  const root = new Node({});
  const rects: Rect[] = [];
  const names = [...MONTHS, 'Des'];
  values.forEach((v, i) => {
    const x = -385 + i * 70;
    const r = new Rect({x, y: 200, offset: [0, 1], size: [52, 0], radius: [10, 10, 0, 0], fill: colors[i]});
    root.add(r);
    rects.push(r);
    root.add(<Txt x={x} y={240} text={names[i]} fontFamily={SANS} fontWeight={700} fontSize={26} fill={DARK_MUTED} />);
  });
  root.add(<Line points={[[-430, 200], [430, 200]]} stroke={DARK_INK} lineWidth={6} />);
  const grow = (seconds = 0.6) => all(...rects.map((r, i) => r.height(values[i] * scale, seconds, easeOutCubic)));
  return {root, rects, grow};
}

function magnifier() {
  const root = new Node({scale: 0});
  root.add(<Circle size={230} fill="#ffffff66" stroke={DARK_INK} lineWidth={16} />);
  root.add(<Line points={[[85, 85], [170, 170]]} stroke={DARK_INK} lineWidth={30} lineCap="round" />);
  return root;
}

function slip() {
  const root = card(780, 560);
  root.add(<Rect y={-220} size={[780, 120]} radius={[28, 28, 0, 0]} fill={NAVY} />);
  root.add(<Txt y={-220} text="SLIP GAJI" fontFamily={SANS} fontWeight={700} fontSize={52} fill={WHITE} letterSpacing={4} />);
  const rows: [string, string, string][] = [['Gaji', 'Rp10.000.000', DARK_INK], ['PPh 21 Desember', '-Rp800.000', DEEP_RED], ['Diterima', 'Rp9.200.000', DEEP_GREEN]];
  rows.forEach(([l, r, ink], i) => {
    root.add(<Txt x={-345} y={-80 + i * 110} offset={[-1, 0]} text={l} fontFamily={SANS} fontWeight={700} fontSize={38} fill={DARK_MUTED} />);
    root.add(<Txt x={345} y={-80 + i * 110} offset={[1, 0]} text={r} fontFamily={MONO} fontWeight={600} fontSize={40} fill={ink} />);
  });
  return root;
}

/* ---------- Thumbnail ----------
 * Satu fokus: kartu Desember dengan potongan merah besar di antara bulan-bulan kecil. Teks 3 kata, tidak mengulang judul.
 */
export function* pajakThumb(view: View2D): ThreadGenerator {
  backdrop(view, 1);
  const grid = new Node({y: -120});
  MONTHS.slice(6).forEach((m, i) => {
    const t = monthTile(m, '-200rb', 150, 116);
    t.root.position([-330 + i * 165, -40]);
    t.root.scale(1);
    t.root.opacity(0.55);
    grid.add(t.root);
  });
  const dec = monthTile('Des', '-800rb', 520, 300, PAPER_CARD);
  dec.root.position([0, 230]);
  dec.root.scale(1);
  dec.root.stroke(DEEP_RED);
  dec.root.lineWidth(10);
  grid.add(dec.root);
  view.add(grid);
  view.add(<Txt x={220} y={-10} text="?!" fontFamily={SANS} fontWeight={700} fontSize={170} fill={DEEP_RED} rotation={12} />);
  view.add(<Rect y={-560} layout padding={[16, 34]} radius={18} fill={DARK_INK}>{label('Gaji Rp10 juta', 64, WHITE)}</Rect>);
  view.add(<Txt y={420} text="Pajak Desember" fontFamily={SANS} fontWeight={700} fontSize={118} fill={DARK_INK} />);
  view.add(<Rect y={580} layout padding={[6, 40]} radius={24} fill={DEEP_RED} rotation={-2}>{label('KOK GEDE?', 150, WHITE)}</Rect>);
  yield* waitFor(0.2);
}

/* ---------- Video ---------- */
export function* pajak(view: View2D, job: Record<string, any>): ThreadGenerator {
  const c: Record<string, number> = job.cues;
  backdrop(view, job.duration);
  const stage = createRef<Node>();
  view.add(<Node ref={stage} y={0} scale={1.12} />);
  captions(view, job.words as Word[], 640, 58, job.duration);

  /* 1. Gaji 10 juta, tiap bulan dipotong 200 ribu, Desember 800 ribu */
  const salary = new Rect({y: -640, layout: true, padding: [16, 34], radius: 18, fill: DARK_INK, children: [label('Gaji Rp10.000.000', 60, WHITE)]});
  stage().add(salary);
  const example = chip('contoh sederhana', GOLD, 34, DARK_INK);
  example.position([0, -530]);
  stage().add(example);
  yield* all(enterUp(salary, 0.4), pop(example));
  yield* until(c.tiap - 0.15);
  const tiles = MONTHS.map((m, i) => {
    const t = monthTile(m, '-200rb', 134, 112);
    t.root.position([-375 + (i % 6) * 150, -380 + Math.floor(i / 6) * 128]);
    stage().add(t.root);
    return t.root;
  });
  yield* all(...tiles.map((t, i) => function* () {
    yield* waitFor(i * 0.07);
    yield* t.scale(1, 0.3, easeOutBack);
  }()));
  yield* until(c.desember - 0.15);
  const dec = monthTile('Des', '-200rb', 420, 250);
  dec.root.position([0, 20]);
  dec.root.stroke(DEEP_RED);
  dec.root.lineWidth(8);
  stage().add(dec.root);
  yield* pop(dec.root, 0.4);
  yield* until(c.delapan - 0.15);
  yield* count(dec.amount, 200000, 800000, 0.5, v => `-${Math.round(v / 1000)}rb`);
  spawn(function* () {
    for (let i = 0; i < 3; i++) yield* dec.root.rotation(4, 0.06).to(-4, 0.12).to(0, 0.06);
  });
  yield* until(c.kok - 0.15);
  const ask = new Txt({x: 270, y: -110, text: '?', fontFamily: SANS, fontWeight: 700, fontSize: 200, fill: DEEP_RED, scale: 0, rotation: 12});
  stage().add(ask);
  yield* pop(ask);

  /* 2. Januari sampai November pakai TER: kali persen dari gaji kotor */
  yield* until(c.sejak - 0.2);
  yield* all(exit(salary), exit(example), exit(dec.root), exit(ask), ...tiles.map(t => exit(t, 0.3)));
  const since = chip('Sejak 2024', NAVY, 52);
  since.position([0, -650]);
  stage().add(since);
  yield* pop(since);
  yield* until(c.januari - 0.15);
  const strip = new Node({y: -470});
  MONTHS.forEach((m, i) => {
    const t = new Rect({x: -407 + i * 74, size: [62, 62], radius: 12, fill: DEEP_GREEN, scale: 0});
    t.add(<Txt text={m.slice(0, 1)} fontFamily={SANS} fontWeight={700} fontSize={32} fill={WHITE} />);
    strip.add(t);
  });
  const dGray = new Rect({x: 407, size: [62, 62], radius: 12, fill: SOFT, scale: 0});
  dGray.add(<Txt text="D" fontFamily={SANS} fontWeight={700} fontSize={32} fill={DARK_MUTED} />);
  strip.add(dGray);
  stage().add(strip);
  yield* all(...strip.children().map((t, i) => function* () {
    yield* waitFor(i * 0.05);
    yield* t.scale(1, 0.25, easeOutBack);
  }()));
  yield* until(c.ter - 0.15);
  const ter = new Node({y: -230, scale: 0});
  ter.add(<Txt text="TER" fontFamily={SANS} fontWeight={700} fontSize={200} fill={DARK_INK} />);
  ter.add(<Txt y={125} text="tarif efektif rata-rata" fontFamily={MONO} fontWeight={600} fontSize={44} fill={DARK_MUTED} />);
  stage().add(ter);
  yield* pop(ter, 0.4);
  yield* until(c.kali - 0.2);
  const formula = card(900, 170);
  formula.position([0, 70]);
  formula.scale(0);
  formula.add(<Txt text="Rp10.000.000 × 2% = Rp200.000" fontFamily={MONO} fontWeight={600} fontSize={44} fill={DARK_INK} />);
  stage().add(formula);
  yield* pop(formula);

  /* 3. Desember dihitung ulang setahun penuh */
  yield* until(c.tapi - 0.2);
  yield* all(exit(since), exit(strip), exit(ter), exit(formula));
  const recalc = chip('Desember: hitung ulang setahun', DEEP_RED, 48);
  recalc.position([0, -700]);
  stage().add(recalc);
  yield* pop(recalc);
  const book = card(900, 800);
  book.position([0, -150]);
  book.opacity(0);
  stage().add(book);
  yield* book.opacity(1, 0.3);
  const rows = [
    ledgerRow('Gaji setahun', 'Rp120.000.000', -320),
    ledgerRow('− Biaya jabatan', 'Rp6.000.000', -220, DARK_MUTED),
    ledgerRow('− PTKP (lajang)', 'Rp54.000.000', -120, DARK_MUTED),
    ledgerRow('Kena pajak × 5%', 'Rp60.000.000', -10),
    ledgerRow('Pajak setahun', 'Rp3.000.000', 90, DARK_INK, 50),
    ledgerRow('− Dipotong Jan–Nov', 'Rp2.200.000', 190, DARK_MUTED),
  ];
  const sheet = new Node({position: [0, -150]});
  stage().add(sheet);
  rows.forEach(r => sheet.add(r));
  const rule = new Line({points: [[-390, 270], [390, 270]], stroke: DARK_INK, lineWidth: 5, end: 0});
  sheet.add(rule);
  const left = ledgerRow('Ditagih Desember', 'Rp800.000', 335, DEEP_RED, 50);
  sheet.add(left);
  yield* until(c.setahun - 0.15);
  yield* rows[0].opacity(1, 0.3);
  yield* until(c.progresif - 0.15);
  const prog = chip('tarif progresif 5% sampai 35%', NAVY, 38);
  prog.position([0, -590]);
  stage().add(prog);
  yield* pop(prog);
  yield* until(c.biaya - 0.15);
  yield* rows[1].opacity(1, 0.3);
  yield* until(c.ptkp - 0.15);
  yield* rows[2].opacity(1, 0.3);
  yield* rows[3].opacity(1, 0.3);
  yield* until(c.hasilnya - 0.2);
  yield* rows[4].opacity(1, 0.3);
  yield* until(c.sebelas - 0.2);
  yield* rows[5].opacity(1, 0.3);
  yield* until(c.sisanya - 0.1);
  yield* all(rule.end(1, 0.3), left.opacity(1, 0.3));
  yield* until(c.desember3 - 0.15);
  const mark = new Rect({position: [0, -150 + 335], size: [860, 90], radius: 20, stroke: DEEP_RED, lineWidth: 8, opacity: 0});
  stage().add(mark);
  yield* all(mark.opacity(1, 0.2), mark.scale(1.04, 0.15).to(1, 0.15));

  /* 4. Bukan pajak baru: total setahun sama, kekurangan menumpuk di akhir */
  yield* until(c.jadi - 0.2);
  yield* all(exit(recalc), exit(book), exit(sheet), exit(prog), exit(mark));
  const notNew = stamp('BUKAN PAJAK BARU', 64);
  notNew.position([0, -620]);
  stage().add(notNew);
  notNew.scale(1.5);
  yield* all(notNew.opacity(1, 0.12), notNew.scale(1, 0.22, easeOutCubic));
  yield* until(c.totalnya - 0.15);
  const chart = bars([...Array(11).fill(200), 800], [...Array(11).fill(DEEP_GREEN), DEEP_RED], 0.38);
  chart.root.position([0, -220]);
  stage().add(chart.root);
  yield* chart.grow(0.6);
  const total = chip('Total setahun tetap Rp3 juta', DARK_INK, 44);
  total.position([0, 140]);
  stage().add(total);
  yield* pop(total);
  yield* until(c.numpuk - 0.15);
  const pile = new Line({points: [[300, -330], [380, -260]], stroke: DEEP_RED, lineWidth: 12, endArrow: true, arrowSize: 30, lineCap: 'round', end: 0});
  stage().add(pile);
  const pileText = new Txt({x: 180, y: -360, text: 'numpuk di akhir', fontFamily: SANS, fontWeight: 700, fontSize: 40, fill: DEEP_RED, opacity: 0});
  stage().add(pileText);
  yield* all(pile.end(1, 0.3), pileText.opacity(1, 0.3), chart.rects[11].scale([1.15, 1], 0.15).to([1, 1], 0.15));

  /* 5. Kebalikannya: ada bonus, Desember bisa lebih kecil atau ada kelebihan dikembalikan */
  yield* until(c.kebalikannya - 0.2);
  yield* all(exit(notNew), exit(chart.root), exit(total), exit(pile), exit(pileText));
  const flip = chip('Kebalikannya juga bisa', NAVY, 50);
  flip.position([0, -650]);
  stage().add(flip);
  yield* pop(flip);
  const illus = new Txt({y: -560, text: 'ilustrasi', fontFamily: MONO, fontWeight: 600, fontSize: 32, fill: DARK_MUTED, opacity: 0});
  stage().add(illus);
  yield* until(c.bonus - 0.15);
  const values = [200, 200, 620, 200, 200, 200, 200, 200, 200, 200, 200, 60];
  const colors = values.map((v, i) => (i === 2 ? GOLD : i === 11 ? DEEP_GREEN : DEEP_GREEN));
  const chart2 = bars(values, colors, 0.38);
  chart2.root.position([0, -220]);
  stage().add(chart2.root);
  const bonusTag = new Txt({x: -245, y: -280 - 620 * 0.38 + 200, text: 'bonus', fontFamily: SANS, fontWeight: 700, fontSize: 38, fill: GOLD, opacity: 0});
  stage().add(bonusTag);
  yield* all(chart2.grow(0.6), illus.opacity(1, 0.3), bonusTag.opacity(1, 0.4));
  yield* until(c.kecil - 0.15);
  const small = new Txt({x: 385, y: -110, text: 'kecil', fontFamily: SANS, fontWeight: 700, fontSize: 38, fill: DEEP_GREEN, opacity: 0});
  stage().add(small);
  yield* small.opacity(1, 0.3);
  yield* until(c.dikembalikan - 0.25);
  const worker = person(GOLD, 0.55);
  worker.position([300, 230]);
  worker.scale(0);
  stage().add(worker);
  const refund = chip('kelebihan dikembalikan', DEEP_GREEN, 40);
  refund.position([-150, 220]);
  stage().add(refund);
  yield* all(worker.scale(1, 0.35, easeOutBack), pop(refund));
  yield* refund.position([30, 220], 0.4, easeInOutCubic);

  /* 6. Cek slip gaji Desember */
  yield* until(c.cek - 0.2);
  yield* all(exit(flip), exit(illus), exit(chart2.root), exit(bonusTag), exit(small), exit(worker), exit(refund));
  const paper = slip();
  paper.position([0, -260]);
  paper.scale(0);
  stage().add(paper);
  yield* pop(paper, 0.4);
  const glass = magnifier();
  glass.position([290, -230]);
  stage().add(glass);
  yield* glass.scale(1, 0.35, easeOutBack);
  spawn(glass.position([250, -245], 0.8, easeInOutCubic).to([300, -220], 0.8, easeInOutCubic));
  const cta = chip('Cek slip Desember lu', DEEP_RED, 54);
  cta.position([0, 160]);
  stage().add(cta);
  yield* pop(cta);
  yield* until(job.duration);
  yield* waitFor(0);
}

