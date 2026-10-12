import * as React from "react";
import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VFXProvider, useVFX } from "../VFXLayer";

vi.mock("@tsparticles/react", () => {
  return {
    default: ({
      particlesLoaded,
    }: {
      particlesLoaded?: (container: unknown) => void | Promise<void>;
    }) => {
      React.useEffect(() => {
        void particlesLoaded?.({});
      }, [particlesLoaded]);
      return React.createElement("div", { "data-testid": "mock-particles" });
    },
    initParticlesEngine: vi.fn(async (loader?: (engine: unknown) => Promise<void>) => {
      await loader?.({});
    }),
  };
});

vi.mock("@tsparticles/slim", () => ({
  loadSlim: vi.fn(async () => undefined),
}));

function TriggerConfettiOnMount() {
  const { triggerConfetti } = useVFX();

  useEffect(() => {
    triggerConfetti();
  }, [triggerConfetti]);

  return <div>ready</div>;
}

describe("VFXProvider", () => {
  it("does not crash when the particle container has no emitter API", async () => {
    render(
      <VFXProvider>
        <TriggerConfettiOnMount />
      </VFXProvider>,
    );

    await waitFor(() => {
      expect(document.body).toHaveTextContent("ready");
    });
  });
});
