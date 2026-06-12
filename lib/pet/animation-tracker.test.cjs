const test = require("node:test");
const assert = require("node:assert/strict");

const { createAnimationTracker } = require("./animation-tracker.js");

test("createAnimationTracker: setSubmitted transitions to 'Submitted' stage at 5%", () => {
  const t = createAnimationTracker();
  t.setSubmitted("t-1");
  const s = t.get("t-1");
  assert.equal(s.stage, "Submitted");
  assert.equal(s.percent, 5);
  assert.ok(s.message.includes("Wan"), `Submitted message should mention Wan, got: ${s.message}`);
});

test("createAnimationTracker: setPolling updates stage and bumps percent", () => {
  const t = createAnimationTracker();
  t.setSubmitted("t-2");
  t.setPolling("t-2", "Preparing");
  const s = t.get("t-2");
  assert.equal(s.stage, "Preparing");
  assert.ok(s.percent >= 5 && s.percent < 95, `percent should be between 5 and 95, got ${s.percent}`);
});

test("createAnimationTracker: setPolling maps known Wan stages to sensible percents", () => {
  const t = createAnimationTracker();
  t.setSubmitted("t-3");
  t.setPolling("t-3", "Queueing");
  assert.equal(t.get("t-3").percent, 15);
  t.setPolling("t-3", "Preparing");
  assert.equal(t.get("t-3").percent, 25);
  t.setPolling("t-3", "Processing");
  assert.equal(t.get("t-3").percent, 60);
  t.setPolling("t-3", "Finishing");
  assert.equal(t.get("t-3").percent, 90);
});

test("createAnimationTracker: setPolling caps monotonic progress to ensure bar always moves forward", () => {
  const t = createAnimationTracker();
  t.setSubmitted("t-4");
  t.setPolling("t-4", "Processing"); // 60
  t.setPolling("t-4", "Queueing"); // would be 15, must NOT regress
  assert.equal(t.get("t-4").percent, 60);
});

test("createAnimationTracker: setSucceeded finalises at 100% with videoUrl", () => {
  const t = createAnimationTracker();
  t.setSubmitted("t-5");
  t.setSucceeded("t-5", { videoUrl: "/pet-videos/x.webm" });
  const s = t.get("t-5");
  assert.equal(s.stage, "Success");
  assert.equal(s.percent, 100);
  assert.equal(s.videoUrl, "/pet-videos/x.webm");
});

test("createAnimationTracker: setFailed captures error and stops at current percent", () => {
  const t = createAnimationTracker();
  t.setSubmitted("t-6");
  t.setPolling("t-6", "Processing");
  t.setFailed("t-6", "Wan 余额不足");
  const s = t.get("t-6");
  assert.equal(s.stage, "Failure");
  assert.equal(s.error, "Wan 余额不足");
  assert.ok(s.percent >= 60);
});

test("createAnimationTracker: get() returns null for unknown taskId", () => {
  const t = createAnimationTracker();
  assert.equal(t.get("not-real"), null);
});

test("createAnimationTracker: listActive returns only non-terminal tasks", () => {
  const t = createAnimationTracker();
  t.setSubmitted("a");
  t.setSubmitted("b");
  t.setSubmitted("c");
  t.setSucceeded("b", { videoUrl: "/v" });
  t.setFailed("c", "x");
  const active = t.listActive();
  assert.equal(active.length, 1);
  assert.equal(active[0].taskId, "a");
});

test("createAnimationTracker: tickWithoutStatus slowly advances percent so the UI never stalls", () => {
  const t = createAnimationTracker();
  t.setSubmitted("t-7");
  t.setPolling("t-7", "Processing"); // 60
  const before = t.get("t-7").percent;
  // Pretend 6 seconds have passed.
  t.tickWithoutStatus("t-7", 6000);
  const after = t.get("t-7").percent;
  assert.ok(after > before, `after should be > before (${after} vs ${before})`);
  assert.ok(after < 95, `after should be < 95, got ${after}`);
});

test("createAnimationTracker: handles DashScope UPPERCASE stage labels (PENDING/RUNNING/SUCCEEDED/FAILED)", () => {
  // DashScope's actual API returns statuses like "PENDING", "RUNNING",
  // "SUCCEEDED", "FAILED", "CANCELED" — all uppercase. The tracker must
  // resolve these to a sensible Chinese message + percent, not fall back
  // to a generic "生成中…" string.
  const t = createAnimationTracker();
  t.setSubmitted("ds-1");
  t.setPolling("ds-1", "PENDING");
  let s = t.get("ds-1");
  assert.equal(s.stage, "PENDING");
  assert.ok(s.message.includes("排队") || s.message.includes("等待"), `PENDING message should mention queue, got: ${s.message}`);
  t.setPolling("ds-1", "RUNNING");
  s = t.get("ds-1");
  assert.equal(s.stage, "RUNNING");
  assert.ok(s.message.includes("生成") || s.message.includes("推理"), `RUNNING message should mention generating, got: ${s.message}`);
  t.setPolling("ds-1", "SUCCEEDED");
  s = t.get("ds-1");
  assert.equal(s.stage, "SUCCEEDED");
  assert.ok(s.message.includes("完成") || s.message.includes("成功"), `SUCCEEDED message should mention success, got: ${s.message}`);
  t.setPolling("ds-1", "FAILED");
  s = t.get("ds-1");
  assert.equal(s.stage, "FAILED");
  assert.ok(s.message.includes("失败") || s.message.includes("错误"), `FAILED message should mention failure, got: ${s.message}`);
});

test("integration: /api/pet/animate route uses animation-tracker", () => {
  // Static source-level check: the route must import createAnimationTracker
  // and call setSubmitted before returning, so the response includes a
  // taskId and the front-end can poll for progress.
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "app", "api", "pet", "animate", "route.ts"),
    "utf8"
  );
  assert.match(source, /createAnimationTracker/);
  assert.match(source, /setSubmitted/);
  assert.match(source, /taskId/);
  // And the status route must accept ?taskId=
  const statusSource = fs.readFileSync(
    path.join(__dirname, "..", "..", "app", "api", "pet", "animation-status", "route.ts"),
    "utf8"
  );
  assert.match(statusSource, /taskId/);
});

test("integration: motion-lab page handles taskId response (polling) AND legacy videoUrl response", () => {
  // After the animate route returned taskId-only responses, the front-end
  // must switch to polling rather than expecting videoUrl directly. If
  // someone refactors and drops the polling branch, the new code path
  // becomes the only way to receive a video — this test fails loudly.
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "app", "motion-lab", "page.tsx"),
    "utf8"
  );
  assert.match(source, /taskId/, "front-end must reference taskId for polling");
  assert.match(source, /animation-status/, "front-end must call /api/pet/animation-status for progress");
  assert.match(source, /setAnimationTaskId|setAnimationProgress|setProgress/, "front-end must track task progress");
});
