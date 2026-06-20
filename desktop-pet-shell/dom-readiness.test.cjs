const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const indexHtml = fs.readFileSync(
  path.join(__dirname, "index.html"),
  "utf-8"
);

test("index.html styles #pet-video so it does not capture pointer events", () => {
  const cssBlock = indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  assert.ok(cssBlock, "expected a <style> block in index.html");

  // Locate the rule targeting #pet-video (if any)
  const ruleMatch = cssBlock[1].match(/#pet-video\s*\{([\s\S]*?)\}/);
  assert.ok(
    ruleMatch,
    "expected a CSS rule targeting #pet-video so it stays out of the way of drag/click"
  );

  assert.match(
    ruleMatch[1],
    /pointer-events\s*:\s*none/,
    "expected #pet-video to declare pointer-events: none"
  );
});

test("index.html keeps the pet and live2d-canvas media non-interactive", () => {
  const cssBlock = indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  assert.ok(cssBlock);
  const petVideoRule = cssBlock[1].match(/#pet-video\s*\{([\s\S]*?)\}/);
  const petRule = cssBlock[1].match(/(^|\s)#pet\s*\{([\s\S]*?)\}/);
  const canvasRule = cssBlock[1].match(/#live2d-canvas\s*\{([\s\S]*?)\}/);
  assert.ok(petVideoRule, "expected #pet-video rule");
  assert.ok(petRule, "expected #pet rule");
  assert.ok(canvasRule, "expected #live2d-canvas rule");
  assert.match(petVideoRule[1], /pointer-events\s*:\s*none/);
});

test("index.html keeps the HUD element so the user can see click-through state", () => {
  assert.match(indexHtml, /<[^>]+\bid=["']hud["']/i);
});

test("index.html makes the pet surface a native drag region", () => {
  const cssBlock = indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  assert.ok(cssBlock, "expected a <style> block in index.html");
  const dragRule = cssBlock[1].match(/#drag\s*\{([\s\S]*?)\}/);
  assert.ok(dragRule, "expected #drag rule");
  assert.match(
    dragRule[1],
    /-webkit-app-region\s*:\s*drag/,
    "expected #drag to use a native drag region so dragging stays stable"
  );
});

test("index.html keeps controls clickable above the drag region", () => {
  const cssBlock = indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  assert.ok(cssBlock, "expected a <style> block in index.html");
  const controlsRule = cssBlock[1].match(/#controls\s*\{([\s\S]*?)\}/);
  assert.ok(controlsRule, "expected #controls rule");
  assert.match(controlsRule[1], /-webkit-app-region\s*:\s*no-drag/);
  assert.match(controlsRule[1], /z-index\s*:\s*20/);
});

test("renderer keeps only click-through recovery pointer handling and avoids manual window dragging", () => {
  const rendererSrc = fs.readFileSync(
    path.join(__dirname, "renderer.js"),
    "utf-8"
  );
  const pointerDownMatch = rendererSrc.match(
    /window\.addEventListener\(\s*["']pointerdown["'][\s\S]*?\}\s*\)\s*;/
  );
  assert.ok(pointerDownMatch, "expected a pointerdown listener in renderer.js");
  assert.match(
    pointerDownMatch[0],
    /clickThroughEnabled/,
    "pointerdown should consult clickThroughEnabled so the user can recover from a stuck click-through state"
  );
  assert.doesNotMatch(
    rendererSrc,
    /shellBridge\.moveWindow/,
    "renderer should rely on native drag regions instead of JS pointermove dragging"
  );
});

test("renderer keeps the toggle wired via keyboard and pet click", () => {
  const rendererSrc = fs.readFileSync(
    path.join(__dirname, "renderer.js"),
    "utf-8"
  );
  assert.match(rendererSrc, /shellBridge\.toggleClickThrough/);
});

test("renderer keeps the quit button wired to the bridge", () => {
  const rendererSrc = fs.readFileSync(
    path.join(__dirname, "renderer.js"),
    "utf-8"
  );
  assert.match(
    rendererSrc,
    /btnQuit\?\.addEventListener\(\s*["']click["']/,
    "quit button should call shellBridge.quit()"
  );
  assert.match(rendererSrc, /shellBridge\.quit/);
});

test("renderer also force-closes the window on the close button when IPC fails", () => {
  const rendererSrc = fs.readFileSync(
    path.join(__dirname, "renderer.js"),
    "utf-8"
  );
  // The handler should still call window.close() itself so a stuck bridge
  // never strands the user.
  const closeHandler = rendererSrc.match(
    /btnQuit\?\.addEventListener\(\s*["']click["'][\s\S]*?\}\s*\)\s*;/
  );
  assert.ok(closeHandler, "expected a click handler for btnQuit");
  assert.match(
    closeHandler[0],
    /window\.close\(\)/,
    "close button should always window.close() in addition to invoking the bridge"
  );
  assert.match(
    rendererSrc,
    /shellBridge\.quit/,
    "close button should also call shellBridge.quit() for the IPC path"
  );
});

test("index.html styles the control buttons with clear pressed/active states", () => {
  const cssBlock = indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  assert.ok(cssBlock, "expected a <style> block in index.html");
  const controlsRule = cssBlock[1].match(/#controls\s*\{([\s\S]*?)\}/);
  assert.ok(controlsRule, "expected #controls rule");
  // Look for an ":active" / "pressed" feedback rule on the buttons.
  assert.match(
    cssBlock[1],
    /#controls\s+button[^}]*:\s*active\s*\{/,
    "controls buttons should have an :active rule so presses are obvious"
  );
});
