declare module "@/lib/pet/animation-tracker.js" {
  export type AnimationStage =
    | "Pending"
    | "Submitted"
    | "Queueing"
    | "Preparing"
    | "Processing"
    | "Finishing"
    | "Success"
    | "Failure";
  export interface AnimationTaskStatus {
    taskId: string;
    stage: AnimationStage;
    percent: number;
    message: string;
    videoUrl?: string;
    error?: string;
    updatedAt: number;
  }
  export const STAGE_PERCENTS: Record<AnimationStage, number>;
  export const STAGE_LABELS: Record<AnimationStage, string>;
  export function createAnimationTracker(): {
    get(taskId: string): AnimationTaskStatus | null;
    setSubmitted(taskId: string): AnimationTaskStatus;
    setPolling(taskId: string, stage: string): AnimationTaskStatus;
    tickWithoutStatus(taskId: string, elapsedMs: number): AnimationTaskStatus;
    setSucceeded(taskId: string, payload: { videoUrl?: string }): AnimationTaskStatus;
    setFailed(taskId: string, error: string): AnimationTaskStatus;
    listActive(): AnimationTaskStatus[];
  };
}
