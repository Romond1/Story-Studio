import test from "node:test";
import assert from "node:assert/strict";
import { AudioRouteCoordinator, type RouteHandle } from "./audioLifecycle";

function handle(id: string, active = true): RouteHandle {
  return {
    id,
    active,
    disposeCalls: 0,
    dispose() {
      this.disposeCalls += 1;
    },
  };
}

test("successful replacement disposes the old route once", async () => {
  const coordinator = new AudioRouteCoordinator();
  const oldRoute = handle("old");
  const nextRoute = handle("next");
  coordinator.seed("mix", oldRoute);

  await coordinator.replace("mix", async () => nextRoute);

  assert.equal(coordinator.get("mix"), nextRoute);
  assert.equal(oldRoute.disposeCalls, 1);
});

test("failed replacement retains the old route", async () => {
  const coordinator = new AudioRouteCoordinator();
  const oldRoute = handle("old");
  coordinator.seed("mix", oldRoute);

  await assert.rejects(
    coordinator.replace("mix", async () => {
      throw new Error("sink failed");
    }),
  );

  assert.equal(coordinator.get("mix"), oldRoute);
  assert.equal(oldRoute.disposeCalls, 0);
});

test("inactive replacement is disposed and rejected", async () => {
  const coordinator = new AudioRouteCoordinator();
  const oldRoute = handle("old");
  const inactiveRoute = handle("inactive", false);
  coordinator.seed("monitor", oldRoute);

  await assert.rejects(
    coordinator.replace("monitor", async () => inactiveRoute),
    /did not become active/,
  );

  assert.equal(coordinator.get("monitor"), oldRoute);
  assert.equal(inactiveRoute.disposeCalls, 1);
});

test("restart invalidates stale replacements and disposes every live route once", async () => {
  const coordinator = new AudioRouteCoordinator();
  const oldRoute = handle("old");
  const staleRoute = handle("stale");
  coordinator.seed("mix", oldRoute);

  const pending = coordinator.replace("mix", async () => staleRoute);
  coordinator.restart();
  await pending;

  assert.equal(coordinator.get("mix"), undefined);
  assert.equal(oldRoute.disposeCalls, 1);
  assert.equal(staleRoute.disposeCalls, 1);
  assert.equal(coordinator.getActiveRouteCount(), 0);
});
