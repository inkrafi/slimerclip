import type { MotionBrief, MotionPackage } from '@/lib/types'

/**
 * Prompt video peluncuran dari brief klien, mengikuti panduan dan skill launch-motion.
 * Isian kosong tetap berupa [tanda kurung], dan prompt meminta Claude bertanya, bukan mengarang.
 */

/** Panjang video mengikuti paket di daftar harga */
const PACKAGE_SECONDS: Record<MotionPackage, number> = { teaser: 30, launch: 45, kit: 60, custom: 30 }

export const emptyBrief = (pkg: MotionPackage): MotionBrief => ({
  what_it_is: '', audience: '', goal: '', message: '', hook: '', problem: '', feature: '', payoff: '', tagline: '', cta: '',
  tone: 'Confident, clean, fast. Premium SaaS launch, not cartoonish. No voiceover, music + SFX only.',
  language: 'English', seconds: PACKAGE_SECONDS[pkg], cut_vertical: true, cut_square: true,
  ui_source: 'none', colors: '', fonts: '', has_logo: false, has_backgrounds: false,
  counter: '', glow: 'red', cards: '', cursor_tabs: false, payoff_view: '', revision: '',
})

export interface MotionPrompt {
  id: string
  stage: 'bahan' | 'build' | 'fix' | 'polish' | 'revisi'
  title: string
  about: string
  text: string
}

const STORYBOARD_EXAMPLE = `[PRODUCT] launch video — storyboard

30.0 s · 1920 × 1080 · 60 fps · 1800 frames

Scene 1 · Pile-up (hook) — 0:00–0:04, frames 0–240
On screen: dark background. Task cards ("Update CRM", "Export leads", "Weekly report", "Sync invoices", "Chase approvals"…) drop in and stack into a pile. Counter top-right: "Open tasks 0 → 200". Kinetic headline: "200 tasks. Before lunch."
Motion: cards drop with overshoot, staggered. Counter counts up over ~1 s. Headline word by word.
Camera: slow push-in 100% → 106%.

Scene 2 · Copy-paste grind (problem) — 0:04–0:11, frames 240–660
On screen: three app windows: CRM, spreadsheet, inbox. Cursor copies a row in the spreadsheet, arcs over and pastes it into the CRM, hesitates, moves on to the inbox. Text: "Copy. Paste. Repeat."
Motion: cursor on arcs, click presses, highlighted rows.
Camera: easy-ease pan left → right, following the cursor.

Scene 3 · Agents kick in (fix) — 0:11–0:19, frames 660–1140
On screen: [PRODUCT] dashboard (Figma SVG). Cursor types "Hand off today's busywork" into the prompt bar and clicks Run. Four agent cards come in: CRM Agent, Data Agent, Inbox Agent, Report Agent. Tasks fly from the pile into the cards.
Motion: Run button press. Cards staggered, each card works with a progress bar.
Camera: zoom into the prompt bar on the click (≈130%), then ease back to 100% for the cards.

Scene 4 · Payoff — 0:19–0:25, frames 1140–1500
On screen: checkmarks appear on the agent cards. Counter drops 200 → 0. Text: "Zero busywork."
Motion: counter counts down over ~1 s. Hold the clear board ≥ 1.5 s.
Camera: pull back to reveal the whole board, clear.

Scene 5 · Logo + CTA — 0:25–0:30, frames 1500–1800
On screen: board scales away. [PRODUCT] logo builds. Tagline: "AI agents for the work nobody wants to do." CTA: "Live on Product Hunt · [product].com".
Motion: logo build, tagline with offset, slow drift to the end.
Camera: gentle push-in.`

const fill = (value: string, placeholder: string) => value.trim() || `[${placeholder}]`

const REQUIRED: { key: keyof MotionBrief; label: string }[] = [
  { key: 'what_it_is', label: 'Fungsi produk' },
  { key: 'audience', label: 'Audiens' },
  { key: 'goal', label: 'Tujuan video' },
  { key: 'message', label: 'Pesan utama' },
  { key: 'hook', label: 'Hook' },
  { key: 'problem', label: 'Masalah' },
  { key: 'feature', label: 'Fitur utama' },
  { key: 'payoff', label: 'Hasil akhir' },
  { key: 'cta', label: 'CTA' },
]

/** Isian yang masih kosong, supaya kelihatan sebelum prompt disalin */
export function missingFields(product: string, deadline: string, brief: MotionBrief): string[] {
  return [
    ...(product.trim() ? [] : ['Nama produk']),
    ...REQUIRED.filter(({ key }) => !String(brief[key]).trim()).map(({ label }) => label),
    ...(deadline ? [] : ['Tenggat (di data proyek)']),
  ]
}

function deliverables(brief: MotionBrief) {
  const cuts = [brief.cut_vertical && '9:16', brief.cut_square && '1:1'].filter(Boolean).join(' and ')
  return `${brief.seconds} s master in 16:9 (1920 × 1080, 60 fps)${cuts ? `, plus ${cuts} cutdowns` : ''}`
}

function assetLine(brief: MotionBrief) {
  const ui = { figma: 'Figma file with the UI screens', screenshots: 'UI screenshots only (rebuild them as SVG)', none: 'no UI files yet (build the UI as SVG)' }[brief.ui_source]
  const brand = [brief.colors.trim() && `colors ${brief.colors.trim()}`, brief.fonts.trim() && `fonts ${brief.fonts.trim()}`].filter(Boolean).join(', ')
  return [ui, brand ? `brand: ${brand}` : 'no brand guide yet', brief.has_logo ? 'logo SVG' : 'no logo yet',
    brief.has_backgrounds ? 'background images' : 'no background images yet'].join('; ')
}

function elementLines(brief: MotionBrief) {
  return [
    brief.counter.trim() && `- Number counter: ${brief.counter.trim()}`,
    brief.cards.trim() && `- Repeated cards or rows: ${brief.cards.trim()}`,
    brief.cursor_tabs && '- The cursor moves between tabs or tools in the problem scene',
    brief.payoff_view.trim() && `- Final payoff view: ${brief.payoff_view.trim()}`,
  ].filter(Boolean).join('\n')
}

export function buildPrompts(productName: string, deadline: string, brief: MotionBrief): MotionPrompt[] {
  const product = fill(productName, 'PRODUCT')
  const frames = brief.seconds * 60
  const elements = elementLines(brief)
  const prompts: MotionPrompt[] = []

  prompts.push({
    id: 'brief', stage: 'bahan', title: 'Brief klien', about: 'Pesan pertama di chat. Semua prompt berikutnya berpegang pada brief ini.',
    text: `Here is the client brief for my launch video. Treat it as the source of truth: do not add claims, numbers or features that are not in it. Anything still in [brackets] is unknown, so ask me about it instead of guessing.

${product} — ${brief.seconds}-second launch video

Company: ${product} is ${fill(brief.what_it_is, 'what it is, one line: who it helps and what it takes off their plate')}.

Audience: ${fill(brief.audience, 'roles and company size')}.

Goal: launch video for ${fill(brief.goal, 'Product Hunt / website hero / paid social')}.

One message: ${fill(brief.message, 'the single sentence the viewer should remember')}

Must show:
1. The hook: ${fill(brief.hook, 'the pain in one image')}
2. The problem: ${fill(brief.problem, 'what the user does today, and why it hurts')}
3. The product: ${fill(brief.feature, 'the key feature, in the real UI')}
4. The payoff: ${fill(brief.payoff, 'the result after the product does its job')}
5. Logo + CTA: ${fill(brief.cta, 'call to action and address')}${brief.tagline.trim() ? `\n   Tagline: ${brief.tagline.trim()}` : ''}

Tone: ${fill(brief.tone, 'tone')}

On-screen text language: ${fill(brief.language, 'language')}

Deliverables: ${deliverables(brief)}.

Assets: ${assetLine(brief)}.

Deadline: ${fill(deadline, 'date')}, before launch.${elements ? `\n\nElements to feature:\n${elements}` : ''}`,
  })

  prompts.push({
    id: 'storyboard', stage: 'bahan', title: 'Storyboard', about: 'Sumber kebenaran urutan adegan, durasi, dan kamera. Periksa dulu sebelum lanjut.',
    text: `Write the storyboard for my launch video from my brief, in exactly this format: five scenes (hook, problem, product, payoff, logo + CTA), each with what's on screen, the motion, the camera and its frame range at 60 fps, adding up to exactly ${brief.seconds} seconds (${frames} frames).

The example below is for a different product and runs 30 seconds. Use it for format and level of detail only. Take all content from my brief${brief.seconds === 30 ? '' : `, and scale the scene lengths to ${brief.seconds} seconds`}. Every important element stays on screen for at least 1.5 seconds.

${STORYBOARD_EXAMPLE}`,
  })

  const needs = [
    !(brief.colors.trim() && brief.fonts.trim()) && 'Brand: two or three colors with hex codes and one font pairing.',
    !brief.has_logo && 'Logo: a simple logo as SVG.',
    !brief.has_backgrounds && 'Backgrounds: three clean 16:9 background images to sit behind the UI.',
    brief.ui_source === 'none' && 'UI: every screen the storyboard needs as SVG, not screenshots, so it stays sharp when the camera zooms in.',
    brief.ui_source === 'screenshots' && "UI: rebuild every screen the storyboard needs as SVG from the screenshots I'm attaching, keeping the real layout and labels, so it stays sharp when the camera zooms in.",
  ].filter(Boolean)
  if (needs.length) {
    prompts.push({
      id: 'assets', stage: 'bahan', title: 'Brand, latar, dan UI', about: 'Hanya meminta aset yang belum ada dari klien.',
      text: `Make the inputs for my launch video from my brief and storyboard:\n\n${needs.map((need, i) => `${i + 1}. ${need}`).join('\n')}\n\nGive me everything as files I can attach to the build prompt.`,
    })
  }

  prompts.push({
    id: 'build', stage: 'build', title: 'Build video', about: 'Melampirkan semua aset di pesan ini. Tiap adegan jadi satu blok kode.',
    text: `Using the launch-motion skill, build this storyboard as a ${brief.seconds}-second launch video, scene by scene. Use my attached brand, UI and background files.

Render one still per scene first and fix anything that overlaps or leaves the canvas. Then render the ${deliverables(brief)}.`,
  })

  const fix = (id: string, title: string, about: string, text: string) => prompts.push({ id, stage: 'fix', title, about, text })
  const polish = (id: string, title: string, about: string, text: string) => prompts.push({ id, stage: 'polish', title, about, text })

  fix('fix-canvas', 'Kunci kanvas', 'Kalau layout meluber keluar kanvas.', 'Lock the canvas to 1920 by 1080 and position everything relative to the center, not the edges.')
  fix('fix-font', 'Muat font', 'Kalau font sempat berganti di frame awal.', 'Load the font before rendering anything.')
  if (brief.counter.trim()) {
    fix('fix-counter', 'Waktu penghitung', 'Kalau angkanya melompat.', `${brief.counter.trim()}: make the count-up last about a second. Long enough to read, but quick enough that it doesn't drag.`)
  }
  if (brief.cards.trim()) {
    fix('fix-stagger', 'Kartu bergantian', 'Kalau semua kartu muncul bersamaan.', `${brief.cards.trim()}: bring them in one by one, a few frames apart, and let each one land before its checkmark appears.`)
  }
  fix('fix-camera', 'Kamera lebih halus', 'Kalau gerak kamera terlalu cepat.', 'Camera: slow down the pan and give it an easy ease, so it starts and stops softly.')

  if (brief.counter.trim()) {
    polish('polish-glow', 'Pendar penghitung', 'Menegaskan angka saat naik.', `Give the ${brief.counter.trim()} a soft ${fill(brief.glow, 'color')} glow as it climbs.`)
  }
  if (brief.cursor_tabs) {
    polish('polish-cursor', 'Kursor ragu-ragu', 'Membuat adegan masalah terasa manusiawi.', "Make the cursor hesitate between tabs for about a second, like you're losing track of what you were copying.")
  }
  if (brief.cards.trim()) {
    polish('polish-pulse', 'Denyut kartu', 'Menandai kartu yang mulai bekerja.', `Give every one of the ${brief.cards.trim()} a small pulse when it starts working.`)
    polish('polish-cascade', 'Centang berurutan', 'Centang turun satu per satu.', 'Cascade the checkmarks down the list instead of showing them all at once.')
  }
  if (brief.payoff_view.trim()) {
    polish('polish-pullback', 'Kamera mundur di akhir', 'Memperlihatkan hasil secara utuh.',
      `${brief.counter.trim() ? `When the ${brief.counter.trim()} reaches its final value` : 'On the payoff'}, pull the camera back so we finally see ${brief.payoff_view.trim()}.`)
  }

  prompts.push({
    id: 'revision', stage: 'revisi', title: 'Revisi klien', about: 'Satu perubahan, tanpa menyentuh bagian lain.',
    text: `The client wants this change: ${fill(brief.revision, 'what the client wants changed')}. Change only that, keep everything else, and re-render.`,
  })

  return prompts
}
