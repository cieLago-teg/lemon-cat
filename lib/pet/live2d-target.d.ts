export type Live2DStatus = {
  available: boolean;
  source: "custom" | "sample_only" | "missing";
  modelPath: string | null;
  message: string;
};

export type Live2DTargetSuccess = {
  ok: true;
  source: "custom";
  config: {
    mode: "live2d";
    baseUrl: string;
  };
};

export type Live2DTargetFailure = {
  ok: false;
  reason: "sample_only" | "missing";
  message: string;
};

declare const live2dTargetModule: {
  getLive2DStatus(projectRoot: string): Live2DStatus;
  resolveLive2DModelTarget(projectRoot: string): Live2DTargetSuccess | Live2DTargetFailure;
};

export default live2dTargetModule;
