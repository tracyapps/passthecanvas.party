# Design

**Design canvas:** [Claude Design, Pass the Canvas](https://claude.ai/artifact/TGRYKv8LbSE1kUhiebrtzV): four screens (Studio painting view, Room view, Studio library, Reveal). The painting view there is interactive and has a working brush engine to port.

## Direction

A real art studio, not an app. Every control should read as an object you'd find on a studio table:

| UI need | Real object |
| --- | --- |
| Tools | Brushes standing in a glass jar; selected brush lifts out |
| Colors | Paint blobs on a wooden palette, plus "mix a color" |
| Turn timer | Kitchen timer dial |
| Music | Tube radio (`vintage_radio_transceiver` in the 3D room) |
| Chat | Lined notepad that slides out |
| Labels | Masking tape with handwriting |
| Guests | Polaroids around the table (painting view) / video at their spot (360° room) |
| Call controls | One compact dark dock at the bottom: mic, camera, chat, react, room, more, leave |

The art always gets the most screen space. Main actions are always visible, and everything else is one tap away.

## Type

- **Atkinson Hyperlegible**: body and UI (chosen for legibility)
- **Bricolage Grotesque**: headings, numbers (timer digits)
- **Caveat**: handwritten labels only (tape, polaroid names). Never for anything long.

## Color tokens

Source of truth: `apps/web/src/styles/_tokens.scss`.

| Token | Hex | Use |
| --- | --- | --- |
| `$walnut-900` | `#2a1d14` | Darkest wood, text on light |
| `$walnut-700` | `#4a3122` | Table shadow areas |
| `$walnut-500` | `#7a5338` | Table highlight |
| `$paper` | `#fbf7ee` | Canvas, polaroids |
| `$cream` | `#f3ead9` | Text on dark, light surfaces |
| `$tape` | `#efe2c4` | Masking tape |
| `$ink-dock` | `#18100b` | Call-control dock |
| `$cadmium-orange` | `#e8742a` | Primary accent (timer, current painter) |
| `$ultramarine` | `#2c3f9e` | Secondary accent |
| `$alizarin` | `#b3242f` | Leave, muted state |
| `$focus` | `#ffd38a` | Focus ring on dark |

## Screens (from the canvas)

1. **Studio, painting view**: main working screen
2. **Room**: becomes the 360° room (see PLAN.md)
3. **Studio library**: rooms, camera angles, tables, props, lighting
4. **Reveal**: framed piece, credits per round, download / replay / print
