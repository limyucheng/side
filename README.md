# Hawker Rush

A playable first-person 3D Singaporean hawker-stall prototype. Look out over a hawker centre and cook bak chor mee, kaya toast, and kopi for customers who walk up to order.

## Run

Requires Node.js 18+ and a browser with WebGL 2 / hardware acceleration.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. `npm run build` produces `dist/`; `npm run preview` serves the production build. `npm test` runs the game and interaction regression tests.

## Play in the scene

Click **Let’s cook!** to start the four-minute shift. Until then, explore without a countdown. The opening office noodle order gets 100 seconds, Uncle Lim's toast and kopi get 152 seconds, and the family's takeaway bowls get 190 seconds. Later customers keep their recipe-based patience budgets.

Customers keep arriving until closing, with no daily sales cap. A smooth lunch peak brings faster arrivals and up to three active tickets; quieter opening and closing periods refill toward two tickets at a gentler pace. An empty counter gets another arrival within two seconds, even in the final minute. Late customers request single dishes. The served counter tracks every completed ticket.

- **Look around:** A/D, left/right arrow keys, the side arrows, the bottom compass, or a right-mouse drag. Three focused views show one part of the stall at a time: ingredients and cooking on the left, customers and plating ahead, coffee and takeaway supplies on the right. You can turn while carrying an item; moving it to the screen edge also turns the camera.
- **Pick up objects:** drag them, or tap an object then tap its destination. Valid drop targets glow gold. Tab and Enter provide a keyboard alternative for the scene objects; Escape puts down a held object.
- **Find your ingredients:** bread, mee nests and fresh greens sit in separate labelled sections of the raised shelf. Chilli, kaya and chopped greens stay on the worktop. The cleaver and kaya spreader hang upright on the labelled rack beside the shelf; the cleaver's backing lights up when vegetables are waiting to be chopped.
- **Follow orders while cooking:** large tickets move into a reserved area above the kitchen when you turn away; short landscape screens use a left column. The camera and sharp kitchen area move together, keeping the shelves and tools unobstructed without clearing the drawing canvas. A live blurred continuation of the scene fills the space behind the HUD and feedback. Return to the centre and the tickets move above the customers' heads. Food preferences, countdowns, patience bars and partial-order progress remain visible.
- **Read feedback:** payments, corrections, missed sales and cooking instructions use a separate area below the kitchen. Only one message is shown at a time. Coins, HUD pulses, customer reactions and sound effects still celebrate good service.
- **Chop greens:** drag vegetables from the shelf onto the chopping board, pick up the large cleaver from its rack, then make three cuts on the board. This stocks three portions of chopped greens, up to six in storage. Each noodle bowl needs a portion from the greens tray.
- **Noodles:** drag a mee nest from the wooden tray into the pot. Add more nests before two seconds to batch up to three portions. Each addition restarts the shared cooking timer. At **2–4 seconds**, lift the basket, turn to the centre, and drop it into an empty bowl. Cooking stops as soon as you lift it. Extra portions stay on the prep tray. Add chopped greens, and chilli when requested.
- **Toast:** drag bread onto the grill, wait **2–4 seconds**, then lift the toast and carry it to an empty plating spot or the prep tray. It starts plain: pick up the spreader, dip it into the kaya jar, then spread it on the toast. One dip finishes one portion. Early lifting leaves the bread on the grill; burnt toast can be dragged straight to the bin. The grill and main noodle pot share a burner.
- **Kopi:** drag an empty cup to the urn. After two seconds, a black, unsweetened cup appears beside the coffee station. Drag milk and sugar onto the cup separately, following the ticket's milk/sugar icons. Carry it to a centre plating spot to serve. There is room for two cups beside the urn; five cups empty the pot. Drag the kettle onto the urn for a four-second refill.
- **Customise:** drag takeaway paper onto a dish for customers with the bag icon. Drop paper on it again to unpack. Drag chilli off a bowl and back to its jar to remove it; tidying the bowl takes one second.
- **Serve:** drag a plated dish directly to the customer who wants it. The food, chilli/no-chilli, milk/sugar, and dine-in/takeaway icons above their heads stay visible. Multi-dish orders accept one dish at a time. Hold Shift while handing over a dish to accept wrong preferences with reduced satisfaction; toast still needs kaya and noodles still need chopped greens.
- **Recover:** drag burnt baskets, unwanted prepared portions, or plated dishes into the bin. Slightly overcooked food remains edible. Food is fresh for 20 seconds, then gently loses satisfaction. Small freshness bars appear under prepared food; hover for the remaining time.

Office workers have less patience; families order more and wait longer. Uncle Lim always wants toast and kopi. Serve as many tickets as you can; eight completed tickets earns three stars, and you can continue serving beyond that. Between shifts, spend saved earnings on equipment. Day, savings, best score, and upgrades persist in this browser. Existing prototype saves are preserved.

**P** pauses; **?** opens help. Switching tabs pauses automatically. A mellow, original café groove plays during a shift: soft electric keys, mallet melody, plucked bass, and brushed percussion. The music-note button toggles music, the speech-bubble button toggles background hawker chatter, and the speaker mutes all audio. All three preferences are saved. Playback starts after you interact with the game; audio stops while paused or in another tab. Audio and fullscreen controls are at the top right.

NPC dialogue is text only; spoken NPC lines and their audio assets have been removed. Eight bundled background hawker calls and table conversations remain. Their timing, volume, filtering and overlap follow the same lunch curve as customer arrivals: a single distant conversation in quieter periods, with faster, brighter overlapping chatter at peak. Important game cues briefly lower the crowd audio. Playback needs no speech-service connection, API key or microphone.

## Rush feedback

- Noodle baskets and toast get large **LIFT NOW** badges at two seconds. You can drag the badge itself to lift the food. The badge and cooker glow turn amber near the end of the perfect window, then red with a countdown to burning. Ready chimes, escalating ticks, and a burnt-food cue make timing audible. Badges stay at the screen edge when the cooker is outside the camera view.
- Wrong dishes, missing chilli/packaging, and raw or unplated food handed to a customer produce a rejection sound, a head shake, and a specific correction message. The food and already-earned cash are preserved. Valid partial family/regular orders still receive a positive reward and show which dishes remain.
- A sale shows its actual payment, tip breakdown, flying coins heading to the takings HUD, and a customer celebration. Completing a ticket plays a rising fanfare; longer streaks add coins and raise its pitch.
- Customers wave, get an amber countdown and a chime before leaving, then a red **LAST CALL** warning and more urgent chimes in their last five seconds. Singlish speech bubbles escalate from reminders to frustrated lines, including the requested “Chibai” and “Lanjiao” dialogue.
- A departing customer shows the unserved order's **missed sale**, the actual satisfaction loss, and any broken streak, with a descending sound. Each departure lowers the shift's satisfaction by **5 percentage points**, clamped at zero. Earned cash is never deducted. The shift summary totals missed sales.

Music lowers briefly behind important sound effects. The speaker still mutes all audio, while the music-note control only toggles music. Warning sounds stop while paused; reduced-motion mode keeps readable feedback without bouncing badges or flying coins.

## Equipment

- **Second noodle basket ($25):** adds a physical second pot with its own cooking slot.
- **Larger preparation tray ($18):** allows four portions in a batch.
- **Insulated holding area ($20):** doubles freshness to 40 seconds.
- **Extra plating space ($22):** opens the third counter spot.

## Development

Three.js renders original code-built low-poly geometry, lighting, shadows, animated customers, and the hawker centre. No external model or image assets are required. The overlay uses vanilla JavaScript and CSS; Vite bundles the app. Google Fonts is optional, with local fallbacks. There is no backend or login.

- `src/scene.js` — 3D environment, camera, raycasting, dragging, animation, screen projection and rendering. A fixed full-screen drawing buffer renders one extended scene; a low-resolution frame copy supplies the blurred HUD background.
- `src/interactions.js` — validates physical object-to-object actions independently of rendering.
- `src/game.js` — timing, batches, fixed plating positions, customers, serving, freshness, economy, and upgrades.
- `src/main.js` — compact HUD, floating pictorial orders, help, results, audio controls, saves, and the frame loop.
- `src/audio.js` — original eight-bar instrumental groove, distinct event cues, music ducking, and pause/mute lifecycle.
- `src/feedback.js` — contextual reward/rejection/loss cards, flying coins, HUD pulses, and effect cleanup.
- `src/art.js` — food illustrations for order bubbles and interface icons.
- `src/dialogue.js` — customer-specific Singlish impatience lines.
- `src/order-layout.js` — continuous ticket movement between customer heads and the order area.
- `src/game-layout.js` — responsive regions and the shared transition between the counter and side stations.
- `src/ambience.js` — background chatter density, layering, filtering, cue ducking and pause/mute cleanup.
- `public/audio/voices/` — eight background chatter MP3s and their transcript manifest; no NPC speech audio.
- `src/style.css` — full-viewport game overlay and responsive layouts.
- `tests/` — game-rule and spatial-interaction regression tests.

The scene uses a fixed first-person viewpoint with three turning directions. Looking around and handling objects are interactive; free character navigation is not implemented. This is a stylised gameplay prototype, with timing, patience, freshness, and prices available for tuning in `src/game.js`.

The background clips use [Qwen3-TTS VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign). Background hawker directions live in `scripts/voice-profiles.mjs`. `scripts/generate-singlish-voices.mjs` generates only the eight chatter clips and publishes a complete matching set. Use `--local` with [MLX Audio](https://github.com/Blaizzy/mlx-audio) on Apple Silicon, setting `HAWKER_PYTHON`, `HAWKER_QWEN_MODEL` and `HAWKER_FFMPEG` to the temporary runtime, downloaded VoiceDesign model and audio encoder. The game serves only small local MP3s; model weights and speech runtimes are not game dependencies.
