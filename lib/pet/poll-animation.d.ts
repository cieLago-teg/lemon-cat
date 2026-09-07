export function pollAnimation(taskId: string, options?: {
  signal?: AbortSignal;
  timeoutMs?: number;
  intervalMs?: number;
  fetch?: typeof fetch;
  onProgress?: (task: { stage: string; percent?: number; message?: string }) => void;
}): Promise<string>;
