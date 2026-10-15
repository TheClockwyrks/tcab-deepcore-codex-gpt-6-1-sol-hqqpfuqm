import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game } from "../src/game";
import * as C from "../src/constants";
/** Development-only capture host. It exposes no page-global debug surface. */
export async function createCapture() {
  const canvas = document.querySelector("canvas")!;
  const engine = createEngine({
    canvas,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    clock: new ConstantClock(1000 / 30),
    background: "#0d1b25",
  });
  await engine.initialize();
  return engine;
}
