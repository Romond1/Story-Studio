# Phase 5 visual references and asset provenance

Research date: 2026-10-25. Research preceded implementation. No commercial artwork was copied, traced or redistributed. No external asset files, fonts, audio, dependencies or runtime network requests were added.

| Reference | License / redistribution | Design observations and use |
|---|---|---|
| [Kenney UI Pack – Adventure](https://kenney.nl/assets/ui-pack-adventure) | Publisher lists CC0. Attribution not required; optional credit to Kenney. Branding is excluded. | Inspected pack preview: inset frames, warm materials, layered circular surrounds. Reference only; no downloaded assets. |
| [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) | CC0; [publisher FAQ](https://kenney.nl/support). | Reference for bounded sparks/glows. Procedural sprites created instead. |
| [OpenGameArt Treasure chest by Savino](https://opengameart.org/content/treasure-chest-0) | CC0 according to the asset page. | Separate lid/body suggests staged opening. No model downloaded; original Canvas chest geometry used. |
| [Poly Haven](https://polyhaven.com/license) | Assets CC0; no attribution required. API terms are separate. | Considered 3D assets; not used because the wheel remains vector/Canvas and needs no additional scene or large textures. |
| [Candy Crush Booster Wheel — King](https://candycrush.zendesk.com/hc/en-us/articles/360002237097--The-Booster-Wheel) | Commercial artwork; reference only, no reuse permission assumed. | Casual-game framing, single visual focal point and distinct prize indicators informed the composition. |
| [Prodigy introduction](https://marketing.prodigygame.com/IntroductiontoProdigy.pdf) | Commercial educational-game reference; no reuse permission assumed. | Research reference for fantasy challenge/reward framing in education. No artwork copied. |

## Assets actually used
All new visuals are original SVG/Canvas/CSS code: enamel wheel gradients, gold rim, pointer jewel, compass hub, sky specks, ornate frame/scroll rods, coin sprite, chest/lid/treasure rays, portal gem/rings and friendly sprite. Stars and crowns reuse Story Studio's existing `getRewardShapePath` geometry. Typography uses system Georgia/Arial with fallbacks; no font redistribution. Sounds are synthesized using the existing AudioController oscillator and mixer buses. New code follows the repository's existing license; there are no additional third-party attribution obligations for these Phase 5 visuals.

## Tradeoffs
A 3D/WebGL chest and mixed stock art were considered but would add assets and a second visual language. The selected original vector style keeps the game coherent, resolution-independent and offline. Further effects such as jackpot, transformation or elaborate character animation are not included in this phase.
