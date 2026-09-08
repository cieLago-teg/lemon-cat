export function isProviderMediaUrl(raw: string): boolean;
export function downloadMedia(url: string, maximum?: number): Promise<{ bytes: Buffer; contentType: string }>;
