import path from "node:path";
import { createAnimationTracker } from "@/lib/pet/animation-tracker.js";

type Tracker = ReturnType<typeof createAnimationTracker>;
const shared = globalThis as typeof globalThis & { __petDurableTracker?: Tracker };

export function getAnimationTracker(): Tracker {
  shared.__petDurableTracker ??= createAnimationTracker({
    filePath: path.join(process.cwd(), "data", "animation-tasks.json")
  });
  return shared.__petDurableTracker;
}
