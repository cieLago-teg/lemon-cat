declare module "@/lib/pet/rvm-matting.js" {
  export function ensureRvmModel(): Promise<string>;
  export function resolveFfmpegPath(options?: {
    candidates?: string[];
    isExecutable?: (candidate: string) => boolean;
  }): string;
  export function solidifyAlphaMask(
    alphaBytes: Uint8Array,
    width: number,
    height: number,
    options?: {
      keepThreshold?: number;
      minForegroundAlpha?: number;
      closeRadius?: number;
    }
  ): Uint8Array;
  export function matteImageBuffer(inputBuffer: Buffer): Promise<Buffer>;
  export function mattingVideo(inputPath: string, outputPath: string): Promise<string>;
}
