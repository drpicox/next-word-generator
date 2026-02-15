# Plan: Bigram Word Generator Prototype

Build a fresh Vite React + TS app using CSS modules, then implement a modular bigram model and UI split into corpus/training + generation controls. Keep punctuation as separate tokens, use a simple power-transform temperature sampler, highlight current-context bigrams in real time, and show top 5 alternatives with probability bars.

## Steps
1. Scaffold a new Vite React + TS project in the workspace and set up CSS modules; add a clean two-column layout with tabs on the left and controls/output on the right.
2. Add core utilities: normalization, tokenization (word tokens + punctuation tokens), Levenshtein distance, and temperature sampling (power transform with $T=0$ as greedy).
3. Implement a modular `BigramModel` class: training on consecutive token pairs, frequency counts, probability normalization, OOV handling via closest token, and next-token sampling based on prior token only.
4. Build left-side components: Corpus tab (textarea + Train button) and Bigrams tab (sorted list by probability, highlight rows matching current context token, filter checkbox).
5. Build right-side components: model selector (Bigrames), seed textarea, temperature slider, generation controls (10/50/animated/step/stop/clear), alternatives panel (top 5 with bars), and generated text display.
6. Wire app state: model instance, corpus text, bigram list, current context token, generated tokens, timer state, and tab selection. Ensure highlights update live as generation progresses (including animated mode at 200ms).
7. Add default corpus text and reasonable initial UI state; ensure “clear” resets generator state.
8. Save this plan to a markdown file in the workspace (this file).

## Relevant Files
- `vite.config.ts` — Vite base config (if needed)
- `src/main.tsx` — app bootstrap
- `src/App.tsx` — layout, shared state, orchestration
- `src/models/BigramModel.ts` — training, probability, sampling, OOV handling
- `src/utils/normalize.ts` — lowercase + basic cleanup
- `src/utils/tokenize.ts` — split into word and punctuation tokens
- `src/utils/levenshtein.ts` — nearest-token helper
- `src/utils/sample.ts` — temperature power-transform sampler
- `src/components/CorpusTab.tsx` — training UI
- `src/components/BigramList.tsx` — list, highlight, filter
- `src/components/GeneratorControls.tsx` — model selector, seed, slider, buttons
- `src/components/AlternativesPanel.tsx` — top 5 candidates with bars
- `src/components/GeneratedText.tsx` — output display
- `src/styles/*.module.css` — layout + component styles

## Verification
- Run `npm install` then `npm run dev`.
- Train with default corpus and confirm bigram list populates, sorted by probability.
- Use seed text and generate 10/50 words; confirm output grows and alternatives update.
- Start animated generation and verify highlights change in real time at ~200ms.
- Stop and clear; confirm timers stop and state resets cleanly.

## Decisions
- UI language: Catalan
- Tokenization: keep punctuation as separate tokens
- Sampling: power-transform temperature with greedy at $T=0$
- Alternatives: top 5 candidates
- Scaffold: Vite React + TS, CSS modules
