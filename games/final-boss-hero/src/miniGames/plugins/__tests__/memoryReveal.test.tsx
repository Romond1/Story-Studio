import { useState, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createBattleState } from "../../../battle/battleSystem";
import { DEFAULT_ENCOUNTER, SAMPLE_CARD_LIBRARY } from "../../../data/sampleData";
import { useBattleStore } from "../../../store/battleStore";
import { memoryRevealPlugin } from "../memoryReveal";

function MemoryRevealHarness() {
  const [headerAction, setHeaderAction] = useState<ReactNode | null>(null);
  const [scoreOverlay, setScoreOverlay] = useState<ReactNode | null>(null);
  const [transitionCue, setTransitionCue] = useState<unknown>(null);

  return (
    <div>
      <memoryRevealPlugin.Component
        encounter={DEFAULT_ENCOUNTER}
        progress={{ phase: "inProgress", currentRound: 1, completedMiniGames: [] }}
        scores={{ hero: 0, villain: 0 }}
        battleState={createBattleState(DEFAULT_ENCOUNTER.battleSettings)}
        onComplete={vi.fn()}
        setHeaderAction={setHeaderAction}
        setScoreOverlay={setScoreOverlay}
        setTransitionCue={setTransitionCue}
      />
      <div data-testid="header-action">{headerAction ? "set" : "unset"}</div>
      <div data-testid="score-overlay">{scoreOverlay ? "set" : "unset"}</div>
      <div data-testid="transition-cue">{transitionCue ? "set" : "unset"}</div>
    </div>
  );
}

describe("memoryRevealPlugin", () => {
  it("does not enter a maximum update depth loop when wiring header actions", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    useBattleStore.setState({
      cardLibrary: SAMPLE_CARD_LIBRARY,
      activeEncounter: DEFAULT_ENCOUNTER,
      battleEffects: {
        shieldCharges: { hero: 0, villain: 0 },
        peekCharges: { hero: 0, villain: 0 },
        powerBoostCharges: { hero: 0, villain: 0 },
        retryCharges: { hero: 0, villain: 0 },
      },
    });

    render(<MemoryRevealHarness />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent("Memory Reveal");
    });

    await new Promise((resolve) => window.setTimeout(resolve, 50));

    expect(
      consoleError.mock.calls.some((call) =>
        call.some(
          (arg) => typeof arg === "string" && arg.includes("Maximum update depth exceeded"),
        ),
      ),
    ).toBe(false);

    consoleError.mockRestore();
  });
});
