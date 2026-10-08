export type AudioOutputRoute = "monitor" | "mix";

export interface RouteHandle {
  id: string;
  active: boolean;
  disposeCalls: number;
  dispose(): void;
}

export class AudioRouteCoordinator {
  private generation = 0;
  private routes = new Map<AudioOutputRoute, RouteHandle>();
  private requests = new Map<AudioOutputRoute, object>();

  get(route: AudioOutputRoute): RouteHandle | undefined {
    return this.routes.get(route);
  }

  seed(route: AudioOutputRoute, handle: RouteHandle): void {
    this.routes.set(route, handle);
  }

  remove(route: AudioOutputRoute): void {
    this.requests.delete(route);
    const current = this.routes.get(route);
    if (!current) return;
    this.routes.delete(route);
    current.dispose();
  }

  async replace(
    route: AudioOutputRoute,
    create: () => Promise<RouteHandle>,
  ): Promise<boolean> {
    const generation = this.generation;
    const request = {};
    this.requests.set(route, request);
    const candidate = await create();

    if (generation !== this.generation || this.requests.get(route) !== request) {
      candidate.dispose();
      return false;
    }
    if (!candidate.active) {
      candidate.dispose();
      throw new Error(`${route} route did not become active`);
    }

    const previous = this.routes.get(route);
    this.routes.set(route, candidate);
    previous?.dispose();
    return true;
  }

  restart(): void {
    this.generation += 1;
    this.requests.clear();
    this.routes.forEach((route) => route.dispose());
    this.routes.clear();
  }

  getGeneration(): number {
    return this.generation;
  }

  getActiveRouteCount(): number {
    return this.routes.size;
  }
}
