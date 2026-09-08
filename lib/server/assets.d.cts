export type Asset = { id: string; user_id: string; object_key: string; content_type: string; size: number; sha256: string; backend: string };
export function putAsset(userId: string, bytes: Buffer, contentType: string): Promise<string>;
export function ownedAsset(userId: string, id: string): Promise<Asset>;
export function readAsset(asset: Asset): Promise<Buffer>;
export function providerAssetUrl(userId: string, url: string): Promise<string>;
export function checkStorage(): Promise<string>;
