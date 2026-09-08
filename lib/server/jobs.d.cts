export type Job = { id: string; user_id: string; kind: string; state: string; input: Record<string, unknown>; result: Record<string, unknown> | null; upstream_id?: string; updated_at: string; error?: string };
export function enqueue(userId: string, kind: string, key: string, input: unknown, requestId: string): Promise<Job>;
export function getJob(userId: string, id: string): Promise<Job | null>;
export function listJobs(userId: string): Promise<Job[]>;
export function publicJob(job: Job): { taskId: string; stage: string; percent: number; message: string; videoUrl: string | null; result: Record<string, unknown> | null; error?: string; state: string; updatedAt: number };
