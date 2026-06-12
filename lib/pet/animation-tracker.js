// In-process tracker for video generation tasks. Used so the /api/pet/animate
// route can return a taskId immediately, then keep updating progress in the
// background, and the front-end can poll /api/pet/animation-status to draw a
// real progress bar.

const STAGE_PERCENTS = {
  Submitted: 5,
  Queueing: 15,
  Preparing: 25,
  Processing: 60,
  Finishing: 90,
  Success: 100,
  Failure: 100,
  // DashScope / Wan (百炼) UPPERCASE stage labels returned by their API.
  PENDING: 15,
  RUNNING: 60,
  SUCCEEDED: 100,
  FAILED: 100,
  CANCELED: 100
};

const STAGE_LABELS = {
  Submitted: "已提交到 Wan 队列",
  Queueing: "正在排队等待 GPU",
  Preparing: "正在准备推理环境",
  Processing: "正在生成视频帧",
  Finishing: "正在合成最终视频",
  Success: "生成完成",
  Failure: "生成失败",
  // DashScope / Wan (百炼) UPPERCASE stage labels returned by their API.
  PENDING: "正在排队等待 GPU",
  RUNNING: "正在生成视频帧",
  SUCCEEDED: "生成完成",
  FAILED: "生成失败",
  CANCELED: "已取消生成"
};

function clampPercent(stage, currentPercent) {
  if (stage === "Success" || stage === "Failure") return 100;
  const base = STAGE_PERCENTS[stage] ?? currentPercent ?? 0;
  // Monotonic: never regress.
  if (typeof currentPercent === "number" && base < currentPercent) {
    return currentPercent;
  }
  return base;
}

function createAnimationTracker() {
  /** @type {Map<string, {taskId: string, stage: string, percent: number, message: string, videoUrl?: string, error?: string, updatedAt: number}>} */
  const store = new Map();

  function ensure(taskId) {
    if (!store.has(taskId)) {
      store.set(taskId, {
        taskId,
        stage: "Pending",
        percent: 0,
        message: "等待中",
        updatedAt: Date.now()
      });
    }
    return store.get(taskId);
  }

  function get(taskId) {
    return store.get(taskId) || null;
  }

  function setSubmitted(taskId) {
    const s = ensure(taskId);
    s.stage = "Submitted";
    s.percent = clampPercent("Submitted", s.percent);
    s.message = STAGE_LABELS.Submitted;
    s.updatedAt = Date.now();
    return s;
  }

  function setPolling(taskId, stageLabel) {
    const s = ensure(taskId);
    if (s.stage === "Success" || s.stage === "Failure") return s;
    s.stage = stageLabel || s.stage;
    s.percent = clampPercent(stageLabel, s.percent);
    s.message = STAGE_LABELS[stageLabel] || stageLabel;
    s.updatedAt = Date.now();
    return s;
  }

  // Used to slowly advance the bar between real Wan polls (e.g. when the
  // upstream doesn't return any progress info). Each call advances the bar by
  // a small amount based on elapsed time, but never past 95.
  function tickWithoutStatus(taskId, elapsedMs) {
    const s = ensure(taskId);
    if (s.stage === "Success" || s.stage === "Failure") return s;
    const seconds = Math.max(0, (elapsedMs || 0) / 1000);
    const step = Math.min(2, seconds / 3); // up to +2 percent per tick
    const next = Math.min(95, s.percent + step);
    s.percent = next;
    s.message = STAGE_LABELS[s.stage] || "生成中…";
    s.updatedAt = Date.now();
    return s;
  }

  function setSucceeded(taskId, payload) {
    const s = ensure(taskId);
    s.stage = "Success";
    s.percent = 100;
    s.message = STAGE_LABELS.Success;
    s.videoUrl = payload && payload.videoUrl;
    s.error = undefined;
    s.updatedAt = Date.now();
    return s;
  }

  function setFailed(taskId, error) {
    const s = ensure(taskId);
    s.stage = "Failure";
    s.message = STAGE_LABELS.Failure;
    s.error = error;
    s.updatedAt = Date.now();
    return s;
  }

  function listActive() {
    const out = [];
    for (const s of store.values()) {
      if (s.stage !== "Success" && s.stage !== "Failure") out.push(s);
    }
    return out;
  }

  return {
    get,
    setSubmitted,
    setPolling,
    tickWithoutStatus,
    setSucceeded,
    setFailed,
    listActive
  };
}

module.exports = {
  createAnimationTracker,
  STAGE_PERCENTS,
  STAGE_LABELS
};
