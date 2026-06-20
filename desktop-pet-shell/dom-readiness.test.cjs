const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const indexHtml = fs.readFileSync(
  path.join(__dirname, "index.html"),
  "utf-8"
);

test("index.html styles #pet-video as a drag surface with auto pointer events", () => {
  const cssBlock = indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  assert.ok(cssBlock, "expected a <style> block in index.html");

  const ruleMatch = cssBlock[1].match(/#pet-video\s*\{([\s\S]*?)\}/);
  assert.ok(
    ruleMatch,
    "expected a CSS rule targeting #pet-video for drag and contextmenu handling"
  );

  assert.match(
    ruleMatch[1],
    /-webkit-app-region\s*:\s*drag/,
    "expected #pet-video to declare -webkit-app-region: drag"
  );
  assert.match(
    ruleMatch[1],
    /pointer-events\s*:\s*auto/,
    "expected #pet-video to declare pointer-events: auto for contextmenu"
  );
});

test("index.html keeps the pet and live2d-canvas media interactive for drag and contextmenu", () => {
  const cssBlock = indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  assert.ok(cssBlock);
  const petVideoRule = cssBlock[1].match(/#pet-video\s*\{([\s\S]*?)\}/);
  const petRule = cssBlock[1].match(/(^|\s)#pet\s*\{([\s\S]*?)\}/);
  const canvasRule = cssBlock[1].match(/#live2d-canvas\s*\{([\s\S]*?)\}/);
  assert.ok(petVideoRule, "expected #pet-video rule");
  assert.ok(petRule, "expected #pet rule");
  assert.ok(canvasRule, "expected #live2d-canvas rule");
  assert.match(petVideoRule[1], /-webkit-app-region\s*:\s*drag/);
  assert.match(petRule[2], /-webkit-app-region\s*:\s*drag/);
  assert.match(canvasRule[1], /-webkit-app-region\s*:\s*drag/);
});

test("index.html keeps the HUD element so the user can see click-through state", () => {
  assert.match(indexHtml, /<[^>]+\bid=["']hud["']/i);
});

test("index.html makes the pet surface a native drag region", () => {
  const cssBlock = indexHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  assert.ok(cssBlock, "expected a <style> block in index.html");
  const petRule = cssBlock[1].match(/#pet\s*\{([\s\S]*?)\}/);
  assert.ok(petRule, "expected #pet rule");
  assert.match(
    petRule[1],
    /-webkit-app-region\s*:\s*drag/,
    "expected #pet to use a native drag region so dragging stays stable"
  );
  const htmlBodyRule = cssBlock[1].match(/html\s*,\s*body\s*\{([\s\S]*?)\}/);
  assert.ok(htmlBodyRule, "expected html,body rule");
  assert.match(
    htmlBodyRule[1],
    /-webkit-app-region\s*:\s*drag/,
    "expected html,body to fallback as drag region"
  );
});

test("index.html keeps the pet area clean with no visible controls", () => {
  assert.doesNotMatch(indexHtml, /btn-quit/i, "no close button should clutter the pet");
  assert.doesNotMatch(indexHtml, /id=["']controls["']/i, "no controls panel should clutter the pet");
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

test("renderer right-click (contextmenu) quits the pet window", () => {
  const rendererSrc = fs.readFileSync(
    path.join(__dirname, "renderer.js"),
    "utf-8"
  );
  assert.match(
    rendererSrc,
    /contextmenu/,
    "renderer should listen to contextmenu events on pet media elements"
  );
  assert.match(rendererSrc, /quitPet/);
  assert.match(rendererSrc, /shellBridge\.quit/);
});

test("renderer quit function calls window.close as fallback", () => {
  const rendererSrc = fs.readFileSync(
    path.join(__dirname, "renderer.js"),
    "utf-8"
  );
  assert.match(
    rendererSrc,
    /window\.close\(\)/,
    "quitPet should always window.close() in addition to invoking the bridge"
  );
  assert.match(
    rendererSrc,
    /shellBridge\.quit/,
    "quitPet should also call shellBridge.quit() for the IPC path"
  );
});

test("index.html uses no button elements — controls are removed", () => {
  assert.doesNotMatch(indexHtml, /<button/i, "no button elements in the pet shell");
});
