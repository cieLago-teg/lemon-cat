export function inspectImage(bytes: Buffer, mime: string, output?: boolean): Promise<{ width: number; height: number; warnings: string[]; metrics: Record<string, number> }>;
