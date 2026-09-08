export type Viewer = { id: string; email: string; credits: number; isAdmin: boolean };

export declare function viewer(request: Request): Promise<Viewer>;
export declare function sameOrigin(request: Request): void;
export declare function authenticate(
  body: { email?: unknown; password?: unknown; inviteCode?: unknown },
  register: boolean
): Promise<{ user: Viewer; cookie: string }>;
export declare function bootstrapDeveloper(
  body: { email?: unknown; password?: unknown }
): Promise<{ user: Viewer; cookie: string }>;
export declare function canBootstrapDeveloper(): boolean;
export declare function logout(request: Request): Promise<string>;
export declare function throttle(key: string, maximum: number, seconds: number): Promise<void>;
export declare function digest(value: string): string;
