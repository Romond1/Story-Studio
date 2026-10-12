import { useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Container, ISourceOptions } from "@tsparticles/engine";

interface VFXApi {
  triggerConfetti: () => void;
  triggerImpact: (color?: string) => void;
  triggerSparkles: (color?: string) => void;
}

const VFXContext = createContext<VFXApi>({
  triggerConfetti: () => {},
  triggerImpact: () => {},
  triggerSparkles: () => {},
});

export function useVFX(): VFXApi {
  return useContext(VFXContext);
}

const CONFETTI_OPTIONS: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 60,
  particles: {
    number: { value: 0 },
    color: { value: ["#ff2244", "#00e5ff", "#ffd700", "#ff6b00", "#00ff88", "#9933ff", "#ff44aa"] },
    shape: { type: ["circle", "square"] },
    opacity: { value: { min: 0.6, max: 1 } },
    size: { value: { min: 4, max: 9 } },
    move: {
      enable: true,
      speed: { min: 12, max: 28 },
      direction: "top",
      outModes: { default: "destroy" },
      gravity: { enable: true, acceleration: 14 },
    },
    rotate: {
      value: { min: 0, max: 360 },
      animation: { enable: true, speed: 40 },
    },
    tilt: {
      enable: true,
      value: { min: 0, max: 360 },
      animation: { enable: true, speed: 30 },
    },
    life: { duration: { value: 3 }, count: 1 },
  },
  emitters: [],
};

const IMPACT_OPTIONS: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 60,
  particles: {
    number: { value: 0 },
    color: { value: "#00e5ff" },
    shape: { type: "circle" },
    opacity: { value: { min: 0.5, max: 1 }, animation: { enable: true, speed: 3, startValue: "max", destroy: "min" } },
    size: { value: { min: 2, max: 6 }, animation: { enable: true, speed: 8, startValue: "max", destroy: "min" } },
    move: {
      enable: true,
      speed: { min: 6, max: 20 },
      direction: "none",
      outModes: { default: "destroy" },
    },
    life: { duration: { value: 0.6 }, count: 1 },
  },
  emitters: [],
};

const SPARKLE_OPTIONS: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 60,
  particles: {
    number: { value: 0 },
    color: { value: "#ffd700" },
    shape: { type: "star" },
    opacity: { value: { min: 0.4, max: 1 }, animation: { enable: true, speed: 2, startValue: "max", destroy: "min" } },
    size: { value: { min: 3, max: 7 }, animation: { enable: true, speed: 4, startValue: "max", destroy: "min" } },
    move: {
      enable: true,
      speed: { min: 2, max: 8 },
      direction: "top",
      outModes: { default: "destroy" },
      gravity: { enable: true, acceleration: 3 },
    },
    life: { duration: { value: 1.2 }, count: 1 },
  },
  emitters: [],
};

export function VFXProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const confettiRef = useRef<Container | null>(null);
  const impactRef = useRef<Container | null>(null);
  const sparkleRef = useRef<Container | null>(null);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const canEmit = (container: Container | null): container is Container & { addEmitter: (options: unknown) => void } =>
    Boolean(container && typeof (container as { addEmitter?: unknown }).addEmitter === "function");

  const triggerConfetti = useCallback(() => {
    const container = confettiRef.current;
    if (!canEmit(container)) return;
    container.addEmitter({
      position: { x: 50, y: 85 },
      rate: { quantity: 18, delay: 0 },
      life: { duration: 0.15, count: 1 },
      size: { width: 80, height: 10 },
    });
  }, []);

  const triggerImpact = useCallback((color?: string) => {
    const container = impactRef.current;
    if (!canEmit(container)) return;
    if (color) {
      container.options.particles.color.value = color;
    }
    container.addEmitter({
      position: { x: 50, y: 50 },
      rate: { quantity: 24, delay: 0 },
      life: { duration: 0.08, count: 1 },
      size: { width: 5, height: 5 },
    });
  }, []);

  const triggerSparkles = useCallback((color?: string) => {
    const container = sparkleRef.current;
    if (!canEmit(container)) return;
    if (color) {
      container.options.particles.color.value = color;
    }
    container.addEmitter({
      position: { x: 50, y: 60 },
      rate: { quantity: 10, delay: 0 },
      life: { duration: 0.1, count: 1 },
      size: { width: 30, height: 20 },
    });
  }, []);

  const api = useCallback((): VFXApi => ({ triggerConfetti, triggerImpact, triggerSparkles }), [triggerConfetti, triggerImpact, triggerSparkles]);

  if (!ready) {
    return <VFXContext.Provider value={{ triggerConfetti: () => {}, triggerImpact: () => {}, triggerSparkles: () => {} }}>{children}</VFXContext.Provider>;
  }

  return (
    <VFXContext.Provider value={api()}>
      {children}
      <div className="vfx-canvas-layer" aria-hidden="true">
        <Particles
          id="vfx-confetti"
          options={CONFETTI_OPTIONS}
          particlesLoaded={async (container) => { confettiRef.current = container ?? null; }}
        />
        <Particles
          id="vfx-impact"
          options={IMPACT_OPTIONS}
          particlesLoaded={async (container) => { impactRef.current = container ?? null; }}
        />
        <Particles
          id="vfx-sparkle"
          options={SPARKLE_OPTIONS}
          particlesLoaded={async (container) => { sparkleRef.current = container ?? null; }}
        />
      </div>
    </VFXContext.Provider>
  );
}
