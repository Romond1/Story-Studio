
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { miniGamePlugins } from "../miniGames/registry";
import { BOARD_DASH_ICONS } from "../data/boardDashAssets";
import { useBattleStore } from "../store/battleStore";
import type { BoardDashMedallionKind, CardData, CutsceneData, MiniGameId } from "../types/game";
import { BOARD_DASH_MEDALLION_KINDS } from "../types/game";

const BOARD_DASH_MEDALLION_LABELS: Record<BoardDashMedallionKind, string> = {
  move: "Move — do the on-camera action",
  bonus: "Bonus +1 — gain a point",
  back3: "Back 3 — move back 3 spaces",
  rollAgain: "Roll Again — take another turn",
  steal: "Steal — take a point from the opponent",
};

type EditSectionId =
  | "overview"
  | "introSetup"
  | "backgrounds"
  | "cards"
  | "cutscenes"
  | "actionItems"
  | "media"
  | "powerUpsRewards"
  | "settings";

interface EditSection {
  id: EditSectionId;
  label: string;
}

const EDIT_SECTIONS: EditSection[] = [
  { id: "overview", label: "Encounter / Overview" },
  { id: "introSetup", label: "Intro / Setup Screen" },
  { id: "backgrounds", label: "Game Backgrounds" },
  { id: "cards", label: "Cards" },
  { id: "cutscenes", label: "Cutscenes" },
  { id: "actionItems", label: "Board Dash" },
  { id: "media", label: "Hero / Villain Media" },
  { id: "powerUpsRewards", label: "Power-Ups / Rewards" },
  { id: "settings", label: "Settings" },
];

const ALL_GAMES: MiniGameId[] = ["memoryReveal", "matchPairs", "laneBattle", "openBox", "boardDash"];

function getTextValue(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
): string {
  return event.target.value;
}

function parseNumberValue(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugifyFileName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? slug : "boss-project";
}

function downloadTextFile(contents: string, fileName: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read file as text URL."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

interface UploadButtonProps {
  accept: string;
  label?: string;
  onFileSelected: (file: File) => void | Promise<void>;
}

function UploadButton({ accept, label = "Upload local file", onFileSelected }: UploadButtonProps) {
  return (
    <label className="upload-button">
      {label}
      <input
        className="upload-input"
        type="file"
        accept={accept}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          await onFileSelected(file);
        }}
      />
    </label>
  );
}

function buildCardDraft(card: CardData): CardData {
  return {
    ...card,
    miniGames: card.miniGames === undefined ? [...ALL_GAMES] : [...card.miniGames],
  };
}

function buildCutsceneDraft(cutscene: CutsceneData): CutsceneData {
  return {
    ...cutscene,
    tags: [...cutscene.tags],
  };
}

function CardPreview({ card, side }: { card: CardData | null; side: "front" | "back" }) {
  if (!card) {
    return <div className="edit-card-preview">Select a card to edit.</div>;
  }

  const imageSource =
    side === "front" ? card.frontImage || card.image : card.backImage || card.image || card.frontImage;
  const text = side === "front" ? card.frontText || card.title : card.backText || "Card Back";
  const alignment = card.textAlign ?? "center";

  return (
    <div
      className="edit-card-preview"
      style={{
        width: card.cardWidth ? `${card.cardWidth}px` : undefined,
        height: card.cardHeight ? `${card.cardHeight}px` : undefined,
      }}
    >
      <div className="edit-card-preview-label">{side === "front" ? "Front" : "Back"}</div>
      {imageSource ? <img src={imageSource} alt={`${card.title} ${side}`} /> : null}
      <strong
        style={{
          color: card.textColor || "#f4f4f4",
          fontSize: card.fontSize ? `${card.fontSize}px` : undefined,
          textAlign: alignment,
          width: "100%",
        }}
      >
        {text}
      </strong>
      <span>Value: {card.value}</span>
    </div>
  );
}

export function EditModeShell() {
  const encounter = useBattleStore((state) => state.activeEncounter);
  const cardLibrary = useBattleStore((state) => state.cardLibrary);
  const overlayState = useBattleStore((state) => state.overlayState);
  const setUIMode = useBattleStore((state) => state.setUIMode);
  const setEncounterName = useBattleStore((state) => state.setEncounterName);
  const updateIntroSetup = useBattleStore((state) => state.updateIntroSetup);
  const createIntroHeroOption = useBattleStore((state) => state.createIntroHeroOption);
  const updateIntroHeroOption = useBattleStore((state) => state.updateIntroHeroOption);
  const deleteIntroHeroOption = useBattleStore((state) => state.deleteIntroHeroOption);
  const setBackground = useBattleStore((state) => state.setBackground);
  const setGameBackground = useBattleStore((state) => state.setGameBackground);
  const setCardSelected = useBattleStore((state) => state.setCardSelected);
  const createCard = useBattleStore((state) => state.createCard);
  const updateCard = useBattleStore((state) => state.updateCard);
  const duplicateCard = useBattleStore((state) => state.duplicateCard);
  const deleteCard = useBattleStore((state) => state.deleteCard);
  const updateHero = useBattleStore((state) => state.updateHero);
  const updateVillain = useBattleStore((state) => state.updateVillain);
  const setRoundCount = useBattleStore((state) => state.setRoundCount);
  const setDifficulty = useBattleStore((state) => state.setDifficulty);
  const updateBattleSettings = useBattleStore((state) => state.updateBattleSettings);
  const updateBattleResolutionRules = useBattleStore((state) => state.updateBattleResolutionRules);
  const updatePointerHighlight = useBattleStore((state) => state.updatePointerHighlight);
  const toggleMiniGameEnabled = useBattleStore((state) => state.toggleMiniGameEnabled);
  const moveGameOrderItem = useBattleStore((state) => state.moveGameOrderItem);
  const createCutscene = useBattleStore((state) => state.createCutscene);
  const updateCutscene = useBattleStore((state) => state.updateCutscene);
  const duplicateCutscene = useBattleStore((state) => state.duplicateCutscene);
  const deleteCutscene = useBattleStore((state) => state.deleteCutscene);
  const createActionItem = useBattleStore((state) => state.createActionItem);
  const updateActionItem = useBattleStore((state) => state.updateActionItem);
  const deleteActionItem = useBattleStore((state) => state.deleteActionItem);
  const setBoardDashMedallionCount = useBattleStore((state) => state.setBoardDashMedallionCount);
  const setBoardDashCardLimit = useBattleStore((state) => state.setBoardDashCardLimit);
  const setBoardDashCardSelected = useBattleStore((state) => state.setBoardDashCardSelected);
  const createReward = useBattleStore((state) => state.createReward);
  const updateReward = useBattleStore((state) => state.updateReward);
  const duplicateReward = useBattleStore((state) => state.duplicateReward);
  const deleteReward = useBattleStore((state) => state.deleteReward);
  const createPowerUp = useBattleStore((state) => state.createPowerUp);
  const updatePowerUp = useBattleStore((state) => state.updatePowerUp);
  const duplicatePowerUp = useBattleStore((state) => state.duplicatePowerUp);
  const deletePowerUp = useBattleStore((state) => state.deletePowerUp);
  const exportProjectFile = useBattleStore((state) => state.exportProjectFile);
  const importProjectFile = useBattleStore((state) => state.importProjectFile);
  const saveEncounterToLocalStorage = useBattleStore((state) => state.saveEncounterToLocalStorage);
  const loadEncounterFromLocalStorage = useBattleStore((state) => state.loadEncounterFromLocalStorage);

  const [activeSection, setActiveSection] = useState<EditSectionId>("overview");
  const [selectedIntroHeroId, setSelectedIntroHeroId] = useState<string | null>(
    encounter.introSetup.heroes[0]?.id ?? null,
  );
  const [selectedCardId, setSelectedCardId] = useState<string | null>(cardLibrary[0]?.id ?? null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(
    encounter.rewards[0]?.id ?? null,
  );
  const [selectedPowerUpId, setSelectedPowerUpId] = useState<string | null>(
    encounter.powerUps[0]?.id ?? null,
  );
  const [selectedCutsceneId, setSelectedCutsceneId] = useState<string | null>(
    encounter.cutscenes[0]?.id ?? null,
  );
  const [cardDraft, setCardDraft] = useState<CardData | null>(
    cardLibrary[0] ? buildCardDraft(cardLibrary[0]) : null,
  );
  const [cutsceneDraft, setCutsceneDraft] = useState<CutsceneData | null>(
    encounter.cutscenes[0] ? buildCutsceneDraft(encounter.cutscenes[0]) : null,
  );
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [projectStatus, setProjectStatus] = useState<string>("");
  const [projectFileName, setProjectFileName] = useState<string>("(unsaved)");
  const [isFsApiAvailable] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      "showSaveFilePicker" in window &&
      "showOpenFilePicker" in window,
  );
  const fileHandleRef = useRef<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!cardLibrary.length) {
      setSelectedCardId(null);
      setCardDraft(null);
      return;
    }

    const hasSelected = selectedCardId && cardLibrary.some((card) => card.id === selectedCardId);
    const nextCardId = hasSelected ? selectedCardId : cardLibrary[0].id;
    if (nextCardId !== selectedCardId) {
      setSelectedCardId(nextCardId);
    }
    const sourceCard = cardLibrary.find((card) => card.id === nextCardId);
    if (sourceCard) {
      setCardDraft(buildCardDraft(sourceCard));
    }
  }, [cardLibrary, selectedCardId]);

  useEffect(() => {
    if (!encounter.introSetup.heroes.length) {
      setSelectedIntroHeroId(null);
      return;
    }
    if (!selectedIntroHeroId || !encounter.introSetup.heroes.some((hero) => hero.id === selectedIntroHeroId)) {
      setSelectedIntroHeroId(encounter.introSetup.heroes[0].id);
    }
  }, [encounter.introSetup.heroes, selectedIntroHeroId]);

  useEffect(() => {
    if (!encounter.rewards.length) {
      setSelectedRewardId(null);
      return;
    }
    if (!selectedRewardId || !encounter.rewards.some((reward) => reward.id === selectedRewardId)) {
      setSelectedRewardId(encounter.rewards[0].id);
    }
  }, [encounter.rewards, selectedRewardId]);

  useEffect(() => {
    if (!encounter.powerUps.length) {
      setSelectedPowerUpId(null);
      return;
    }
    if (!selectedPowerUpId || !encounter.powerUps.some((item) => item.id === selectedPowerUpId)) {
      setSelectedPowerUpId(encounter.powerUps[0].id);
    }
  }, [encounter.powerUps, selectedPowerUpId]);

  useEffect(() => {
    if (!encounter.cutscenes.length) {
      setSelectedCutsceneId(null);
      setCutsceneDraft(null);
      return;
    }
    const hasSelected =
      selectedCutsceneId && encounter.cutscenes.some((cutscene) => cutscene.id === selectedCutsceneId);
    const nextCutsceneId = hasSelected ? selectedCutsceneId : encounter.cutscenes[0].id;
    if (nextCutsceneId !== selectedCutsceneId) {
      setSelectedCutsceneId(nextCutsceneId);
    }
    const sourceCutscene = encounter.cutscenes.find((cutscene) => cutscene.id === nextCutsceneId);
    if (sourceCutscene) {
      setCutsceneDraft(buildCutsceneDraft(sourceCutscene));
    }
  }, [encounter.cutscenes, selectedCutsceneId]);

  const selectedCard = useMemo(
    () => cardLibrary.find((card) => card.id === selectedCardId) ?? null,
    [cardLibrary, selectedCardId],
  );

  const selectedIntroHero = useMemo(
    () => encounter.introSetup.heroes.find((hero) => hero.id === selectedIntroHeroId) ?? null,
    [encounter.introSetup.heroes, selectedIntroHeroId],
  );

  const selectedReward = useMemo(
    () => encounter.rewards.find((reward) => reward.id === selectedRewardId) ?? null,
    [encounter.rewards, selectedRewardId],
  );

  const selectedPowerUp = useMemo(
    () => encounter.powerUps.find((item) => item.id === selectedPowerUpId) ?? null,
    [encounter.powerUps, selectedPowerUpId],
  );

  const selectedCutscene = useMemo(
    () => encounter.cutscenes.find((cutscene) => cutscene.id === selectedCutsceneId) ?? null,
    [encounter.cutscenes, selectedCutsceneId],
  );

  const activeCardDraft = cardDraft ?? selectedCard;
  const activeCutsceneDraft = cutsceneDraft ?? selectedCutscene;
  const previousCardSource = useRef<CardData | null>(null);
  const previousCutsceneSource = useRef<CutsceneData | null>(null);

  useEffect(() => {
    // Import/load changes the source before the source-to-draft effect settles.
    // Do not autosave the previous draft into that newly selected/imported card.
    if (previousCardSource.current !== selectedCard) {
      previousCardSource.current = selectedCard;
      return;
    }
    if (!cardDraft || !selectedCard || cardDraft.id !== selectedCard.id) {
      return;
    }
    const source = buildCardDraft(selectedCard);
    if (JSON.stringify(cardDraft) === JSON.stringify(source)) {
      return;
    }
    updateCard(cardDraft.id, cardDraft);
  }, [cardDraft, selectedCard, updateCard]);

  useEffect(() => {
    if (previousCutsceneSource.current !== selectedCutscene) {
      previousCutsceneSource.current = selectedCutscene;
      return;
    }
    if (!cutsceneDraft || !selectedCutscene || cutsceneDraft.id !== selectedCutscene.id) {
      return;
    }
    const source = buildCutsceneDraft(selectedCutscene);
    if (JSON.stringify(cutsceneDraft) === JSON.stringify(source)) {
      return;
    }
    updateCutscene(cutsceneDraft.id, cutsceneDraft);
  }, [cutsceneDraft, selectedCutscene, updateCutscene]);

  const handleDataUrlUpload = async (
    file: File,
    onDone: (dataUrl: string) => void,
  ) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onDone(dataUrl);
      setUploadMessage(`Loaded ${file.name}`);
    } catch {
      setUploadMessage(`Failed to load ${file.name}`);
    }
  };

  const getProjectJson = (): { json: string; hasTransientBlobUrl: boolean } => {
    const payload = exportProjectFile();
    const json = JSON.stringify(payload, null, 2);
    return { json, hasTransientBlobUrl: json.includes("\"blob:") };
  };

  const handleSaveAsProject = async () => {
    const suggestedName = `${slugifyFileName(encounter.name)}.fbh-project.json`;
    const { json, hasTransientBlobUrl } = getProjectJson();
    const fsWindow = window as Window & {
      showSaveFilePicker?: (options?: unknown) => Promise<unknown>;
    };

    try {
      if (fsWindow.showSaveFilePicker) {
        const handle = (await fsWindow.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "Final Boss Hero Project",
              accept: { "application/json": [".json"] },
            },
          ],
        })) as {
          name?: string;
          createWritable: () => Promise<{ write: (chunk: string) => Promise<void>; close: () => Promise<void> }>;
        };
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        fileHandleRef.current = handle;
        setProjectFileName(handle.name ?? suggestedName);
        setProjectStatus(
          hasTransientBlobUrl
            ? "Project saved with warning: blob: URLs detected; replace with upload/data URL for reliable reload."
            : "Project saved.",
        );
      } else {
        downloadTextFile(json, suggestedName);
        fileHandleRef.current = null;
        setProjectFileName(suggestedName);
        setProjectStatus(
          hasTransientBlobUrl
            ? "Project downloaded with warning: blob: URLs detected; replace with upload/data URL for reliable reload."
            : "Project downloaded as JSON.",
        );
      }
      saveEncounterToLocalStorage(encounter.name);
    } catch (error) {
      const errName = error instanceof DOMException ? error.name : "";
      if (errName === "AbortError") {
        setProjectStatus("Save As canceled.");
        return;
      }
      // Native picker can fail in unsupported/embedded contexts: fall back to normal download.
      downloadTextFile(json, suggestedName);
      fileHandleRef.current = null;
      setProjectFileName(suggestedName);
      setProjectStatus("Native Save As failed; downloaded project JSON instead.");
      saveEncounterToLocalStorage(encounter.name);
    }
  };

  const handleSaveProject = async () => {
    const { json, hasTransientBlobUrl } = getProjectJson();
    const currentHandle = fileHandleRef.current as
      | {
          name?: string;
          createWritable: () => Promise<{
            write: (chunk: string) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }
      | null;
    if (!currentHandle) {
      await handleSaveAsProject();
      return;
    }
    try {
      const writable = await currentHandle.createWritable();
      await writable.write(json);
      await writable.close();
      setProjectFileName(currentHandle.name ?? projectFileName);
      setProjectStatus(
        hasTransientBlobUrl
          ? "Project saved with warning: blob: URLs detected; replace with upload/data URL for reliable reload."
          : "Project saved.",
      );
      saveEncounterToLocalStorage(encounter.name);
    } catch {
      setProjectStatus("Save failed. Try Save As.");
    }
  };

  const importFromText = (text: string, sourceName: string) => {
    try {
      const parsed = JSON.parse(text) as unknown;
      const result = importProjectFile(parsed);
      if (!result.ok) {
        setProjectStatus(result.error ?? "Invalid project file.");
        return;
      }
      setProjectFileName(sourceName);
      setProjectStatus(`Loaded ${sourceName}`);
      saveEncounterToLocalStorage(encounter.name);
    } catch {
      setProjectStatus("Load failed: file is not valid JSON.");
    }
  };

  const handleLoadFromFile = async (file: File) => {
    try {
      const text = await file.text();
      importFromText(text, file.name);
    } catch {
      setProjectStatus(`Failed to read ${file.name}`);
    }
  };

  const handleLoadProject = async () => {
    const fsWindow = window as Window & {
      showOpenFilePicker?: (options?: unknown) => Promise<unknown[]>;
    };
    try {
      if (fsWindow.showOpenFilePicker) {
        const handles = (await fsWindow.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Final Boss Hero Project",
              accept: { "application/json": [".json"] },
            },
          ],
        })) as Array<{ name?: string; getFile: () => Promise<File> }>;
        const handle = handles[0];
        if (!handle) return;
        const file = await handle.getFile();
        fileHandleRef.current = handle;
        await handleLoadFromFile(file);
        setProjectFileName(handle.name ?? file.name);
        return;
      }
      fileInputRef.current?.click();
    } catch (error) {
      const errName = error instanceof DOMException ? error.name : "";
      if (errName === "AbortError") {
        setProjectStatus("Load canceled.");
        return;
      }
      setProjectStatus("Native Load failed; using file import fallback.");
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="edit-shell">
      <header className="edit-shell-header">
        <div className="edit-header-title">
          <h1>Edit Mode Workspace</h1>
          <p>Build and configure encounters, cards, visuals, and rewards in one place.</p>
        </div>
        <div className="edit-header-actions">
          <button type="button" onClick={handleSaveProject}>
            Save
          </button>
          <button
            type="button"
            onClick={handleSaveAsProject}
          >
            Save As
          </button>
          <button type="button" onClick={handleLoadProject}>
            Load
          </button>
          <button type="button" onClick={() => loadEncounterFromLocalStorage()}>
            Load Last Local
          </button>
          <button
            type="button"
            onClick={() => setUIMode("play")}
          >
            Switch to Play Mode
          </button>
        </div>
      </header>

      <div className="edit-shell-status">
        <span>Encounter: {encounter.name}</span>
        <span>Project File: {projectFileName}</span>
        <span>File Access: {isFsApiAvailable ? "Native picker" : "Download/Import fallback"}</span>
        <span>Cards: {cardLibrary.length}</span>
        <span>Selected for encounter: {encounter.selectedCardIds.length}</span>
        <span>
          Save State: {overlayState === "saveConfirmation" ? "Saved to localStorage" : "Unsaved changes"}
        </span>
        {projectStatus ? <span>{projectStatus}</span> : null}
        {uploadMessage ? <span>{uploadMessage}</span> : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.fbh-project.json,application/json"
        style={{ display: "none" }}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          fileHandleRef.current = null;
          await handleLoadFromFile(file);
        }}
      />

      <div className="edit-shell-body">
        <aside className="edit-shell-sidebar">
          {EDIT_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={section.id === activeSection ? "is-active" : ""}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </aside>

        <section className="edit-shell-workspace">
          {activeSection === "overview" ? (
            <div className="editor-section">
              <h2>Encounter / Overview</h2>
              <div className="editor-grid two-col">
                <label>
                  Encounter Name
                  <input
                    value={encounter.name}
                    onChange={(event) => setEncounterName(getTextValue(event))}
                  />
                </label>
                <label>
                  Encounter ID
                  <input value={encounter.id} readOnly />
                </label>
                <div className="editor-stat-box">
                  <strong>Hero</strong>
                  <span>{encounter.hero.name}</span>
                </div>
                <div className="editor-stat-box">
                  <strong>Villain</strong>
                  <span>{encounter.villain.name}</span>
                </div>
                <div className="editor-stat-box">
                  <strong>Cards in Library</strong>
                  <span>{cardLibrary.length}</span>
                </div>
                <div className="editor-stat-box">
                  <strong>Cards Selected for Encounter</strong>
                  <span>{encounter.selectedCardIds.length}</span>
                </div>
                <div className="editor-stat-box">
                  <strong>Power-Ups</strong>
                  <span>{encounter.powerUps.length}</span>
                </div>
                <div className="editor-stat-box">
                  <strong>Rewards</strong>
                  <span>{encounter.rewards.length}</span>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "introSetup" ? (
            <div className="editor-section">
              <h2>Intro / Setup Screen</h2>
              <div className="editor-grid two-col">
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={encounter.introSetup.enabled}
                    onChange={(event) => updateIntroSetup({ enabled: event.target.checked })}
                  />
                  Enable Intro / Setup option in Play Mode
                </label>
                <label>
                  Intro Title
                  <input
                    value={encounter.introSetup.title}
                    onChange={(event) => updateIntroSetup({ title: getTextValue(event) })}
                  />
                </label>
                <label>
                  Intro Subtitle
                  <textarea
                    rows={2}
                    value={encounter.introSetup.subtitle}
                    onChange={(event) => updateIntroSetup({ subtitle: getTextValue(event) })}
                  />
                </label>
                <label>
                  Start Button Label
                  <input
                    value={encounter.introSetup.startButtonLabel}
                    onChange={(event) => updateIntroSetup({ startButtonLabel: getTextValue(event) })}
                  />
                </label>
              </div>

              <h3>Hero Options</h3>
              <div className="cards-editor-layout">
                <div className="cards-library-panel">
                  <div className="cards-toolbar">
                    <button
                      type="button"
                      onClick={() => {
                        const nextId = createIntroHeroOption();
                        setSelectedIntroHeroId(nextId);
                      }}
                    >
                      New Hero Option
                    </button>
                  </div>
                  <div className="cards-library-grid">
                    {encounter.introSetup.heroes.map((hero) => (
                      <button
                        key={hero.id}
                        type="button"
                        className={`card-item ${selectedIntroHeroId === hero.id ? "is-active" : ""}`}
                        onClick={() => setSelectedIntroHeroId(hero.id)}
                      >
                        <img src={hero.portrait} alt={hero.name} />
                        <div className="card-item-copy">
                          <strong>{hero.name}</strong>
                          <span>{hero.subtitle || "No subtitle"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card-detail-panel">
                  <h3>Selected Hero Option</h3>
                  {selectedIntroHero ? (
                    <div className="editor-grid">
                      <label>
                        Hero Name
                        <input
                          value={selectedIntroHero.name}
                          onChange={(event) =>
                            updateIntroHeroOption(selectedIntroHero.id, { name: getTextValue(event) })
                          }
                        />
                      </label>
                      <label>
                        Hero Subtitle
                        <input
                          value={selectedIntroHero.subtitle ?? ""}
                          onChange={(event) =>
                            updateIntroHeroOption(selectedIntroHero.id, { subtitle: getTextValue(event) })
                          }
                        />
                      </label>
                      <label>
                        Hero Portrait / Image
                        <input
                          value={selectedIntroHero.portrait}
                          onChange={(event) =>
                            updateIntroHeroOption(selectedIntroHero.id, { portrait: getTextValue(event) })
                          }
                        />
                        <UploadButton
                          accept="image/*"
                          onFileSelected={async (file) =>
                            handleDataUrlUpload(file, (dataUrl) => {
                              updateIntroHeroOption(selectedIntroHero.id, { portrait: dataUrl });
                            })
                          }
                        />
                      </label>
                      <label>
                        Hero Video (optional)
                        <input
                          value={selectedIntroHero.video ?? ""}
                          onChange={(event) =>
                            updateIntroHeroOption(selectedIntroHero.id, { video: getTextValue(event) })
                          }
                        />
                        <UploadButton
                          accept="video/*"
                          label="Upload local video"
                          onFileSelected={async (file) =>
                            handleDataUrlUpload(file, (dataUrl) => {
                              updateIntroHeroOption(selectedIntroHero.id, { video: dataUrl });
                            })
                          }
                        />
                      </label>
                      <div className="editor-thumb">
                        <span>Hero Option Preview</span>
                        <img src={selectedIntroHero.portrait} alt={`${selectedIntroHero.name} preview`} />
                      </div>
                      {selectedIntroHero.video ? (
                        <video
                          className="editor-video-preview"
                          src={selectedIntroHero.video}
                          controls
                          loop
                          muted
                        />
                      ) : null}
                      <div className="editor-actions-row">
                        <button
                          type="button"
                          onClick={() => deleteIntroHeroOption(selectedIntroHero.id)}
                          disabled={encounter.introSetup.heroes.length <= 1}
                        >
                          Delete Hero Option
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>No hero option selected.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "backgrounds" ? (
            <div className="editor-section">
              <h2>Game Backgrounds</h2>
              <div className="editor-grid two-col">
                <label>
                  Default Encounter Background
                  <input
                    value={encounter.background}
                    onChange={(event) => setBackground(getTextValue(event))}
                  />
                  <UploadButton
                    accept="image/*"
                    onFileSelected={async (file) =>
                      handleDataUrlUpload(file, (dataUrl) => {
                        setBackground(dataUrl);
                      })
                    }
                  />
                </label>
                <div className="editor-thumb">
                  <span>Default Preview</span>
                  <img src={encounter.background} alt="Default background preview" />
                </div>
                {miniGamePlugins.map((plugin) => {
                  const background = encounter.gameBackgrounds?.[plugin.id] ?? "";
                  return (
                    <div key={plugin.id} className="editor-row-card">
                      <label>
                        {plugin.title} Background
                        <input
                          value={background}
                          onChange={(event) => setGameBackground(plugin.id, getTextValue(event))}
                        />
                        <UploadButton
                          accept="image/*"
                          onFileSelected={async (file) =>
                            handleDataUrlUpload(file, (dataUrl) => {
                              setGameBackground(plugin.id, dataUrl);
                            })
                          }
                        />
                      </label>
                      <div className="editor-thumb small">
                        <img src={background || encounter.background} alt={`${plugin.title} preview`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {activeSection === "cards" ? (
            <div className="editor-section fill">
              <h2>Card Library</h2>
              <div className="cards-editor-layout">
                <div className="cards-library-panel">
                  <div className="cards-toolbar">
                    <button
                      type="button"
                      onClick={() => {
                        const newCardId = createCard();
                        setSelectedCardId(newCardId);
                      }}
                    >
                      New Card
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedCardId) {
                          return;
                        }
                        const nextCardId = duplicateCard(selectedCardId);
                        if (nextCardId) {
                          setSelectedCardId(nextCardId);
                        }
                      }}
                      disabled={!selectedCardId}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedCardId) {
                          return;
                        }
                        deleteCard(selectedCardId);
                      }}
                      disabled={!selectedCardId}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="cards-library-grid">
                    {cardLibrary.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className={`card-item ${card.id === selectedCardId ? "is-active" : ""}`}
                        onClick={() => setSelectedCardId(card.id)}
                      >
                        <img src={card.frontImage || card.image} alt={card.title} />
                        <div className="card-item-copy">
                          <strong>{card.title}</strong>
                          <span>Value: {card.value}</span>
                          <span>Pair: {card.pairId}</span>
                          <label className="inline-check" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={encounter.selectedCardIds.includes(card.id)}
                              onChange={(event) => setCardSelected(card.id, event.target.checked)}
                            />
                            Use
                          </label>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card-detail-panel">
                  <h3>Card Detail Editor</h3>
                  {activeCardDraft ? (
                    <>
                      <div className="card-preview-grid">
                        <CardPreview card={activeCardDraft} side="front" />
                        <CardPreview card={activeCardDraft} side="back" />
                      </div>

                      <div className="editor-grid two-col">
                        <label>
                          Title
                          <input
                            value={activeCardDraft.title}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                title: getTextValue(event),
                              })
                            }
                          />
                        </label>
                        <label>
                          Value
                          <input
                            type="number"
                            value={activeCardDraft.value}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                value: parseNumberValue(event.target.value, activeCardDraft.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Image
                          <input
                            value={activeCardDraft.image}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                image: getTextValue(event),
                              })
                            }
                          />
                          <UploadButton
                            accept="image/*"
                            onFileSelected={async (file) =>
                              handleDataUrlUpload(file, (dataUrl) => {
                                setCardDraft({
                                  ...activeCardDraft,
                                  image: dataUrl,
                                });
                              })
                            }
                          />
                        </label>
                        <label>
                          Pair ID
                          <input
                            value={activeCardDraft.pairId}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                pairId: getTextValue(event),
                              })
                            }
                          />
                        </label>
                        <label>
                          Front Image
                          <input
                            value={activeCardDraft.frontImage ?? ""}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                frontImage: getTextValue(event),
                              })
                            }
                          />
                          <UploadButton
                            accept="image/*"
                            onFileSelected={async (file) =>
                              handleDataUrlUpload(file, (dataUrl) => {
                                setCardDraft({
                                  ...activeCardDraft,
                                  frontImage: dataUrl,
                                });
                              })
                            }
                          />
                        </label>
                        <label>
                          Back Image
                          <input
                            value={activeCardDraft.backImage ?? ""}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                backImage: getTextValue(event),
                              })
                            }
                          />
                          <UploadButton
                            accept="image/*"
                            onFileSelected={async (file) =>
                              handleDataUrlUpload(file, (dataUrl) => {
                                setCardDraft({
                                  ...activeCardDraft,
                                  backImage: dataUrl,
                                });
                              })
                            }
                          />
                        </label>
                        <label>
                          Front Text
                          <input
                            value={activeCardDraft.frontText ?? ""}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                frontText: getTextValue(event),
                              })
                            }
                          />
                        </label>
                        <label>
                          Back Text
                          <input
                            value={activeCardDraft.backText ?? ""}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                backText: getTextValue(event),
                              })
                            }
                          />
                        </label>
                        <label>
                          Font Color
                          <input
                            value={activeCardDraft.textColor ?? ""}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                textColor: getTextValue(event),
                              })
                            }
                          />
                        </label>
                        <label>
                          Font Size
                          <input
                            type="number"
                            value={activeCardDraft.fontSize ?? 16}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                fontSize: parseNumberValue(event.target.value, 16),
                              })
                            }
                          />
                        </label>
                        <label>
                          Text Align
                          <select
                            value={activeCardDraft.textAlign ?? "center"}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                textAlign: event.target.value as CardData["textAlign"],
                              })
                            }
                          >
                            <option value="left">left</option>
                            <option value="center">center</option>
                            <option value="right">right</option>
                          </select>
                        </label>
                        <label>
                          Tags (comma separated)
                          <input
                            value={activeCardDraft.tags.join(", ")}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                tags: parseTags(getTextValue(event)),
                              })
                            }
                          />
                        </label>
                        <label>
                          Card Width
                          <input
                            type="number"
                            value={activeCardDraft.cardWidth ?? 220}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                cardWidth: parseNumberValue(event.target.value, 220),
                              })
                            }
                          />
                        </label>
                        <label>
                          Card Height
                          <input
                            type="number"
                            value={activeCardDraft.cardHeight ?? 300}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                cardHeight: parseNumberValue(event.target.value, 300),
                              })
                            }
                          />
                        </label>
                        <label className="full-span">
                          Description
                          <textarea
                            rows={3}
                            value={activeCardDraft.description ?? ""}
                            onChange={(event) =>
                              setCardDraft({
                                ...activeCardDraft,
                                description: getTextValue(event),
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="editor-inline-check-grid">
                        {miniGamePlugins.map((plugin) => {
                          const selected = (activeCardDraft.miniGames ?? []).includes(plugin.id);
                          return (
                            <label key={plugin.id} className="inline-check">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => {
                                  const miniGames = new Set(activeCardDraft.miniGames ?? []);
                                  if (event.target.checked) {
                                    miniGames.add(plugin.id);
                                  } else {
                                    miniGames.delete(plugin.id);
                                  }
                                  setCardDraft({
                                    ...activeCardDraft,
                                    miniGames: Array.from(miniGames),
                                  });
                                }}
                              />
                              Used in {plugin.title}
                            </label>
                          );
                        })}
                      </div>

                      <p className="editor-autosave-hint">Card edits are saved automatically.</p>
                    </>
                  ) : (
                    <p>No card selected.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "cutscenes" ? (
            <div className="editor-section fill">
              <h2>Cutscenes</h2>
              <div className="inventory-layout">
                <div className="inventory-column">
                  <div className="inventory-toolbar">
                    <h3>Cutscene Library</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const id = createCutscene();
                        setSelectedCutsceneId(id);
                      }}
                    >
                      New
                    </button>
                  </div>
                  <div className="inventory-list">
                    {encounter.cutscenes.map((cutscene) => (
                      <button
                        key={cutscene.id}
                        type="button"
                        className={cutscene.id === selectedCutsceneId ? "is-active" : ""}
                        onClick={() => setSelectedCutsceneId(cutscene.id)}
                      >
                        <strong>{cutscene.name}</strong>
                        <span>{cutscene.mediaType}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="inventory-column cutscene-detail-column">
                  <h3>Cutscene Detail</h3>
                  {activeCutsceneDraft ? (
                    <div className="editor-grid">
                      <label>
                        Name / Title
                        <input
                          value={activeCutsceneDraft.name}
                          onChange={(event) =>
                            setCutsceneDraft({
                              ...activeCutsceneDraft,
                              name: getTextValue(event),
                            })
                          }
                        />
                      </label>
                      <label>
                        Media Type
                        <select
                          value={activeCutsceneDraft.mediaType}
                          onChange={(event) =>
                            setCutsceneDraft({
                              ...activeCutsceneDraft,
                              mediaType: event.target.value as CutsceneData["mediaType"],
                            })
                          }
                        >
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                      </label>
                      <label>
                        Media Source
                        <input
                          value={activeCutsceneDraft.mediaSource}
                          onChange={(event) =>
                            setCutsceneDraft({
                              ...activeCutsceneDraft,
                              mediaSource: getTextValue(event),
                            })
                          }
                        />
                        <UploadButton
                          accept={activeCutsceneDraft.mediaType === "video" ? "video/*" : "image/*"}
                          label={
                            activeCutsceneDraft.mediaType === "video"
                              ? "Upload local video"
                              : "Upload local image"
                          }
                          onFileSelected={async (file) =>
                            handleDataUrlUpload(file, (dataUrl) => {
                              setCutsceneDraft({
                                ...activeCutsceneDraft,
                                mediaSource: dataUrl,
                              });
                            })
                          }
                        />
                      </label>
                      <label>
                        Tags / Assignments
                        <input
                          value={activeCutsceneDraft.tags.join(", ")}
                          onChange={(event) =>
                            setCutsceneDraft({
                              ...activeCutsceneDraft,
                              tags: parseTags(getTextValue(event)),
                            })
                          }
                        />
                      </label>
                      <label className="full-span">
                        Description
                        <textarea
                          rows={3}
                          value={activeCutsceneDraft.description ?? ""}
                          onChange={(event) =>
                            setCutsceneDraft({
                              ...activeCutsceneDraft,
                              description: getTextValue(event),
                            })
                          }
                        />
                      </label>
                      <div className="editor-thumb">
                        <span>Preview</span>
                        {activeCutsceneDraft.mediaType === "video" ? (
                          <video className="editor-video-preview" src={activeCutsceneDraft.mediaSource} controls />
                        ) : (
                          <img src={activeCutsceneDraft.mediaSource} alt={activeCutsceneDraft.name} />
                        )}
                      </div>
                      <div className="editor-actions-row">
                        <button
                          type="button"
                          onClick={() => {
                            const nextId = duplicateCutscene(activeCutsceneDraft.id);
                            if (nextId) {
                              setSelectedCutsceneId(nextId);
                            }
                          }}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCutscene(activeCutsceneDraft.id)}
                        >
                          Delete
                        </button>
                      </div>
                      <p className="editor-autosave-hint">Cutscene edits are saved automatically.</p>
                    </div>
                  ) : (
                    <p>No cutscene selected.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "actionItems" ? (
            <div className="editor-section fill board-dash-editor-section">
              <h2>Board Dash</h2>
              <div className="board-dash-columns board-dash-columns--three">
                <div className="board-dash-col board-dash-col--actions">
                  <div className="inventory-toolbar">
                    <h3>Move Actions ({encounter.actionItems.length})</h3>
                    <button type="button" onClick={() => createActionItem()}>
                      New Action
                    </button>
                  </div>
                  <p className="editor-autosave-hint">
                    What a Move medallion asks the player to do on camera. Saved automatically.
                  </p>
                  <div className="action-item-list">
                    {encounter.actionItems.map((item) => (
                      <div key={item.id} className="action-item-row">
                        <input
                          className="action-item-emoji"
                          value={item.emoji ?? ""}
                          maxLength={4}
                          placeholder="🎭"
                          aria-label="Emoji"
                          onChange={(event) => updateActionItem(item.id, { emoji: getTextValue(event) })}
                        />
                        <input
                          className="action-item-text"
                          value={item.text}
                          placeholder="e.g. Touch something blue"
                          aria-label="Action text"
                          onChange={(event) => updateActionItem(item.id, { text: getTextValue(event) })}
                        />
                        <button type="button" onClick={() => deleteActionItem(item.id)}>
                          ✕
                        </button>
                      </div>
                    ))}
                    {encounter.actionItems.length === 0 ? (
                      <p>No action items yet. Add a few on-camera challenges.</p>
                    ) : null}
                  </div>
                </div>

                <div className="board-dash-col board-dash-col--medallions">
                  <h3>Medallions</h3>
                  <p className="editor-autosave-hint">
                    Tick which medallion tiles can appear, and how many of each go on the board. They're spread out
                    automatically so the same kind never sits next to itself.
                  </p>
                  <div className="board-dash-medallion-list">
                    {BOARD_DASH_MEDALLION_KINDS.map((kind) => {
                      const count = encounter.boardDashMedallionCounts[kind] ?? 0;
                      const enabled = count > 0;
                      return (
                        <div key={kind} className={`board-dash-medallion-row ${enabled ? "is-used" : ""}`}>
                          <label className="board-dash-medallion-pick">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(event) =>
                                setBoardDashMedallionCount(kind, event.target.checked ? Math.max(1, count) : 0)
                              }
                            />
                            <img src={BOARD_DASH_ICONS[kind]} alt="" />
                            <span>{BOARD_DASH_MEDALLION_LABELS[kind]}</span>
                          </label>
                          <div className="number-stepper number-stepper--sm">
                            <button
                              type="button"
                              aria-label={`Decrease ${kind} count`}
                              onClick={() => setBoardDashMedallionCount(kind, count - 1)}
                              disabled={count <= 0}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              step={1}
                              value={count}
                              onChange={(event) => setBoardDashMedallionCount(kind, parseNumberValue(getTextValue(event), 0))}
                            />
                            <button
                              type="button"
                              aria-label={`Increase ${kind} count`}
                              onClick={() => setBoardDashMedallionCount(kind, count + 1)}
                              disabled={count >= 20}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="editor-autosave-hint">
                    Start and Finish tiles are always included once each — they mark the beginning and goal of the
                    track.
                  </p>
                </div>

                <div className="board-dash-col board-dash-col--cards">
                  <div className="board-dash-tiles">
                    <span>Cards per game</span>
                    <div className="number-stepper">
                      <button
                        type="button"
                        aria-label="Decrease cards per game"
                        onClick={() => setBoardDashCardLimit(encounter.boardDashCardLimit - 1)}
                        disabled={encounter.boardDashCardLimit <= 0}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={encounter.boardDashCardIds.length}
                        step={1}
                        value={encounter.boardDashCardLimit}
                        onChange={(event) => setBoardDashCardLimit(parseNumberValue(getTextValue(event), 0))}
                      />
                      <button
                        type="button"
                        aria-label="Increase cards per game"
                        onClick={() => setBoardDashCardLimit(encounter.boardDashCardLimit + 1)}
                        disabled={encounter.boardDashCardLimit >= encounter.boardDashCardIds.length}
                      >
                        +
                      </button>
                    </div>
                    <small>of {encounter.boardDashCardIds.length} ticked</small>
                  </div>

                  <h3>
                    Cards & Questions ({encounter.boardDashCardIds.length}/{cardLibrary.length})
                  </h3>
                  <p className="editor-autosave-hint">
                    Tick the cards to use on Board Dash card tiles, then write the question shown when a player lands on it.
                  </p>
                  <div className="board-dash-card-list">
                    {cardLibrary.map((card) => {
                      const used = encounter.boardDashCardIds.includes(card.id);
                      return (
                        <div key={card.id} className={`board-dash-card-row ${used ? "is-used" : ""}`}>
                          <label className="board-dash-card-pick">
                            <input
                              type="checkbox"
                              checked={used}
                              onChange={(event) => setBoardDashCardSelected(card.id, event.target.checked)}
                            />
                            <img src={card.image} alt="" />
                            <span>{card.title}</span>
                          </label>
                          <input
                            className="board-dash-card-question"
                            value={card.boardDashQuestion ?? ""}
                            placeholder="Question about this card…"
                            aria-label={`Question for ${card.title}`}
                            disabled={!used}
                            onChange={(event) => updateCard(card.id, { boardDashQuestion: getTextValue(event) })}
                          />
                        </div>
                      );
                    })}
                    {cardLibrary.length === 0 ? <p>No cards in the library yet.</p> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "media" ? (
            <div className="editor-section">
              <h2>Hero / Villain Media</h2>
              <div className="editor-grid two-col">
                <label>
                  Hero Name
                  <input
                    value={encounter.hero.name}
                    onChange={(event) => updateHero({ name: getTextValue(event) })}
                  />
                </label>
                <label>
                  Villain Name
                  <input
                    value={encounter.villain.name}
                    onChange={(event) => updateVillain({ name: getTextValue(event) })}
                  />
                </label>
                <label>
                  Hero Image URL
                  <input
                    value={encounter.hero.portrait}
                    onChange={(event) => updateHero({ portrait: getTextValue(event) })}
                  />
                  <UploadButton
                    accept="image/*"
                    onFileSelected={async (file) =>
                      handleDataUrlUpload(file, (dataUrl) => {
                        updateHero({ portrait: dataUrl });
                      })
                    }
                  />
                </label>
                <label>
                  Villain Image URL
                  <input
                    value={encounter.villain.portrait}
                    onChange={(event) => updateVillain({ portrait: getTextValue(event) })}
                  />
                  <UploadButton
                    accept="image/*"
                    onFileSelected={async (file) =>
                      handleDataUrlUpload(file, (dataUrl) => {
                        updateVillain({ portrait: dataUrl });
                      })
                    }
                  />
                </label>
                <label>
                  Hero Video URL (optional looping source)
                  <input
                    value={encounter.hero.video ?? ""}
                    onChange={(event) => updateHero({ video: getTextValue(event) })}
                  />
                  <UploadButton
                    accept="video/*"
                    label="Upload local video"
                    onFileSelected={async (file) =>
                      handleDataUrlUpload(file, (dataUrl) => {
                        updateHero({ video: dataUrl });
                      })
                    }
                  />
                </label>
                <label>
                  Villain Video URL (optional looping source)
                  <input
                    value={encounter.villain.video ?? ""}
                    onChange={(event) => updateVillain({ video: getTextValue(event) })}
                  />
                  <UploadButton
                    accept="video/*"
                    label="Upload local video"
                    onFileSelected={async (file) =>
                      handleDataUrlUpload(file, (dataUrl) => {
                        updateVillain({ video: dataUrl });
                      })
                    }
                  />
                </label>
                <div className="editor-thumb">
                  <span>Hero Preview</span>
                  <img src={encounter.hero.portrait} alt="Hero preview" />
                  {encounter.hero.video ? (
                    <video className="editor-video-preview" src={encounter.hero.video} controls loop muted />
                  ) : null}
                </div>
                <div className="editor-thumb">
                  <span>Villain Preview</span>
                  <img src={encounter.villain.portrait} alt="Villain preview" />
                  {encounter.villain.video ? (
                    <video className="editor-video-preview" src={encounter.villain.video} controls loop muted />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "powerUpsRewards" ? (
            <div className="editor-section fill">
              <h2>Power-Ups / Rewards</h2>
              <div className="powerups-rewards-layout">
                <div className="powerups-rewards-list-panel">
                  <div className="powerups-rewards-group">
                    <div className="inventory-toolbar">
                      <h3>Rewards</h3>
                      <button
                        type="button"
                        onClick={() => {
                          const id = createReward();
                          setSelectedRewardId(id);
                        }}
                      >
                        New
                      </button>
                    </div>
                    <div className="inventory-list">
                      {encounter.rewards.map((reward) => (
                        <button
                          key={reward.id}
                          type="button"
                          className={reward.id === selectedRewardId ? "is-active" : ""}
                          onClick={() => setSelectedRewardId(reward.id)}
                        >
                          <strong>{reward.name}</strong>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="powerups-rewards-group">
                    <div className="inventory-toolbar">
                      <h3>Power-Ups / Gear</h3>
                      <button
                        type="button"
                        onClick={() => {
                          const id = createPowerUp();
                          setSelectedPowerUpId(id);
                        }}
                      >
                        New
                      </button>
                    </div>
                    <div className="inventory-list">
                      {encounter.powerUps.map((powerUp) => (
                        <button
                          key={powerUp.id}
                          type="button"
                          className={powerUp.id === selectedPowerUpId ? "is-active" : ""}
                          onClick={() => setSelectedPowerUpId(powerUp.id)}
                        >
                          <strong>{powerUp.name}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="powerups-rewards-detail-split">
                  <div className="powerups-rewards-detail-panel">
                    <h3>Reward Details</h3>
                    {selectedReward ? (
                      <div className="editor-grid">
                        <label>
                          Name
                          <input
                            value={selectedReward.name}
                            onChange={(event) =>
                              updateReward(selectedReward.id, { name: getTextValue(event) })
                            }
                          />
                        </label>
                        <label>
                          Description
                          <textarea
                            rows={2}
                            value={selectedReward.description}
                            onChange={(event) =>
                              updateReward(selectedReward.id, { description: getTextValue(event) })
                            }
                          />
                        </label>
                        <label>
                          Value
                          <input
                            type="number"
                            value={selectedReward.value}
                            onChange={(event) =>
                              updateReward(selectedReward.id, {
                                value: parseNumberValue(event.target.value, selectedReward.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Category
                          <input
                            value={selectedReward.category ?? ""}
                            onChange={(event) =>
                              updateReward(selectedReward.id, { category: getTextValue(event) })
                            }
                          />
                        </label>
                        <label>
                          Icon / Image
                          <input
                            value={selectedReward.icon ?? ""}
                            onChange={(event) =>
                              updateReward(selectedReward.id, { icon: getTextValue(event) })
                            }
                          />
                          <UploadButton
                            accept="image/*"
                            onFileSelected={async (file) =>
                              handleDataUrlUpload(file, (dataUrl) => {
                                updateReward(selectedReward.id, { icon: dataUrl });
                              })
                            }
                          />
                        </label>
                        <label>
                          Effect Type (placeholder)
                          <input
                            value={selectedReward.effectType ?? ""}
                            onChange={(event) =>
                              updateReward(selectedReward.id, { effectType: getTextValue(event) })
                            }
                          />
                        </label>
                        {selectedReward.icon ? (
                          <div className="editor-thumb small">
                            <span>Reward Icon Preview</span>
                            <img src={selectedReward.icon} alt={`${selectedReward.name} icon`} />
                          </div>
                        ) : null}
                        <label>
                          Effect Value (placeholder)
                          <input
                            type="number"
                            value={selectedReward.effectValue ?? 0}
                            onChange={(event) =>
                              updateReward(selectedReward.id, {
                                effectValue: parseNumberValue(event.target.value, 0),
                              })
                            }
                          />
                        </label>
                        <div className="editor-inline-check-grid">
                          {miniGamePlugins.map((plugin) => (
                            <label key={plugin.id} className="inline-check">
                              <input
                                type="checkbox"
                                checked={(selectedReward.applicableGames ?? []).includes(plugin.id)}
                                onChange={(event) => {
                                  const next = new Set(selectedReward.applicableGames ?? []);
                                  if (event.target.checked) {
                                    next.add(plugin.id);
                                  } else {
                                    next.delete(plugin.id);
                                  }
                                  updateReward(selectedReward.id, {
                                    applicableGames: Array.from(next),
                                  });
                                }}
                              />
                              {plugin.title}
                            </label>
                          ))}
                        </div>
                        <div className="editor-actions-row">
                          <button
                            type="button"
                            onClick={() => {
                              const nextId = duplicateReward(selectedReward.id);
                              if (nextId) {
                                setSelectedRewardId(nextId);
                              }
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteReward(selectedReward.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>No reward selected.</p>
                    )}
                  </div>

                  <div className="powerups-rewards-detail-panel">
                    <h3>Power-Up Details</h3>
                    {selectedPowerUp ? (
                      <div className="editor-grid">
                        <label>
                          Name
                          <input
                            value={selectedPowerUp.name}
                            onChange={(event) =>
                              updatePowerUp(selectedPowerUp.id, { name: getTextValue(event) })
                            }
                          />
                        </label>
                        <label>
                          Description
                          <textarea
                            rows={2}
                            value={selectedPowerUp.description}
                            onChange={(event) =>
                              updatePowerUp(selectedPowerUp.id, {
                                description: getTextValue(event),
                              })
                            }
                          />
                        </label>
                        <label>
                          Charges
                          <input
                            type="number"
                            value={selectedPowerUp.charges}
                            onChange={(event) =>
                              updatePowerUp(selectedPowerUp.id, {
                                charges: Math.max(
                                  0,
                                  parseNumberValue(event.target.value, selectedPowerUp.charges),
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Energy Cost
                          <input
                            type="number"
                            value={selectedPowerUp.energyCost ?? 0}
                            onChange={(event) =>
                              updatePowerUp(selectedPowerUp.id, {
                                energyCost: Math.max(0, parseNumberValue(event.target.value, 0)),
                              })
                            }
                          />
                        </label>
                        <label>
                          Category
                          <input
                            value={selectedPowerUp.category ?? ""}
                            onChange={(event) =>
                              updatePowerUp(selectedPowerUp.id, { category: getTextValue(event) })
                            }
                          />
                        </label>
                        <label>
                          Icon / Image
                          <input
                            value={selectedPowerUp.icon ?? ""}
                            onChange={(event) =>
                              updatePowerUp(selectedPowerUp.id, { icon: getTextValue(event) })
                            }
                          />
                          <UploadButton
                            accept="image/*"
                            onFileSelected={async (file) =>
                              handleDataUrlUpload(file, (dataUrl) => {
                                updatePowerUp(selectedPowerUp.id, { icon: dataUrl });
                              })
                            }
                          />
                        </label>
                        <label>
                          Effect Type
                          <select
                            value={selectedPowerUp.effectType ?? ""}
                            onChange={(event) =>
                              updatePowerUp(selectedPowerUp.id, { effectType: getTextValue(event) })
                            }
                          >
                            <option value="">(none)</option>
                            <option value="heal">heal</option>
                            <option value="peek">peek</option>
                            <option value="shield">shield</option>
                            <option value="powerBoost">powerBoost</option>
                            <option value="retry">retry</option>
                          </select>
                        </label>
                        {selectedPowerUp.icon ? (
                          <div className="editor-thumb small">
                            <span>Power-Up Icon Preview</span>
                            <img src={selectedPowerUp.icon} alt={`${selectedPowerUp.name} icon`} />
                          </div>
                        ) : null}
                        <label>
                          Effect Value
                          <input
                            type="number"
                            value={selectedPowerUp.effectValue ?? 0}
                            onChange={(event) =>
                              updatePowerUp(selectedPowerUp.id, {
                                effectValue: parseNumberValue(event.target.value, 0),
                              })
                            }
                          />
                        </label>
                        <div className="editor-inline-check-grid">
                          {miniGamePlugins.map((plugin) => (
                            <label key={plugin.id} className="inline-check">
                              <input
                                type="checkbox"
                                checked={(selectedPowerUp.applicableGames ?? []).includes(plugin.id)}
                                onChange={(event) => {
                                  const next = new Set(selectedPowerUp.applicableGames ?? []);
                                  if (event.target.checked) {
                                    next.add(plugin.id);
                                  } else {
                                    next.delete(plugin.id);
                                  }
                                  updatePowerUp(selectedPowerUp.id, {
                                    applicableGames: Array.from(next),
                                  });
                                }}
                              />
                              {plugin.title}
                            </label>
                          ))}
                        </div>
                        <div className="editor-actions-row">
                          <button
                            type="button"
                            onClick={() => {
                              const nextId = duplicatePowerUp(selectedPowerUp.id);
                              if (nextId) {
                                setSelectedPowerUpId(nextId);
                              }
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deletePowerUp(selectedPowerUp.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>No power-up selected.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "settings" ? (
            <div className="editor-section">
              <h2>Settings</h2>
              <div className="editor-grid two-col">
                <label>
                  Round Count
                  <input
                    type="number"
                    min={1}
                    value={encounter.roundSettings.roundCount}
                    onChange={(event) => setRoundCount(parseNumberValue(event.target.value, 1))}
                  />
                </label>
                <label>
                  Difficulty
                  <select
                    value={encounter.roundSettings.difficulty}
                    onChange={(event) =>
                      setDifficulty(event.target.value as typeof encounter.roundSettings.difficulty)
                    }
                  >
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>

              <h3>Battle Resources</h3>
              <div className="editor-grid two-col">
                <label>
                  Hero Start HP
                  <input
                    type="number"
                    value={encounter.battleSettings.heroStartHp}
                    onChange={(event) =>
                      updateBattleSettings({ heroStartHp: parseNumberValue(event.target.value, 100) })
                    }
                  />
                </label>
                <label>
                  Hero Max HP
                  <input
                    type="number"
                    value={encounter.battleSettings.heroMaxHp}
                    onChange={(event) =>
                      updateBattleSettings({ heroMaxHp: parseNumberValue(event.target.value, 100) })
                    }
                  />
                </label>
                <label>
                  Hero Start Energy
                  <input
                    type="number"
                    value={encounter.battleSettings.heroStartEnergy}
                    onChange={(event) =>
                      updateBattleSettings({ heroStartEnergy: parseNumberValue(event.target.value, 50) })
                    }
                  />
                </label>
                <label>
                  Hero Max Energy
                  <input
                    type="number"
                    value={encounter.battleSettings.heroMaxEnergy}
                    onChange={(event) =>
                      updateBattleSettings({ heroMaxEnergy: parseNumberValue(event.target.value, 100) })
                    }
                  />
                </label>
                <label>
                  Villain Start HP
                  <input
                    type="number"
                    value={encounter.battleSettings.villainStartHp}
                    onChange={(event) =>
                      updateBattleSettings({ villainStartHp: parseNumberValue(event.target.value, 100) })
                    }
                  />
                </label>
                <label>
                  Villain Max HP
                  <input
                    type="number"
                    value={encounter.battleSettings.villainMaxHp}
                    onChange={(event) =>
                      updateBattleSettings({ villainMaxHp: parseNumberValue(event.target.value, 100) })
                    }
                  />
                </label>
                <label>
                  Villain Start Energy
                  <input
                    type="number"
                    value={encounter.battleSettings.villainStartEnergy}
                    onChange={(event) =>
                      updateBattleSettings({ villainStartEnergy: parseNumberValue(event.target.value, 60) })
                    }
                  />
                </label>
                <label>
                  Villain Max Energy
                  <input
                    type="number"
                    value={encounter.battleSettings.villainMaxEnergy}
                    onChange={(event) =>
                      updateBattleSettings({ villainMaxEnergy: parseNumberValue(event.target.value, 100) })
                    }
                  />
                </label>
              </div>

              <h3>Post Mini-Game Resolution Rules</h3>
              <div className="editor-grid two-col">
                <label>
                  Base Damage
                  <input
                    type="number"
                    value={encounter.battleSettings.resolution.baseDamage}
                    onChange={(event) =>
                      updateBattleResolutionRules({ baseDamage: parseNumberValue(event.target.value, 25) })
                    }
                  />
                </label>
                <label>
                  Bonus Damage Per Score
                  <input
                    type="number"
                    value={encounter.battleSettings.resolution.bonusDamagePerScore}
                    onChange={(event) =>
                      updateBattleResolutionRules({
                        bonusDamagePerScore: parseNumberValue(event.target.value, 2),
                      })
                    }
                  />
                </label>
                <label>
                  Draw Damage
                  <input
                    type="number"
                    value={encounter.battleSettings.resolution.drawDamage}
                    onChange={(event) =>
                      updateBattleResolutionRules({ drawDamage: parseNumberValue(event.target.value, 4) })
                    }
                  />
                </label>
                <label>
                  Participation Energy Cost
                  <input
                    type="number"
                    value={encounter.battleSettings.resolution.participationEnergyCost}
                    onChange={(event) =>
                      updateBattleResolutionRules({
                        participationEnergyCost: parseNumberValue(event.target.value, 0),
                      })
                    }
                  />
                </label>
                <label>
                  Winner Energy Gain
                  <input
                    type="number"
                    value={encounter.battleSettings.resolution.winnerEnergyGain}
                    onChange={(event) =>
                      updateBattleResolutionRules({
                        winnerEnergyGain: parseNumberValue(event.target.value, 10),
                      })
                    }
                  />
                </label>
                <label>
                  Loser Energy Loss
                  <input
                    type="number"
                    value={encounter.battleSettings.resolution.loserEnergyLoss}
                    onChange={(event) =>
                      updateBattleResolutionRules({
                        loserEnergyLoss: parseNumberValue(event.target.value, 0),
                      })
                    }
                  />
                </label>
                <label>
                  Draw Energy Gain
                  <input
                    type="number"
                    value={encounter.battleSettings.resolution.drawEnergyGain}
                    onChange={(event) =>
                      updateBattleResolutionRules({
                        drawEnergyGain: parseNumberValue(event.target.value, 2),
                      })
                    }
                  />
                </label>
              </div>

              <h3>Pointer Highlight</h3>
              <div className="editor-grid two-col">
                <label>
                  Toggle Shortcut
                  <input
                    type="text"
                    value={encounter.pointerHighlight.shortcut}
                    onChange={(event) => updatePointerHighlight({ shortcut: getTextValue(event) })}
                  />
                </label>
                <label>
                  Palette Toggle Shortcut
                  <input
                    type="text"
                    value={encounter.pointerHighlight.paletteShortcut}
                    onChange={(event) => updatePointerHighlight({ paletteShortcut: getTextValue(event) })}
                  />
                </label>
                <label>
                  Enabled By Default
                  <input
                    type="checkbox"
                    checked={encounter.pointerHighlight.enabledByDefault}
                    onChange={(event) =>
                      updatePointerHighlight({ enabledByDefault: event.target.checked })
                    }
                  />
                </label>
                <label>
                  Default Palette
                  <select
                    value={encounter.pointerHighlight.defaultPalette}
                    onChange={(event) =>
                      updatePointerHighlight({
                        defaultPalette:
                          event.target.value === "villain" ? "villain" : "kids",
                      })
                    }
                  >
                    <option value="kids">Kids</option>
                    <option value="villain">Villain</option>
                  </select>
                </label>
                <label>
                  Click Only Trail
                  <input
                    type="checkbox"
                    checked={encounter.pointerHighlight.clickOnly}
                    onChange={(event) => updatePointerHighlight({ clickOnly: event.target.checked })}
                  />
                </label>
                <label>
                  Kids Colors (comma)
                  <input
                    type="text"
                    value={encounter.pointerHighlight.kidsColors.join(", ")}
                    onChange={(event) =>
                      updatePointerHighlight({
                        kidsColors: event.target.value
                          .split(",")
                          .map((entry) => entry.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label>
                  Villain Colors (comma)
                  <input
                    type="text"
                    value={encounter.pointerHighlight.villainColors.join(", ")}
                    onChange={(event) =>
                      updatePointerHighlight({
                        villainColors: event.target.value
                          .split(",")
                          .map((entry) => entry.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label>
                  Ring Size
                  <input
                    type="number"
                    min={1}
                    value={encounter.pointerHighlight.ringSize}
                    onChange={(event) =>
                      updatePointerHighlight({ ringSize: parseNumberValue(event.target.value, 28) })
                    }
                  />
                </label>
                <label>
                  Trail Size
                  <input
                    type="number"
                    min={1}
                    value={encounter.pointerHighlight.trailSize}
                    onChange={(event) =>
                      updatePointerHighlight({ trailSize: parseNumberValue(event.target.value, 18) })
                    }
                  />
                </label>
                <label>
                  Trail Length
                  <input
                    type="number"
                    min={1}
                    value={encounter.pointerHighlight.trailLength}
                    onChange={(event) =>
                      updatePointerHighlight({ trailLength: parseNumberValue(event.target.value, 18) })
                    }
                  />
                </label>
                <label>
                  Fade Duration (ms)
                  <input
                    type="number"
                    min={1}
                    value={encounter.pointerHighlight.fadeMs}
                    onChange={(event) =>
                      updatePointerHighlight({ fadeMs: parseNumberValue(event.target.value, 420) })
                    }
                  />
                </label>
                <label>
                  Spawn Interval (ms)
                  <input
                    type="number"
                    min={1}
                    value={encounter.pointerHighlight.spawnMs}
                    onChange={(event) =>
                      updatePointerHighlight({ spawnMs: parseNumberValue(event.target.value, 28) })
                    }
                  />
                </label>
              </div>

              <h3>Enabled Mini-Games</h3>
              <div className="editor-inline-check-grid">
                {miniGamePlugins.map((plugin) => (
                  <label key={plugin.id} className="inline-check">
                    <input
                      type="checkbox"
                      checked={encounter.enabledMiniGames.includes(plugin.id)}
                      onChange={() => toggleMiniGameEnabled(plugin.id)}
                    />
                    {plugin.title}
                  </label>
                ))}
              </div>
              <h3>Game Order</h3>
              <div className="order-list">
                {encounter.gameOrder.map((gameId, index) => {
                  const plugin = miniGamePlugins.find((item) => item.id === gameId);
                  return (
                    <div key={gameId} className="order-row">
                      <span>
                        {index + 1}. {plugin?.title ?? gameId}
                      </span>
                      <div className="order-buttons">
                        <button type="button" onClick={() => moveGameOrderItem(index, -1)}>
                          Up
                        </button>
                        <button type="button" onClick={() => moveGameOrderItem(index, 1)}>
                          Down
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
