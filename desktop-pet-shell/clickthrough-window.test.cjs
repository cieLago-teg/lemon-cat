const test = require("node:test");
const assert = require("node:assert/strict");

const { applyClickThroughWindowState } = require("./clickthrough-window.js");

function createWindowStub() {
  const calls = [];
  const webContents = {
    send(channel, payload) {
      calls.push(["send", channel, payload]);
    },
    focus() {
      calls.push(["webContents.focus"]);
    }
  };

  return {
    calls,
    webContents,
    isDestroyed() {
      return false;
    },
    isMinimized() {
      return false;
    },
    restore() {
      calls.push(["restore"]);
    },
    show() {
      calls.push(["show"]);
    },
    focus() {
      calls.push(["focus"]);
    },
    blur() {
      calls.push(["blur"]);
    },
    moveTop() {
      calls.push(["moveTop"]);
    },
    setIgnoreMouseEvents(value, options) {
      calls.push(["setIgnoreMouseEvents", value, options]);
    },
    setFocusable(value) {
      calls.push(["setFocusable", value]);
    }
  };
}

test("enabling click-through blurs the window and keeps mouse forwarding", () => {
  const win = createWindowStub();

  applyClickThroughWindowState(win, true);

  assert.deepEqual(win.calls, [
    ["setIgnoreMouseEvents", true, { forward: true }],
    ["setFocusable", false],
    ["blur"],
    ["send", "pet:setClickThrough", { enabled: true }]
  ]);
});

test("disabling click-through actively restores an interactive window", () => {
  const win = createWindowStub();

  applyClickThroughWindowState(win, false);

  assert.deepEqual(win.calls, [
    ["setIgnoreMouseEvents", false, undefined],
    ["setFocusable", true],
    ["show"],
    ["moveTop"],
    ["focus"],
    ["webContents.focus"],
    ["send", "pet:setClickThrough", { enabled: false }]
  ]);
});
