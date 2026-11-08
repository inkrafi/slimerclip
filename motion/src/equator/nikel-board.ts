/** Storyboard video nikel. `at` adalah frasa narasi yang memicu adegan; waktunya dicari dari kata.json. */
const USGS = 'Source: USGS Mineral Commodity Summaries';
const SULAWESI: [number, number] = [121.8, -2.6];
const CHINA_COAST: [number, number] = [113, 26];
const WORLD = {lon: 20, lat: 18, zoom: 1};
const SEA = {lon: 112, lat: 12, zoom: 3.45};
const ASIA_EAST = {lon: 120, lat: 8, zoom: 3.1};
const INDONESIA = {lon: 118, lat: -3, zoom: 5.6};
const SULAWESI_CLOSE = {lon: 124, lat: -2, zoom: 10.5};
/** Isi buku besar. Baris sebelumnya sudah tertulis; baris yang diberi `at` ditulis saat narasi menyebutnya. */
const ENTRIES = [
  {side: 'paid', text: 'About 60% of output'},
  {side: 'gain', text: 'Factories and exports'},
  {side: 'paid', text: 'Lost at the WTO'},
  {side: 'gain', text: 'Kept the ban'},
  {side: 'paid', text: 'Ownership and technology'},
  {side: 'paid', text: 'Coal, waste, and safety'},
];
/**
 * Adegan buku besar: halaman dibuka dengan baris lama, lalu tiap baris baru tampil sebagai potongan
 * tanpa transisi tepat saat disebut. Cap ditempel lewat potongan terakhir.
 */
const ledgerBeats = (opening: any, count: number, cues: string[], page: string, stamp?: {text: string; at: string; x?: number; y?: number}) => {
  const before = count - cues.length;
  const rows = (n: number, freshFrom = n) => ENTRIES.slice(0, n).map((entry, i) => (i >= freshFrom ? {...entry, fresh: true} : entry));
  const beats: any[] = [{...opening, show: {kind: 'ledger', page, entries: rows(before)}}];
  cues.forEach((cue, i) => beats.push({at: cue, trans: 'cut', sfx: ['lib_tx_pop_1'], show: {kind: 'ledger', page, settled: true, entries: rows(before + i + 1, before + i)}}));
  if (stamp) beats.push({at: stamp.at, trans: 'cut', sfx: ['lib_impact'], show: {kind: 'ledger', page, settled: true, entries: rows(count), stamp}});
  return beats;
};

export const CHAPTERS: {card?: string; number?: number; beats: any[]}[] = [
  { // Cold open
    beats: [
      {at: 'In 2013', src: `${USGS} 2014 (2013 estimate)`, map: {...SEA, hi: {IDN: 'teal'}, dim: 0.35},
        show: {kind: 'stat', value: 440000, suffix: ' t', label: "Indonesia's nickel output, 2013", note: 'Tied for first in the world'}},
      {at: 'Then it banned', src: `${USGS} 2014, 2016`, map: {dim: 0.78},
        show: {kind: 'chart', title: 'Nickel mined in Indonesia (thousand tons)', points: [[2013, 440], [2014, 177]], color: 'coral', yMax: 500, marks: [{x: 2014, label: '-60%', at: 'output fell'}]}},
      {at: 'It looked like', show: {kind: 'headline', lines: ['Economic self-harm?'], accent: 0}, map: {dim: 0.82}},
      {at: 'Today, two', src: `${USGS} 2026 (2025 estimate)`, map: {...WORLD, dim: 0.45, hi: {IDN: 'teal'}},
        show: {kind: 'ingots', filled: 2, total: 3, label: '2 of every 3 tons', note: 'of the nickel mined in 2025 came from Indonesia'}},
      {at: 'But most', src: 'Source: CREA, 2026', map: {dim: 0.82}, show: {kind: 'headline', lines: ['Most of it never goes', 'near an electric car'], accent: 1}},
      {at: 'So who', src: '', show: {kind: 'headline', lines: ['So who', 'actually', 'won?'], accent: 2, size: 170}},
      {at: 'To find out', src: '', map: {dim: 0.9}, trans: 'wipe', show: {kind: 'ledger', page: 'NICKEL', entries: []}},
    ],
  },
  { // The Crash
    number: 1, card: 'The Crash',
    beats: [
      {at: 'To see', src: '', map: {...WORLD, dim: 0.5, hi: {}}, show: {kind: 'caption', kicker: 'CHAPTER 01', text: 'The Crash', center: true}},
      {at: 'Indonesia sits', map: {...INDONESIA, dim: 0, hi: {IDN: 'teal'}}, show: {kind: 'labels', items: [{lon: 121.5, lat: -2, text: 'Sulawesi'}, {lon: 127.9, lat: 0.6, text: 'Halmahera', at: 'Halmahera'}]}},
      {at: 'Dig up', map: {dim: 0.92}, sfx: ['lib_tx_mechanism', 'lib_tx_gear_1'], show: {kind: 'mine', kicker: 'THE OLD MODEL', text: 'Dig up the ore'}},
      {at: 'load it', sfx: ['lib_wh_water_drop', 'lib_wind'], show: {kind: 'ship', kicker: 'THE OLD MODEL', text: 'Ship it to China'}},
      {at: 'Chinese plants', sfx: ['lib_tx_gear_2'], show: {kind: 'furnace', kicker: 'IN CHINA', text: 'Nickel pig iron, a cheap stainless steel ingredient'}},
      {at: 'And stainless', src: `${USGS} 2016`, sfx: ['lib_sparkle'], show: {kind: 'goods', kicker: "NICKEL'S BIGGEST USE", text: 'Stainless steel', items: [{draw: 'pot', label: 'Cookware'}, {draw: 'sink', label: 'Sinks'}, {draw: 'building', label: 'Buildings'}]}},
      {at: 'So Indonesia sold', src: '', map: {dim: 0.82}, sfx: ['lib_ka_ching'], show: {kind: 'headline', lines: ['Indonesia sold the dirt.'], accent: 0}},
      {at: 'In January 2014', src: `${USGS} 2016`, map: {...ASIA_EAST, dim: 0},
        show: {kind: 'flow', flows: [{from: SULAWESI, to: CHINA_COAST, tone: 'coral'}], stamp: {text: 'BANNED', lon: 116.5, lat: 9, at: 'It banned', sfx: 'lib_impact'}, caption: {kicker: 'JANUARY 2014', text: 'Unprocessed nickel ore exports'}}},
      {at: 'If you wanted', map: {...INDONESIA}, show: {kind: 'pin', lon: 121.8, lat: -2.6, text: 'Process it here'}},
      {at: "The market's first", src: `${USGS} 2014, 2016`, map: {dim: 0.8},
        show: {kind: 'chart', title: 'Nickel mined in Indonesia (thousand tons)', points: [[2012, 228], [2013, 440], [2014, 177], [2015, 170]], color: 'coral', yMax: 500, marks: [{x: 2013, label: '440', at: 'four hundred'}, {x: 2014, label: '177', at: 'In 2014'}, {x: 2015, label: '170', at: 'In 2015'}]}},
      {at: 'Buyers did', src: `${USGS} 2016`, map: {...ASIA_EAST, dim: 0, hi: {IDN: 'teal', PHL: 'warm', CHN: 'warm'}},
        show: {kind: 'flow', flows: [{from: [121.5, 13], to: CHINA_COAST}], caption: {kicker: '2015', text: "The Philippines becomes the top ore exporter"}}},
      {at: 'And Indonesia blinked', src: 'Source: Lowy Institute, 2025', map: {dim: 0.82}, show: {kind: 'timeline', items: [{year: '2014', text: 'Ban'}, {year: '2017', text: 'Partly relaxed', at: 'In 2017'}]}},
      ...ledgerBeats({at: 'Here is our', src: '', trans: 'wipe', sfx: ['lib_shutter']}, 1, ['about sixty percent'], 'ENTRY 1'),
      {at: 'Close the book', show: {kind: 'headline', lines: ['A textbook warning', 'about resource nationalism'], size: 92}},
      {at: 'A developing', show: {kind: 'steps', items: [{text: 'Overplays its hand'}, {text: 'Loses its customers', at: 'loses'}, {text: 'Backs down', at: 'backs'}]}},
      {at: 'But something', show: {kind: 'headline', lines: ['But something else', 'had started'], accent: 1}},
    ],
  },
  { // Build Here
    number: 2, card: 'Build Here',
    beats: [
      {at: 'Right after', src: `${USGS} 2016`, map: {...INDONESIA, dim: 0, hi: {IDN: 'teal'}},
        show: {kind: 'icons', sites: [[127.9, 0.6], [110.5, -7], [122, -2.8]], labels: ['Halmahera', 'Java', 'Sulawesi'], caption: {kicker: 'AFTER 2014', text: 'Chinese firms file plans for nickel plants'}}},
      {at: 'Indonesia made', src: 'Source: Lowy Institute, 2025', map: {dim: 0.82}, show: {kind: 'steps', title: 'The offer', items: [{text: 'Tax holidays', at: 'tax holidays'}, {text: 'Tax allowances', at: 'tax allowances'}, {text: 'Import duty exemptions', at: 'import duty'}]}},
      {at: 'The message', src: '', map: {...SEA, dim: 0},
        show: {kind: 'flow', flows: [{from: [72, 24], to: SULAWESI}, {from: [139, 36], to: SULAWESI}, {from: [88, 8], to: SULAWESI}], pin: {lon: 121.8, lat: -2.6, text: 'Build here', at: 'If you want'}}},
      {at: 'They came', src: 'Source: Pacific Forum, 2024', map: {dim: 0.92}, sfx: ['lib_tx_mechanism', 'lib_tx_gear_3'], show: {kind: 'crane', count: 43, countLabel: 'smelters by mid-2023'}},
      {at: 'In Central', src: 'Source: Financial Times, 2024', map: {...SULAWESI_CLOSE, dim: 0}, show: {kind: 'pin', lon: 122, lat: -2.8, text: 'Morowali', note: "World's largest nickel processing site"}},
      {at: 'So at the start', src: 'Source: Lowy Institute, 2025', map: {dim: 0.82}, show: {kind: 'timeline', items: [{year: '2014', text: 'Ban'}, {year: '2017', text: 'Partly relaxed'}, {year: '2020', text: 'Ban returns', at: 'brought'}]}},
      {at: 'This time', src: '', show: {kind: 'headline', lines: ['This time, it held.'], accent: 0}},
      {at: 'Mine output', src: `${USGS} 2026 (2025 estimate)`, map: {...WORLD, dim: 0.5, hi: {IDN: 'teal'}}, show: {kind: 'stat', value: 2600000, suffix: ' t', label: 'Indonesia, 2025', note: 'out of 3.9 million tons worldwide', at: 'out of'}},
      {at: 'That is roughly', src: `${USGS} 2016, 2026`, map: {dim: 0.82}, show: {kind: 'bars', title: 'Nickel mined in Indonesia (tons)', items: [{label: '2015', value: 170000, text: '170,000', tone: 'slate'}, {label: '2025', value: 2600000, text: '2,600,000', tone: 'saffron'}]}},
      {at: "Indonesia's own", src: 'Source: ESDM data, via Kontan, 2026', show: {kind: 'bars', title: 'Downstream nickel exports', items: [{label: '2017-19', value: 3.3, text: 'about $3.3 billion', tone: 'slate'}, {label: '2024', value: 33.9, text: '$33.9 billion', tone: 'saffron', at: 'thirty-three'}]}},
      {at: 'The country also', src: `${USGS} 2026`, map: {...WORLD, dim: 0.55}, show: {kind: 'stat', value: 44, suffix: '%', label: "of the world's known reserves", note: '62 million tons'}},
      ...ledgerBeats({at: 'So the second', src: '', map: {dim: 0.9}, trans: 'wipe', sfx: ['lib_ka_ching']}, 2, ['Indonesia gained'], 'ENTRY 2'),
      {at: 'Which is', map: {dim: 0.82}, show: {kind: 'headline', lines: ['Then someone', 'tried to stop it'], accent: 1}},
    ],
  },
  { // Lose in Court
    number: 3, card: 'Lose in Court, Keep the Ban',
    beats: [
      {at: 'In November 2019', src: 'Source: WTO dispute DS592', map: {dim: 0.82},
        show: {kind: 'doc', kicker: 'SUMMARY · WTO DISPUTE DS592', title: 'EU v. Indonesia', rows: [{label: 'Nov 2019', text: 'The EU challenges the export ban'}]}},
      {at: 'Three years', trans: 'wipe', show: {kind: 'gavel', text: 'The panel rules against Indonesia', at: 'On November', sfx: 'lib_hit_2'}},
      {at: 'On paper', show: {kind: 'headline', lines: ['On paper,', 'Indonesia lost.'], accent: 1}},
      {at: 'Eight days', src: 'Source: WTO dispute DS592', show: {kind: 'timeline', items: [{year: 'Nov 30', text: 'Ruling'}, {year: 'Dec 8', text: 'Appeal'}]}},
      {at: 'And here', src: 'Source: The Diplomat, 2022', show: {kind: 'chairs', text: 'The appeals body had stopped working', note: 'The US had blocked new judges', at: 'after the United'}},
      {at: 'So Indonesia appealed', show: {kind: 'headline', lines: ['An appeal with', 'no one to hear it'], accent: 1, size: 110}},
      {at: 'The ban stayed', src: 'Source: BISI, 2026', show: {kind: 'headline', lines: ['Lost the case.', 'Kept the ban.'], accent: 1}},
      ...ledgerBeats({at: 'Third entry', src: '', map: {dim: 0.9}, trans: 'wipe', sfx: ['lib_shutter']}, 4, ['Lost at', 'Kept the ban'], 'ENTRY 3'),
      {at: 'Before we', map: {dim: 0.82}, show: {kind: 'headline', lines: ['Who does this', 'really favor?'], accent: 1, size: 120}},
      {at: 'It looks like', src: '', map: {...INDONESIA, dim: 0.6, hi: {IDN: 'teal'}}, show: {kind: 'headline', lines: ['Indonesia?'], accent: 0}},
      {at: 'But look', show: {kind: 'headline', lines: ['Who owns what?'], accent: 0}},
    ],
  },
  { // Whose Factories
    number: 4, card: 'Whose Factories?',
    beats: [
      {at: "Morowali's giant", src: 'Sources: Financial Times, 2024; Pacific Forum, 2024', map: {...SULAWESI_CLOSE, dim: 0.78},
        show: {kind: 'ring', value: 66, title: 'Morowali industrial park: effective ownership', legend: [{text: 'Tsingshan, about 66%', tone: 'saffron'}, {text: 'Indonesian partner, about 34%', tone: 'slate', at: 'with an Indonesian'}]}},
      {at: 'That is not', src: 'Source: Lowy Institute, 2025', show: {kind: 'quote', text: 'increased reliance on Chinese investment, technology, and demand', by: 'Lowy Institute'}},
      {at: 'The newer', src: 'Source: Lowy Institute, 2025', show: {kind: 'caption', kicker: 'HIGH PRESSURE ACID LEACHING', text: 'A process developed by Chinese firms', center: true}},
      {at: 'To be fair', src: '', show: {kind: 'versus', left: {title: 'Indonesia', items: ['The ore'], tone: 'teal'}, right: {title: 'Partners', items: ['Capital', 'Know-how'], tone: 'saffron', at: 'needed'}}},
      {at: 'The park employs', src: 'Source: SCMP, via BHRC, Feb 2023', show: {kind: 'workers', count: 70758, label: 'Indonesian workers at the park, February 2023'}},
      {at: 'But exports', src: '', show: {kind: 'headline', lines: ['Exports up', 'is not the same as rich'], accent: 1, size: 100}},
      {at: 'Remember those', src: 'Source: Lowy Institute, 2025', show: {kind: 'headline', lines: ['Tax holidays', 'have a cost'], accent: 1}},
      {at: "Lowy's assessment", show: {kind: 'quote', text: 'has not translated into significant local job creation, poverty reduction, or government revenues', by: 'Lowy Institute'}},
      {at: 'It describes', show: {kind: 'quote', text: 'The benefit to public revenue from nickel processing is also not clear', by: 'Lowy Institute'}},
      {at: 'The Indonesian government', src: 'Sources: ESDM data, via Kontan; Lowy Institute', show: {kind: 'versus', left: {title: 'Government', items: ['$33 billion in exports'], tone: 'teal'}, right: {title: 'Lowy', items: ['How much stays?'], tone: 'saffron', at: 'Lowy would'}}},
      ...ledgerBeats({at: 'So the fourth', src: '', trans: 'wipe', sfx: ['lib_shutter']}, 5, ['Much of'], 'ENTRY 4'),
    ],
  },
  { // The Bill
    number: 5, card: 'The Bill',
    beats: [
      {at: 'This industry', src: '', show: {kind: 'headline', lines: ['Sold as green'], accent: 0}},
      {at: 'Smelters run', map: {dim: 0.92}, sfx: ['lib_wind', 'lib_tx_gear_1'], show: {kind: 'coal', kicker: 'POWER', text: 'Many make their own electricity on site'}},
      {at: 'The Centre', src: 'Source: CREA, 2026', map: {dim: 0.8}, show: {kind: 'stat', value: 31, suffix: ' GW', label: 'boom in captive coal power', note: 'Coal, built to serve the industry'}},
      {at: 'That is coal', src: '', show: {kind: 'headline', lines: ['Coal, for a metal', 'sold as the future'], accent: 1, size: 110}},
      {at: 'Then there is', map: {dim: 0.92}, sfx: ['lib_wh_water_drop', 'lib_bubble'], show: {kind: 'tailings', kicker: 'WASTE', text: 'Tailings, the leftovers from processing'}},
      {at: 'Lowy warns', src: 'Source: Lowy Institute, 2025', show: {kind: 'quote', text: 'tailings that leech into the environment and harm agriculture and fisheries', by: 'Lowy Institute'}},
      {at: 'And there is', src: 'Source: Financial Times, 2024', sfx: ['lib_tx_alarm'], show: {kind: 'safety', title: 'The human side', items: [{text: 'Workers raise safety concerns', at: 'Workers'}, {text: 'Unions back them', at: 'unions'}, {text: 'One park says it follows the law', at: 'One major'}]}},
      {at: 'None of this', src: '', show: {kind: 'headline', lines: ['Not every company', 'is the same'], size: 110}},
      {at: 'But it does', show: {kind: 'headline', lines: ['This boom', 'came with a bill'], accent: 1}},
      ...ledgerBeats({at: 'Fifth entry', trans: 'wipe', sfx: ['lib_shutter']}, 6, ['coal, waste'], 'ENTRY 5'),
      {at: 'Still', show: {kind: 'headline', lines: ['At least it powers', 'the EV revolution?'], accent: 1, size: 110}},
      {at: 'Mostly', trans: 'zoom', sfx: ['lib_dun_dun'], show: {kind: 'headline', lines: ['Mostly, it does not.'], accent: 0}},
    ],
  },
  { // The Twist
    number: 6, card: 'The Twist',
    beats: [
      {at: 'According to', src: 'Source: CREA, 2026', map: {dim: 0.82}, sfx: ['lib_riser'], show: {kind: 'waffle', title: "Where Indonesia's nickel went, 2025", first: 83, firstLabel: 'Stainless steel', secondLabel: 'EV battery supply chain', firstAt: {at: 'eighty-three'}, secondAt: {at: 'Only seventeen'}}},
      {at: 'Think about', src: '', show: {kind: 'goods', kicker: 'WHERE MOST OF IT ENDS UP', text: 'Ordinary steel goods', items: [{draw: 'sink', label: 'Kitchen sinks', at: 'kitchen'}, {draw: 'gear', label: 'Machinery', at: 'machinery'}, {draw: 'building', label: 'Building materials', at: 'building'}]}},
      {at: 'Now look', sfx: ['lib_zoom_in'], show: {kind: 'car', kicker: "INDONESIA'S NEXT BET", text: 'Batteries'}},
      {at: 'The International', src: 'Source: IEA Global EV Outlook 2026', show: {kind: 'bars', title: 'EV batteries deployed worldwide, 2025', items: [{label: 'LFP', value: 55, text: 'over 55%', tone: 'saffron'}, {label: 'All others', value: 45, text: 'under 45%', tone: 'slate'}]}},
      {at: 'And LFP', src: 'Source: IEA Global EV Outlook 2026', sfx: ['lib_wrong'], show: {kind: 'cells'}},
      {at: 'Those batteries', src: 'Sources: CREA, 2026; IEA, 2026', show: {kind: 'versus', left: {title: 'China', items: ['LFP: over 80%'], tone: 'saffron'}, right: {title: 'European Union', items: ['LFP: more than 10%'], tone: 'teal', at: 'In Europe'}}},
      {at: 'But the global', src: '', show: {kind: 'headline', lines: ['A trend Indonesia', 'did not choose'], accent: 1, size: 110}},
      {at: 'Even within', src: 'Source: Kontan, Nov 2026', show: {kind: 'stat', text: '50-60%', label: 'of downstream output is still semi-finished', note: 'Energy minister Bahlil Lahadalia', at: 'fifty'}},
      {at: 'Other countries', src: '', map: {...SEA, dim: 0, hi: {IDN: 'teal'}}, show: {kind: 'flow', flows: [{from: SULAWESI, to: [139, 36]}, {from: SULAWESI, to: CHINA_COAST}], caption: {kicker: 'THE MOST VALUABLE WORK', text: 'Still done elsewhere'}}},
      {at: 'That is the very', map: {dim: 0.82}, show: {kind: 'headline', lines: ['The same pattern,', 'one step up the chain'], accent: 1, size: 100}},
      ...ledgerBeats({at: 'So the sixth', trans: 'wipe', map: {dim: 0.9}, sfx: ['lib_dun_dun']}, 6, [], 'ENTRY 6', {text: 'STILL OPEN', x: 0, y: 330, at: 'stays open'}),
    ],
  },
  { // Who Won
    number: 7, card: 'So Who Actually Won?',
    beats: [
      {at: 'Today, Indonesia', src: '', map: {dim: 0.82}, show: {kind: 'headline', lines: ['Too much of', 'a good thing'], accent: 1}},
      {at: 'A research brief', src: 'Source: DPR RI research brief, Nov 2025', map: {dim: 0.92}, sfx: ['lib_slide_down'], show: {kind: 'stockpile', price: 'Up to -40%', label: 'global nickel prices over several years', kicker: "INDONESIA'S PARLIAMENT", text: 'Warns of too much supply'}},
      {at: 'Some large', map: {...SULAWESI_CLOSE, dim: 0, hi: {IDN: 'teal'}}, show: {kind: 'caption', kicker: 'SULAWESI', text: 'Some large smelters suspend operations'}},
      {at: 'So the same', src: 'Sources: DPR RI; Argus; CNBC Indonesia', map: {dim: 0.82},
        show: {kind: 'timeline', title: 'Now hitting the brakes', items: [{year: '2025', text: 'Permits restricted', at: 'It restricted'}, {year: '2026', text: 'Quota cut by a third', at: 'It cut'}, {year: 'Nov 2026', text: 'Moratorium study', at: 'And in November'}]}},
      ...ledgerBeats({at: "So let's", src: '', trans: 'wipe', sfx: ['lib_riser']}, 6, [], 'THE TOTAL'),
      {at: 'Who actually', show: {kind: 'headline', lines: ['So who', 'actually', 'won?'], accent: 2, size: 170}},
      {at: 'First, Indonesia', map: {...WORLD, dim: 0.72, hi: {IDN: 'teal'}}, show: {kind: 'verdict', who: 'Indonesia', what: 'Won leverage', note: 'Rewrote the terms, and held on even after losing at the WTO'}},
      {at: 'Chinese companies', map: {dim: 0.82}, show: {kind: 'verdict', icon: 'factory', who: 'Chinese companies', what: 'Won much of the factory floor', note: 'Along with a secure supply of the metal'}},
      {at: 'Workers won', show: {kind: 'verdict', icon: 'helmet', who: 'Workers', what: 'Won jobs', note: 'And carried real risks'}},
      {at: 'Nearby', show: {kind: 'verdict', icon: 'smoke', who: 'Nearby communities', what: 'Got the boom', note: 'Along with the coal and the waste'}},
      {at: 'And the bigger', show: {kind: 'verdict', icon: 'battery', who: 'The battery industry', what: 'Still up for grabs', note: 'The bigger goal'}},
      {at: 'So here', show: {kind: 'headline', lines: ['Force the factories to come?', 'Done.'], accent: 1, size: 88}},
      {at: 'Can it', show: {kind: 'headline', lines: ['Can it force', 'the value to stay?'], accent: 1, size: 120}},
      {at: 'Other countries', map: {...WORLD, dim: 0.5}, show: {kind: 'caption', kicker: 'EVERY RESOURCE-RICH COUNTRY', text: 'Is asking the same thing', center: true}},
      {at: 'If you led', map: {dim: 0.85}, show: {kind: 'headline', lines: ['Would you', 'copy this?'], accent: 1, size: 150}},
    ],
  },
];
