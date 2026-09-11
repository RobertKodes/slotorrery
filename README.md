# slotorrery

A museum orrery left under glass: dark velvet, warm brass, cool patina.
The sun is a slot clock; planets are program families whose sweep is their heat.
Comets are the last few transactions — they streak, then die; failures oxidize red.
Fee pressure warps the well from circle toward ellipse, never a chart.
One grasp holds a sample. Let go, and the present resumes.

Live: https://robertkodes.github.io/slotorrery/

## How to read it

| Orrery | Chain |
| --- | --- |
| Sun / slot clock | Confirmed slot; the hand jumps on each new tick |
| Planet | Program family (system, JUP, RAY, token, stake, unknown) |
| Sweep speed / radius | That family's recent signature heat |
| Comet streak | A recent transaction, dyed by family |
| Cinnabar burnout | Failed tx — burns red, then fades |
| Elliptical well | Fee pressure + load + skipped-slot gap |
| HOLD / grasp a planet | Frozen sample: orbits pause, comet set stays |
| Release | Resume the live feed |

Not an explorer. Not a wallet. Not a dossier. Browser talks JSON-RPC; brass turns.

## Palette

Named hex, cabinet dyes, six:

| Token | Hex | Use |
| --- | --- | --- |
| **velvet** | `#141018` | Museum cloth, void |
| **brass** | `#C6A35A` | Rings, arms, fittings, JUP |
| **gilt** | `#E6C97A` | Sun, live digits, system |
| **patina** | `#3F6F68` | Cool glass, stake, kicker |
| **ivory** | `#E7D9C4` | Engraved labels, token |
| **cinnabar** | `#9B3428` | Failed comet burnout |

RAY rust (`#B45A32`) is brass mixed toward cinnabar. Unknown ash (`#6A635C`) is ivory mixed into velvet. Neither is a seventh brand color.

## Type

- **Cormorant Garamond** — museum optical serif on the nameplate. Not Inter, not a SaaS geometric.
- **Chivo Mono** — stamped HUD, callsigns, the HOLD legend.

## Tinkerer notes

```bash
npm i
npm run dev
```

Vite serves at `/slotorrery/`. Open that path, not `/`.

```bash
npm run build
```

must pass. Static `dist/` is force-pushed to the `gh-pages` branch at root (`index.html`, `assets/`, `.nojekyll`). Repo Pages source should be **branch `gh-pages` / folder `/`**. If the live URL 404s: GitHub → Settings → Pages → source **`gh-pages` / root**.

Public RPC, rotating on failure (no API keys):

- `solana-rpc.publicnode.com`
- `api.mainnet-beta.solana.com`
- `solana.drpc.org`
- `rpc.ankr.com/solana`
- `solana.llamarpc.com`

Override with `VITE_RPC_URL`. Methods: `getSlot`, `getRecentPerformanceSamples`, `getRecentPrioritizationFees`, rotating `getSignaturesForAddress` on a short program roster via `@solana/web3.js`. If RPC flakes, the orrery keeps the last well and the plate marks **degraded**.

`prefers-reduced-motion`: planets sit as a static diagram; slot / TPS / RTT still update until you HOLD.

Space or the brass HOLD plate freezes a sample while pressed; drag a planet to grasp.
