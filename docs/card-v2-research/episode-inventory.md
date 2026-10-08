# Six-episode card inventory — read-only evidence

Inspection date: 2026-10-07. All conclusions below come from saved JSON and source inspection, not a production-app launch. No episode was saved, normalized, migrated, or rendered.

## Scope and integrity

Found **six logical production episodes**, selected using the repository’s `docs/manual-audio-release-checklist.md` for Episodes 1–5 and the numbered Episode 6 `STORY STUDIO` folder. None of these projects has a saved project `name` or `title`; “Episode 1” through “Episode 6” are folder-based identifiers, not invented lesson titles. Content themes below are descriptive inferences from actual card text.

**17 physical `project.json` documents were discovered** under `D:\AI\SET OUT\TWIN STAR`; the 11 excluded documents are tests, empty scaffolds, remake folders, or an assets-contained JSON. Do not count these as 11 additional episodes. All 17 before/after SHA-256 comparisons match. Baselines were computed from source bytes before full JSON analysis. Qualification: Episode 6’s first 40 lines were read to identify the document before the baseline was taken; this was a read-only operation, and no earlier hash is claimed. The hashes establish no changes during the subsequent audited analysis.

Evidence files:

- `episode-source-discovery.json`: all 17 physical paths, metadata, before/after hashes and unchanged flags.
- `episode-card-evidence.json`: all nine raw ACard objects, all 137 raw BCard objects, all references and instance geometry, field/style metrics, media resolution and Boost occurrence sequence.
- `episode-card-content.csv`: one row per BCard, full front/back text, name, use count, dimensions, image/audio IDs, font sizes and animation.
- `episode-variant-comparison.json`: production/test differences for Episodes 3 and 4.

| Episode | Source path | Slides / sections | SHA-256 before = after |
| --- | --- | ---: | --- |
| 1 | `D:\AI\SET OUT\TWIN STAR\EPISODE 1\WIN APP\Prod EP1\project.json` | 112 / 16 | `3EDB23F264A0999F9E06BEAF2DBE8C0572F9269B7479E0AFFCFD6E4212823142` |
| 2 | `D:\AI\SET OUT\TWIN STAR\EPISODE 2\Ep2 Studio\project.json` | 83 / 14 | `5F5DAD6DECAE528D704BCA93CAFE83D335A00C32CBC5B94CEEFE12AA4AEBC43A` |
| 3 | `D:\AI\SET OUT\TWIN STAR\EPISODE 3\STORY STUDIO\ep3 raw\project.json` | 80 / 14 | `5DCC669A63DBB8FFED248EEE1967105101678BCF4C69EB6008F3E57D96A1ED34` |
| 4 | `D:\AI\SET OUT\TWIN STAR\EPISODE 4\STORY STUDIO\project.json` | 90 / 10 | `1C23EF0F248E1E346480C745840F18E91E1C83EC7F6319404F15385BEB323D81` |
| 5 | `D:\AI\SET OUT\TWIN STAR\EPISODE 5\STORY STUDIO\project.json` | 74 / 13 | `B79148E524D0EDBC73CE50E5A98D268576822B25F6B86AF83B82491E3EBE43DE` |
| 6 | `D:\AI\SET OUT\TWIN STAR\EPISODE 6\STORY STUDIO\project.json` | 75 / 9 | `27DB02139DA4068E9812C4D930BE103B92EE86461E048DB3B41A24321653BDB7` |

The historical July checklist hash differs from today’s Episode 3 and Episode 5 hashes because those files have later saved timestamps. This is not a change made by this audit. Episode 3 `test 3` is identical to `ep3 raw` except `updatedAt`. Episode 4 `test SS` has the same A/B libraries but different slides, sections, Boost sequence, badge configuration, students and timestamp; it is a real variant, not an exact backup. No variant was substituted for the selected production path.

## Counts and where cards are used

An **ACard** is a saved board/stage. A **BCard** is shared front/back content. An **instance** is a placement of that shared content, not a new BCard. Counts below are persisted placements, not effective render counts or usage telemetry. A board placement and an overlay placement can share a BCard ID while retaining different instance IDs, geometry and runtime state.

| Episode | A / B definitions | ACard-board placements | Boost placements (hosts) | Story-section placements (hosts) | Story-slide placements | Saved A refs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4 / 31 | 31 | 18 (10) | 15 (7) | 0 | 3 |
| 2 | 1 / 10 | 10 | 10 (10) | 0 (0) | 0 | 0 |
| 3 | 1 / 27 | 27 | 27 (19) | 0 (0) | 0 | 0 |
| 4 | 1 / 24 | 24 | 53 (15) | 0 (0) | 0 | 0 |
| 5 | 1 / 22 | 22 | 30 (30) | 0 (0) | 0 | 0 |
| 6 | 1 / 23 | 22 | 22 (6) | 0 (0) | 0 | 0 |
| **Total** | **9 / 137** | **136** | **160 (90)** | **15 (7)** | **0** | **3** |

All nine ACards are `stageMode: full`; **zero half stages**. There are **zero saved `displayMode: board` placements**. All 175 placements outside ACard libraries explicitly say `overlay`; all 136 inside boards omit displayMode. ACard membership and `displayMode: board` are different concepts. No BCard flags are populated. No saved `promptCard` or legacy `bCardRef` record occurs in the selected six documents. There are no dangling A/B IDs.

Episode 1 contains two Boost references to `Acard Who are the characters?` plus one story-slide reference (`slides[7].storyReferences[0]`) to `miniBreak1`. Its `Br1` and empty `Br2` boards have no saved A reference. Every Episode 2–6 ACard has no saved A reference, yet their BCard content is referenced by Boost occurrences. “No saved board reference” is not proof a teacher never selects the board manually, and is not grounds for deleting it.

Episode 1 has two B definitions with no placement at all: `c8a78912…` and `5f2a818e…`, both exact copies of “B3 What is inside?”. The `6bede00b…` brave-question copy lives only on unreferenced `Br1`; two miniBreak cards are board-only but their board has a story reference. Episode 6 has a board-only correct-answer variant and a different Boost-only wrong-answer variant, detailed below.

## Saved content and styling

| Episode | Empty back text (also no image/emoji) | Same front/back text | Different front/back text | Front / back image references | Audio refs | B-side font px | Max front / back chars |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 1 | 2 | 0 | 31 | 25 / 3 | 27 | 35, 43, 46, 49, 61, 69 | 31 / 32 |
| 2 | 0 | 0 | 10 | 0 / 0 | 0 | 41, 45, 61, 63 | 27 / 21 |
| 3 | 0 | 0 | 27 | 0 / 0 | 0 | 31, 34 | 55 / 37 |
| 4 | 6 | 0 | 24 | 0 / 0 | 0 | 28, 36, 55, 60 | 24 / 15 |
| 5 | 21 | 0 | 22 | 0 / 0 | 0 | 28 | 29 / 18 |
| 6 | 0 | 0 | 23 | 0 / 0 | 0 | 28, 41, 42 | 48 / 47 |

All 274 BCard sides have Arial, explicit font size, text color, centered horizontal alignment and background color. Episode 1 mixes top/middle/bottom alignment (1/35/26 sides) and image-backed faces; Episodes 2–6 are all vertically centered and text-only. All B definitions have different fronts and backs, including intentional blank backs; none has identical complete side objects. There are **29 empty backs**, concentrated in Episode 5. Empty does not mean missing data: blank backs can hide a prompt after flipping and must remain blank in a faithful import. Episode 1 also has three image-only fronts, including the small Heart answer card and power cards.

Only Episode 1 references card media: **28 B face-image references + 27 B audio references + 2 A background-image references = 57**, resolving to **23 distinct asset IDs**. Every one resolves to an asset record and an existing file at the saved relative path. This proves file existence, not successful decoding/playback. The other five episodes have zero card-media references; they still have underlying slide media. No six-episode card uses emoji.

Episode 1 saves `flip` animation on 30 cards; Episode 2 saves flip (1), zoom-in (1), pop (2), fade (5), with one absent; Episodes 3–6 have no animationPreset. Preserve these values, but do not infer runtime animation support just because a field is populated. All nine boards have zero enabled timers. Four boards (Episode 1 miniBreak1/Br2 and Episodes 5/6) explicitly store timer/title/style defaults; older boards omit them. Preserve absent-vs-explicit defaults. Episode 5 board name is “What happens next?” but its saved title is “ACard 1”; these fields are distinct.

## Patterns, combinations and manual-review findings

### Episode 1 — character questions, image clues and answer fragments

Four boards contain 14, 15, 2 and 0 placements. Reused BCards appear on boards, break sections, and both activation/language Boost lanes. A prompt “The bird took the _________” is combined with a separate small Heart answer card; this is a two-card composition, not a single Q/A card. Some fronts are image-only; many text questions sit on full-face images with bottom alignment. The bilingual brave question is valid Unicode (`Is Yuki brave?` plus `ゆきは ゆうかん？`); terminal mojibake in a preliminary print is not corruption in the source.

Two exact duplicate-content groups exist after excluding only ID and name: brave cards `ebaa844d…` / `6bede00b…`; armor cards `b72c95b2…` / `c8a78912…` / `5f2a818e…`. They account for three extra definitions, but their identity and placement are meaningful. Other repeated question text is not an exact duplicate: “What is his name?” targets Yuki or Kage and differs in imagery/context. Do not deduplicate on front text or `(Copy)` names.

### Episode 2 — clue naming and “It is a …”

Ten shared Q/A cards, each once on the board and once on an activation slide. Repeated “What is this clue?” fronts map to four different answers. One card teaches “It is a .....” → “It's a .....”; treating a back as merely an answer label would lose this transformation. Board has nine 308×139 cards and one 320×166 card; Boost placements vary.

### Episode 3 — pronoun substitution

Twenty-seven cards: six grammar-reference cards (“I”, singular/plural “You”, “He, She, It”, “We”, “They”) and story-sentence substitutions. The introductory Boost occurrence groups six cards, another groups two, and another groups three. Front casing, pronoun casing, spaces and full sentences matter. All 27 have a board placement and a distinct Boost placement. Board contains very small 69×80–110×80 grammar cards while Boost copies are much larger; conversion cannot substitute library-board geometry for each occurrence.

### Episode 4 — verb + ing, questions and hidden verb answers

Twenty-four definitions create 77 placements. A 12-card Boost composition repeats the same “ing” BCard four times; another uses nine cards. “ACTION” → “walk” and “ACTION+ing” → “WALKING” are separate cards, as are small “?” → verb cards. Repeated placements require separate instance/runtime identities; flipping one must not flip every copy. Six backs are blank. Long question strips and small answer chips are deliberately different shapes.

### Episode 5 — sequence/prediction captions

Twenty-two definitions create 30 Boost placements and 22 board placements. Twenty-one backs are blank; only “???????????” → “What is happening?” has back text. Same caption recurs later in the activation sequence, including “Kids look at volcano”, “Kids meet Luma”, and the apology. Repetition and sequence order are instructional structure, not accidental duplicate content. Do not synthesize answers or auto-delete blank sides.

### Episode 6 — Why/Because multiple choice; correctness conflict requires review

**Manual-review finding, not an instruction to fix content:** `boostPack.activationSequence[9].bCardInstances[1]` references `26f8b2da-355e-4e92-83c5-b3265d34ab46`, “Because he wants to keep the Heart of the forest” → **Wrong**. The board instead places `52e24e0e-a618-4670-b5a4-19efca8915b2`, nearly the same text with capital “Forest” → **Correct **. The question back gives that reason as its explanation. Both IDs resolve; this is a semantic conflict rather than broken linkage. Preserve both definitions and exact occurrence assignments. Only an explicit author decision should repair it. A structural copy does not require a rebuild.

The 23 definitions produce 22 board placements plus 22 Boost placements: totals match while membership differs. Five grouped quiz slides generally combine a question with three choices; the intro has Why/Because scaffolds. Color distinguishes question, explanation, distractor and correctness states; preserving color is part of meaning here. The “cookies (Copy)” library name actually displays “cake”, and the text “made from from chocolate” contains an authored repetition. These are author-review candidates, not automatic conversion corrections.

## Geometry and overflow risk — not rendered defects

Saved positions are percentage centers and sizes are fixed CSS pixels. Current `StageInteractable.tsx` converts centers into host-relative top-left pixels, clamps to host bounds, and keeps width/height; `BCardFace.tsx` uses fixed-pixel text, and `acard.css` clips card faces with 16px text padding and full-face `object-fit: cover` imagery. New wrapping, padding, line-height, card sizing, crop or clamping rules can change presentation even if every saved scalar is copied. This audit did not measure a browser, so it does not certify clipping or legibility.

| Episode | Saved size range (width × height extrema, not a single card) | Concrete visual-validation priority |
| --- | --- | --- |
| 1 | 165–720 × 80–390 | Image crop/text overlap; Japanese wrapping; 61–69px miniBreak text; 720×103 prompt plus separate Heart answer. |
| 2 | 210–522 × 90–215 | “What sound was on the test?”: 41px, 27 chars, Boost 378×108; board and Boost dimensions differ. |
| 3 | 69–417 × 80–209 | 55-character front at 34px in 245×135 board card vs 417×157 Boost; grammar back at 31px in 69×80 card. |
| 4 | 86–762 × 80–194 | 60px question text in 80px-high strips; 16px top/bottom padding leaves a tight content area; small 94×98/121×82 board cards. |
| 5 | 138–439 × 89–175 | 29-character sentence at 28px in 177×103 board placement; 21 blank backs must stay visually blank. |
| 6 | 174–526 × 80–239 | All 22 board placements are 174×80; long front/back text reaches 48/47 chars at 28px; Boost geometry is larger. |

## Compatibility classes and conversion planning

These are planning assessments, not converter test results. No V2 implementation or migration tool was executed. “Perfect mapping” below means exact preservation of saved data and intended semantic identities; it is **not a pixel-equivalence guarantee**. Preserve the original episode and use the same-app legacy renderer for default unchanged teaching. A future opt-in converter must create a copy and report review items.

1. **CAN MAP PERFECTLY TO V2**: all raw fields, IDs, references, order, placement geometry and blank states have lossless representational candidates. Eligibility is conditional on the final V2 schema supporting them; tested perfect mapping count is zero today.
2. **CAN MAP WITH VISUAL DIFFERENCE ONLY**: an explicit author-approved new layout/typography treatment may retain content semantics. All six are visual-review candidates; no visual difference has been measured in this audit.
3. **CAN MAP WITH MINOR BEHAVIOR DIFFERENCE**: no such difference is accepted or required by the observed data. Changed flip/cover/drag/reset/occurrence semantics need an explicit product decision; do not silently call them minor.
4. **REQUIRES LEGACY RENDERER**: all six require the existing renderer as the current evidence-backed route to preserving their CSS/runtime presentation until V2 visual and behavioral equivalence is verified. This is a preservation requirement, not proof V2 could never match them.
5. **REQUIRES MANUAL MIGRATION**: none is proven to require full manual rebuilding. Episode 6 has one correctness-conflict pair requiring author review if semantic cleanup is requested. Raw preservation can carry the conflict unchanged; do not force migration to resolve it.

| Episode | Class 1 candidate records (A / B / placements / A refs) | Class 2 visual checks | Class 3 behavior gate | Class 4 default | Class 5 author-review scope |
| --- | --- | --- | --- | --- | --- |
| 1 | 4 / 31 / 64 / 3 | Images, Japanese, composites | Board + occurrence overlays, audio, miniBreak | Retain legacy | Optional duplicate/name cleanup only |
| 2 | 1 / 10 / 20 / 0 | Fixed text sizing and board geometry | Saved animation presets vs actual runtime | Retain legacy | None identified |
| 3 | 1 / 27 / 54 / 0 | Tiny grammar cards, long sentences | Six independent simultaneous cards | Retain legacy | None identified |
| 4 | 1 / 24 / 77 / 0 | Question strips, answer chips | Repeated same definition, independent flips | Retain legacy | None identified |
| 5 | 1 / 22 / 52 / 0 | Blank backs, repeated captions | Blank flip/reset; repeated occurrences | Retain legacy | None; do not invent answers |
| 6 | 1 / 23 / 44 / 0 | Dense board, semantic colors | Independent choice reveals; exact memberships | Retain legacy | One conflicting correctness pair; no forced rebuild |

**Automation scope:** 9 A definitions + 137 B definitions + 311 placements + 3 saved A refs = **460 structural records/reference entries** are candidates for mechanical copying, not deduplication or semantic repair. These are disjoint counted categories; Boost occurrence containers/order are additional structure and must also be preserved. **Automated conversion executed: 0. Visually validated converted cards: 0. Required episode rebuilds established: 0.** Blank backs (29), image-only fronts (3), repeated definitions, named copies and absent defaults are preserve-as-is cases.

Unused or unexercised capabilities in this corpus: half-stage A layout, saved board-mode B placements, enabled A timers, emoji, non-Arial fonts, non-center horizontal B text, populated instance flags, gradient/transparent A background mode, and legacy promptCard/bCardRef records. Do not remove those capabilities because this corpus lacks them; use synthetic fixtures for their later compatibility testing.

## Complete BCard text ledger

Short IDs identify entries in the evidence JSON; full IDs and unmodified strings are in the CSV/JSON. Displayed `∅` means empty text, not absence of a side. Newlines are shown as `<br>`. Trailing spaces remain in evidence but are not reliably visible in Markdown. Uses count all saved placements, including boards with no saved A reference.

### Episode 1 — all 31 BCards

| ID | Name | Front | Back | Placements |
| --- | --- | --- | --- | ---: |
| `42eceead` | B1 What is her name? | What is her name? | Her name is Mia | 6 |
| `a409ba5e` | B1 What is his name? | What is his name? | His name is Yuki | 6 |
| `79bdefca` | What is his name? (Copy) | What is his name? | His name is Kage | 2 |
| `878546d9` | The forest is ..... | The forest is ....... | dangerous | 2 |
| `79d6a930` | What did Yuki throw? | What did Yuki throw? | Yuki threw a ROCK | 2 |
| `434ea4d1` | What was in the treasure chest? | What was in the treasure chest? | In the chest there was an armor. | 2 |
| `634da7be` | What was in the treasure chest? (Copy) | The bird took the _________ | ∅ | 2 |
| `72a2d767` | Heart SMALL | ∅ | Heart | 2 |
| `0daf84d0` | I feel super strong | ∅ | Strong | 2 |
| `c90c207f` | I feel super strong (Copy) | ∅ | I feel very fast | 2 |
| `2157494f` | The forest became.....quiet | The forest became..... | quiet | 2 |
| `40cbfd38` | The forest became.....windy | The forest became..... | windy | 2 |
| `bb37684d` | In the sky they saw a .... | In the sky they saw a .... | Dragon | 2 |
| `90cea6d3` | Yuki was happy? | Yuki was happy? | No, Yuki was sad | 2 |
| `d9a2988a` | B1 Is Mia scared  | Is Mia scared | Yes she is  | 2 |
| `daf2fc84` | MB1 is Mia a girl? | is Mia a girl? | Yes she is | 1 |
| `d99eff33` | MB1 is Yuki a boy | is Yuki a boy | Yes he is | 1 |
| `e7c9a6f0` | B2 is the bird bad? | is the bird bad? | Yes, the bird is bad | 2 |
| `ebaa844d` | B2 Is yuki brave | Is Yuki brave?   <br>ゆきは ゆうかん？ | Yes, he is brave | 2 |
| `6bede00b` | B2 Is yuki brave (Copy) | Is Yuki brave?   <br>ゆきは ゆうかん？ | Yes, he is brave | 1 |
| `74cb3700` | B3 What is his name? kage | What is his name? | His name is Kage | 2 |
| `8db3f821` | B3 What is this? | What is this? | It is a treasure chest | 2 |
| `b72c95b2` | B3 What is inside? | What is inside? | It is an armor | 2 |
| `c8a78912` | B3 What is inside? (Copy) | What is inside? | It is an armor | 0 |
| `5f2a818e` | B3 What is inside? (Copy) (Copy) | What is inside? | It is an armor | 0 |
| `5baa819c` | B4 Yuki is super... | Yuki is super... | Strong | 2 |
| `f5cb21de` | B4 Mia is super... (Copy) | Mia is super... | Fast | 2 |
| `9586c1bc` | B4 What Power do you want? | What Power do you want? | ∅ | 2 |
| `e0bcf3a2` | B6 is yuki upset | Is Yuki upset? | Yes he is.  | 3 |
| `7ca27e78` | B6 Yuki made a mistake? | Yuki made a mistake? | Yes he did | 2 |
| `c270a496` | B7 What is that shadow? | What is that shadow? | It is a Dragon | 2 |

### Episode 2 — all 10 BCards

| ID | Name | Front | Back | Placements |
| --- | --- | --- | --- | ---: |
| `1f962c95` | Feather card  | What is this clue? | It is a Bird Feather | 2 |
| `161ff638` | branch | What is this clue? | It is a Broken Branch | 2 |
| `7aea7358` | foot print | What is this clue? | It is a Foot Print | 2 |
| `7a4b93ae` | map | What is this clue? | It is a Map  | 2 |
| `1fd9993c` | IT IS A  | It is a ..... | It's a ..... | 2 |
| `28163f59` | Luma | What animal is Luma? | It is a Fox | 2 |
| `f1200edc` | Sound  | What sound was on the test? | It is a Water sound | 2 |
| `73d21d88` | Light color | What color is the light? | It is a Blue Light | 2 |
| `62fd3a80` | Shard | What is this? | It is a Shard | 2 |
| `cf988bd1` | Bird nest  | What is this? | It is a Bird Nest | 2 |

### Episode 3 — all 27 BCards

| ID | Name | Front | Back | Placements |
| --- | --- | --- | --- | ---: |
| `e7970182` | Who followed the shard? | Who followed the shard? | THEY followed the shard | 2 |
| `c8849c20` | Yuki wanted to go in.  | Yuki wanted to go in.  | HE wanted to go in  | 2 |
| `0af958e2` | I | I | person 1 - singular  | 2 |
| `ce33fda7` | You s | You | person 2 - singular  | 2 |
| `3649a3e4` | He, She, It | He, She, It | person 3 - singular  | 2 |
| `98e0be66` | We | We | person 1 - plural  | 2 |
| `bfb1b5e4` | You p | You | person 2 - plural  | 2 |
| `7810b2ba` | They | They | person 3 - plural  | 2 |
| `dd2ec37e` | Kage was not sure  | Kage was not sure  | HE was not sure  | 2 |
| `d2825e8b` | The kids found a castle | The kids found a castle | They found a castle | 2 |
| `91b011ab` | the group went in the castle | Carefully, the group went in the castle | They went in the castle | 2 |
| `c81ddd81` | The castle was scary  | The castle was scary  | IT was scary | 2 |
| `06f25fda` | The little cathedral | The little cathedral was a spider | IT was a spider | 2 |
| `d048c7e1` | Yuki was not scared | Yuki was not scared | HE was not scared | 2 |
| `73bd0a7f` | Mia fell down | Mia fell down | SHE fell down | 2 |
| `12b05695` | THEY wanted to save HER | Yuki and Kage wanted to save Mia | THEY wanted to save HER | 2 |
| `698c4e46` | Mia not hurt | Was Mia hurt? | No, SHE was not hurt | 2 |
| `a33a7a6d` | The spider is big | The spider is big | IT is big | 2 |
| `fdf3c813` | Is Arachne a monster? | Is Arachne a monster? | No, HE is not a monster | 2 |
| `76c28cbf` | The spider is scary | The spider is scary | IT is scary | 2 |
| `bb46be6c` | Mia and Arachne leave together | Mia and Arachne leave together | THEY leave together | 2 |
| `75414645` | Kage also has superpowers and armor | Kage also has superpowers and armor | HE also has superpowers and armor | 2 |
| `758f0de9` | They all meet  | The kids and the spider all meet again | THEY all meet again | 2 |
| `df12e0f8` | Arachne gives them the Echo Stone  | Arachne gives them the Echo Stone  | HE gives them the Echo Stone  | 2 |
| `912e35c4` | The Dragon controls the birds | The Dragon controls the birds | IT controls the birds | 2 |
| `6202b564` | The kids say goodbye and leave  | The kids say goodbye and leave | THEY say goodbye and leave | 2 |
| `1df41390` | The kids see a feather and the kids follow the feather  | The kids see a feather and the kids follow the feather  | THEY see a feather and THEY follow IT | 2 |

### Episode 4 — all 24 BCards

| ID | Name | Front | Back | Placements |
| --- | --- | --- | --- | ---: |
| `db1f9090` | ...ing | ing | ∅ | 5 |
| `7ac63d73` | verb | ACTION | walk | 2 |
| `dbffea43` | VERBing | ACTION+ing | WALKING | 2 |
| `1a84ce53` | talk | ACTION | talk | 2 |
| `4c9c13fd` | look | ACTION | look | 2 |
| `83658f4e` | TALKING | ACTION+ing | TALKING | 2 |
| `034faf67` | LOOKING | ACTION+ing | LOOKING | 2 |
| `945216b7` | run | ACTION | run | 2 |
| `c0dcdddd` | RUNNING | ACTION+ing | RUNNING | 2 |
| `28b28e9f` | What is Mia doing? | What is Mia doing? | ∅ | 5 |
| `8780215a` | Mia is walking | ACTION+ing | Mia is walking | 2 |
| `b819f0ca` | What is Yuki doing?  | What is Yuki doing? | ∅ | 5 |
| `cd714e3b` | Yuki is walking | ACTION+ing | Yuki is walking | 2 |
| `a4c04626` | What is Kage doing | What is Kage doing? | ∅ | 5 |
| `bc4d7352` | Kage is walking | ACTION+ing | Kage is walking | 2 |
| `abe987d2` | Mia is running | ACTION+ing | Mia is running | 2 |
| `6c2d532f` | Yuki is running | ACTION+ing | Yuki is running | 2 |
| `f8ee248a` | Kage is running | ACTION+ing | Kage is running | 2 |
| `f8a72fca` | What are the kids doing? | What are the kids doing? | ∅ | 6 |
| `9021ac65` | What is Mirai doing? | What is Mirai doing? | ∅ | 5 |
| `c51a4a18` | talk small | ? | talk | 9 |
| `4181ca56` | look small | ? | look | 2 |
| `d8333d37` | run small | ? | run | 4 |
| `a390e9d5` | walk small | ? | walk | 3 |

### Episode 5 — all 22 BCards

| ID | Name | Front | Back | Placements |
| --- | --- | --- | --- | ---: |
| `c2cd986d` | What is happening? | ??????????? | What is happening? | 2 |
| `98c4eba2` | Kids walk to the volcano | Kids walk to the volcano | ∅ | 2 |
| `df8007df` | Kids look at volcano | Kids look at the volcano | ∅ | 3 |
| `5e4fd614` | Kage is curious  | Kage is curious | ∅ | 2 |
| `4b8921c6` | Kage is cute | Kage is cute | ∅ | 3 |
| `f67a03ea` | Kids meet Luma | Kids meet Luma | ∅ | 3 |
| `3a9a1bec` | Kids talk to Luma | Kids talk to Luma | ∅ | 2 |
| `bb59e13f` | They walk to the cave  | They walk to the cave  | ∅ | 2 |
| `6ceffad3` | They find the cave | They find the cave | ∅ | 3 |
| `8d27fbc8` | They walk in the cave | They walk in the cave | ∅ | 2 |
| `235df07b` | The Rat King is behind | The Rat King is behind | ∅ | 3 |
| `0bc90786` | The Rat King send rats | The Rat King send rats | ∅ | 2 |
| `8d97cb49` | The kids are ready | The kids are ready | ∅ | 2 |
| `353662fd` | It's full of rats | It's full of rats | ∅ | 2 |
| `efa05934` | Luma sends bubble | Luma sends bubble | ∅ | 3 |
| `ab28ff2c` | The rats are trapped | The rats are trapped | ∅ | 2 |
| `ef0fb4a8` | Kage saves Luma | Kage saves Luma | ∅ | 2 |
| `241aac0e` | They play bowling | They play bowling | ∅ | 3 |
| `28168c92` | The Rat King runs away | The Rat King runs away | ∅ | 2 |
| `e9ab0c56` | Mirai's brother is a prisoner | Mirai's brother is a prisoner | ∅ | 2 |
| `2a99a806` | Baby bird is a prisoner | Baby bird is a prisoner | ∅ | 2 |
| `1002a8d3` | Rat King says "I'm sorry" | Rat King says "I'm sorry" | ∅ | 3 |

### Episode 6 — all 23 BCards

| ID | Name | Front | Back | Placements |
| --- | --- | --- | --- | ---: |
| `c232e4dd` | Why is Mia angry? | Why is Mia angry? | Because Mirai is a traitor | 2 |
| `133e551c` | Because Mirai is cute | Because Mirai is cute | Wrong | 2 |
| `fa431a4d` | Because Mirai is a rabbit | Because Mirai is a rabbit | Wrong | 2 |
| `a99b7408` | Because Mirai is a traitor | Because Mirai is a traitor | Correct  | 2 |
| `543f02b8` | Why does the Dragon attack the kids? | Why does the Dragon attack the kids? | Because he want to keep the heart of the forest | 2 |
| `103390f9` | Because he wants to play with the kids | Because he wants to play with the kids | Wrong | 2 |
| `26f8b2da` | Because he wants to keep the Heart of the forest | Because he wants to keep the Heart of the forest | Wrong | 1 |
| `52e24e0e` | Because he wants to keep the Heart of the Forest | Because he wants to keep the Heart of the Forest | Correct  | 1 |
| `9736e814` | Because he wants to eat pizza | Because he wants to eat pizza | Wrong | 2 |
| `b4ee7f30` | Why is the first world strange? | Why is the first world strange? | Because it's made of clay | 2 |
| `9a08566e` | Because it's made of cookies | Because it's made of cookies | Wrong | 2 |
| `31adfca8` | Because it's underwater | Because it's underwater | Wrong | 2 |
| `95c4da73` | Because it's made of clay | Because it's made of clay | Correct  | 2 |
| `7c4e58f5` | Why can they erase the second world? | Why can they erase the second world? | Because it's made of pencil  | 2 |
| `b5ee1d70` | Because it's made of pencil  | Because it's made of pencil  | Correct  | 2 |
| `8732d75b` | Because it's made of cookies (Copy) | Because it's made of cake | Wrong | 2 |
| `0b178b1e` | Because it's in the forest | Because it's in the forest | Wrong | 2 |
| `bfc35d1a` | Why is the last world blocky? | Why is the last world blocky? | Because it's a game world | 2 |
| `b020c8eb` | Because it's a game world | Because it's a game world | Correct  | 2 |
| `981e9198` | Because it's in space | Because it's in space | Wrong | 2 |
| `8f87e090` | Because it's made from from chocolate  | Because it's made from from chocolate  | Wrong | 2 |
| `d020b9d6` | Why | Why | Because it's a game world | 2 |
| `9836878e` | Because  | Because  | Correct  | 2 |

## Excluded physical variants

| Physical path | Version | Slides | A / B | Reason excluded from six-episode count |
| --- | ---: | ---: | ---: | --- |
| `D:\AI\SET OUT\TWIN STAR\Tests\Ep 1 new save\project.json` | 2 | 0 | 0 / 0 | Test variant |
| `D:\AI\SET OUT\TWIN STAR\Tests\Ep 1 Test\project.json` | 3 | 21 | 0 / 0 | Test variant |
| `D:\AI\SET OUT\TWIN STAR\Tests\Ep 1 V19 mouse menu\project.json` | 2 | 0 | 0 / 0 | Test variant |
| `D:\AI\SET OUT\TWIN STAR\Tests\Ep1 Acard\project.json` | 3 | 27 | 1 / 1 | Test variant |
| `D:\AI\SET OUT\TWIN STAR\Tests\Ep1 V2 Boost\project.json` | 3 | 11 | 0 / 0 | Test variant |
| `D:\AI\SET OUT\TWIN STAR\EPISODE 4\test SS\project.json` | 4 | 89 | 1 / 24 | Test variant |
| `D:\AI\SET OUT\TWIN STAR\EPISODE 3\STORY STUDIO\test 3\project.json` | 4 | 80 | 1 / 27 | Test variant |
| `D:\AI\SET OUT\TWIN STAR\EPISODE 2\STUDIO\project.json` | 4 | 0 | 0 / 0 | Empty scaffold/remake or assets-contained project |
| `D:\AI\SET OUT\TWIN STAR\EPISODE 1\WIN APP\Ep 1\project.json` | 1 | 0 | 0 / 0 | Empty scaffold/remake or assets-contained project |
| `D:\AI\SET OUT\TWIN STAR\EPISODE 1\WIN APP\Ep 1 remake\project.json` | 1 | 0 | 0 / 0 | Empty scaffold/remake or assets-contained project |
| `D:\AI\SET OUT\TWIN STAR\EPISODE 1\WIN APP\Ep 1\assets\project.json` | 1 | 0 | 0 / 0 | Empty scaffold/remake or assets-contained project |
