"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const audioLifecycle_1 = require("./audioLifecycle");
function handle(id, active = true) {
    return {
        id,
        active,
        disposeCalls: 0,
        dispose() {
            this.disposeCalls += 1;
        },
    };
}
(0, node_test_1.default)("successful replacement disposes the old route once", async () => {
    const coordinator = new audioLifecycle_1.AudioRouteCoordinator();
    const oldRoute = handle("old");
    const nextRoute = handle("next");
    coordinator.seed("mix", oldRoute);
    await coordinator.replace("mix", async () => nextRoute);
    strict_1.default.equal(coordinator.get("mix"), nextRoute);
    strict_1.default.equal(oldRoute.disposeCalls, 1);
});
(0, node_test_1.default)("failed replacement retains the old route", async () => {
    const coordinator = new audioLifecycle_1.AudioRouteCoordinator();
    const oldRoute = handle("old");
    coordinator.seed("mix", oldRoute);
    await strict_1.default.rejects(coordinator.replace("mix", async () => {
        throw new Error("sink failed");
    }));
    strict_1.default.equal(coordinator.get("mix"), oldRoute);
    strict_1.default.equal(oldRoute.disposeCalls, 0);
});
(0, node_test_1.default)("inactive replacement is disposed and rejected", async () => {
    const coordinator = new audioLifecycle_1.AudioRouteCoordinator();
    const oldRoute = handle("old");
    const inactiveRoute = handle("inactive", false);
    coordinator.seed("monitor", oldRoute);
    await strict_1.default.rejects(coordinator.replace("monitor", async () => inactiveRoute), /did not become active/);
    strict_1.default.equal(coordinator.get("monitor"), oldRoute);
    strict_1.default.equal(inactiveRoute.disposeCalls, 1);
});
(0, node_test_1.default)("restart invalidates stale replacements and disposes every live route once", async () => {
    const coordinator = new audioLifecycle_1.AudioRouteCoordinator();
    const oldRoute = handle("old");
    const staleRoute = handle("stale");
    coordinator.seed("mix", oldRoute);
    const pending = coordinator.replace("mix", async () => staleRoute);
    coordinator.restart();
    await pending;
    strict_1.default.equal(coordinator.get("mix"), undefined);
    strict_1.default.equal(oldRoute.disposeCalls, 1);
    strict_1.default.equal(staleRoute.disposeCalls, 1);
    strict_1.default.equal(coordinator.getActiveRouteCount(), 0);
});
(0, node_test_1.default)("removing a colliding route disposes it exactly once", () => {
    const coordinator = new audioLifecycle_1.AudioRouteCoordinator();
    const monitorRoute = handle("monitor");
    coordinator.seed("monitor", monitorRoute);
    coordinator.remove("monitor");
    coordinator.remove("monitor");
    strict_1.default.equal(coordinator.get("monitor"), undefined);
    strict_1.default.equal(monitorRoute.disposeCalls, 1);
});
