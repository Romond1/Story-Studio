"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioRouteCoordinator = void 0;
class AudioRouteCoordinator {
    constructor() {
        this.generation = 0;
        this.routes = new Map();
    }
    get(route) {
        return this.routes.get(route);
    }
    seed(route, handle) {
        this.routes.set(route, handle);
    }
    remove(route) {
        const current = this.routes.get(route);
        if (!current)
            return;
        this.routes.delete(route);
        current.dispose();
    }
    async replace(route, create) {
        const generation = this.generation;
        const previous = this.routes.get(route);
        const candidate = await create();
        if (generation !== this.generation) {
            candidate.dispose();
            return;
        }
        if (!candidate.active) {
            candidate.dispose();
            throw new Error(`${route} route did not become active`);
        }
        this.routes.set(route, candidate);
        previous?.dispose();
    }
    restart() {
        this.generation += 1;
        this.routes.forEach((route) => route.dispose());
        this.routes.clear();
    }
    getGeneration() {
        return this.generation;
    }
    getActiveRouteCount() {
        return this.routes.size;
    }
}
exports.AudioRouteCoordinator = AudioRouteCoordinator;
