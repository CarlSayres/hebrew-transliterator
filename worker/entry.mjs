import { DurableObject } from "cloudflare:workers";
import { AudioQueue } from "./index.mjs";

export { default } from "./index.mjs";

export class AudioCoordinator extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.queue = new AudioQueue(env);
  }

  fetch(request) {
    return this.queue.fetch(request);
  }
}
