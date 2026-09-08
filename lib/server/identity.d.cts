export function requireVerifiedImage(userId: string, imageUrl: string): Promise<void>;
export function requireVerifiedVideo(userId: string, videoUrl: string): Promise<void>;
export function parseVerdict(raw: string): { verdict: string; reason: string; matches: string[]; conflicts: string[]; passed: boolean };
