export function publicRegistration(): boolean;
export function requirePublicReady(): void;
export function requestAccountLink(body: Record<string, unknown>, purpose: 'verify' | 'reset'): Promise<{ sent: boolean }>;
export function confirmAccount(body: Record<string, unknown>): Promise<{ ok: boolean }>;
