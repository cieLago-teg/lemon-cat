// 验证 Step 5：/companion 页面 + PATCH companionMode + PATCH companionConfig
const BASE = "http://localhost:3007";
const ID = "1780839288242et02uyc";

async function get(url) {
  const r = await fetch(url);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, body: json, raw: text.slice(0, 600) };
}

async function patch(body) {
  const r = await fetch(`${BASE}/api/archive/${ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, body: json };
}

async function getArchive() {
  const fs = await import("fs/promises");
  const data = JSON.parse(await fs.readFile("d:/TRAE/柠檬猫/data/archives.json", "utf8"));
  return data.find((a) => a.id === ID);
}

(async () => {
  // 1) /companion 页面 GET
  const page = await get(`${BASE}/companion`);
  const hasReact = page.raw.includes("桌面陪伴") && page.raw.includes("选择陪伴模式");
  console.log(`[1] GET /companion  HTTP ${page.status} | ${hasReact ? "✅ 含三栏文案" : "❌ 缺文案"}`);

  // 2) /api/archive 列表（页面会调用）
  const list = await get(`${BASE}/api/archive`);
  const okList = list.status === 200 && Array.isArray(list.body?.archives);
  console.log(`[2] GET /api/archive HTTP ${list.status} | ${okList ? `✅ ${list.body.archives.length} 只宠物` : "❌"}`);

  // 3) 备份初始值
  const before = await getArchive();
  const initMode = before.companionMode;
  const initCfg = { ...before.companionConfig };
  console.log(`[3] BEFORE  mode=${initMode}  cfg=${JSON.stringify(initCfg)}`);

  // 4) PATCH companionMode = "breathe"
  const r1 = await patch({ companionMode: "breathe" });
  console.log(`[4] PATCH companionMode=breathe  HTTP ${r1.status} | mode=${r1.body?.archive?.companionMode}`);

  // 5) PATCH companionConfig 6 项
  const r2 = await patch({
    companionConfig: {
      position: "left-top",
      size: "large",
      alwaysOnTop: false,
      mousePassthrough: false,
      nestBackground: "cloud",
      autoSummon: true
    }
  });
  console.log(`[5] PATCH companionConfig  HTTP ${r2.status} | cfg=${JSON.stringify(r2.body?.archive?.companionConfig)}`);

  // 6) 恶意 payload 验证白名单：companionMode="hacker" 应被拒绝（fallback 到 default）
  const r3 = await patch({ companionMode: "hacker_mode" });
  const mode3 = r3.body?.archive?.companionMode;
  console.log(`[6] PATCH companionMode=hacker_mode  HTTP ${r3.status} | mode=${mode3} ${mode3 === "quiet" || mode3 === "breathe" ? "✅ 白名单生效" : "❌ 白名单失效"}`);

  // 7) 恶意 payload companionConfig 部分字段：position="hacker" 应被拒
  const r4 = await patch({ companionConfig: { position: "hacker", size: "huge" } });
  const cfg4 = r4.body?.archive?.companionConfig;
  console.log(`[7] PATCH cfg 部分恶意字段  HTTP ${r4.status} | cfg.position=${cfg4?.position}, cfg.size=${cfg4?.size}  ${cfg4?.position === "right-bottom" && cfg4?.size === "medium" ? "✅ 白名单生效" : "❌"}`);

  // 8) 还原初始值
  await patch({ companionMode: initMode, companionConfig: initCfg });
  const after = await getArchive();
  console.log(`[8] AFTER RESET  mode=${after.companionMode}  cfg=${JSON.stringify(after.companionConfig)}`);

  // 9) GET /pets/[id] 不应该坏（详情页也应该用 archive 数据）
  const detail = await get(`${BASE}/pets/${ID}`);
  console.log(`[9] GET /pets/[id]  HTTP ${detail.status} | ${detail.raw.includes("数字编号") ? "✅ 详情页正常" : "⚠️ 详情页文案需检查"}`);

  // 总结
  console.log(`\n=== 总结 ===`);
  const allOk = page.status === 200 && okList && r1.status === 200 && r2.status === 200;
  console.log(allOk ? "✅ 全部通过" : "❌ 有失败项");
})();
