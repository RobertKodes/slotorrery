/** Named cabinet palette — six dyes, no extras. */
export const PALETTE = {
  velvet: '#141018',
  brass: '#C6A35A',
  gilt: '#E6C97A',
  patina: '#3F6F68',
  ivory: '#E7D9C4',
  cinnabar: '#9B3428',
} as const

export type PaletteName = keyof typeof PALETTE

/** RAY rust sits between brass and cinnabar — not a seventh brand color. */
export const RAY_RUST = '#B45A32'
/** Unknown ash is ivory mixed into velvet. */
export const UNKNOWN_ASH = '#6A635C'

export const FAMILY_TINT: Record<string, string> = {
  SYS: PALETTE.gilt,
  JUP: PALETTE.brass,
  RAY: RAY_RUST,
  TKN: PALETTE.ivory,
  STK: PALETTE.patina,
  '???': UNKNOWN_ASH,
}
