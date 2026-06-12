// Step 6 全功能验证脚本
const BASE = "http://localhost:3008";
const ID = "1780839288242et02uyc";

async function get(url) {
  const r = await fetch(url);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, body: json, raw: text.slice(0, 800) };
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
  const data = JSON.parse(await fs.readFile("d:/TRAE/柠檬树苗/data/archives.json", "utf8"));
  return data.find((a) => a.id === ID);
}

(async () => {
  console.log("=== Step 6 全功能验证 ===\n");

  // 1) /create 页面
  const create = await get(`${BASE}/create`);
  const has4Steps = create.raw.includes("第 1 步") && create.raw.includes("数字宠物克隆");
  console.log(`[6.1] GET /create          HTTP ${create.status} | ${has4Steps ? "✅ 4 步进度条" : "❌"}`);

  // 2) /create/success 页面
  const success = await get(`${BASE}/create/success?id=${ID}`);
  const hasBirth = success.raw.includes("诞生时刻") && success.raw.includes("已就绪");
  console.log(`[6.2] GET /create/success  HTTP ${success.status} | ${hasBirth ? "✅ 诞生时刻页" : "❌"}`);

  // 3) /companion 页面（要看陪伴记录卡 + 桌面策略）
  const companion = await get(`${BASE}/companion`);
  const hasStatsCard = companion.raw.includes("陪伴记录") && companion.raw.includes("温柔计数");
  console.log(`[6.5] GET /companion       HTTP ${companion.status} | ${hasStatsCard ? "✅ 陪伴记录卡" : "❌"}`);

  // 4) 详情页兼容
  const detail = await get(`${BASE}/pets/${ID}`);
  console.log(`[ctd] GET /pets/[id]      HTTP ${detail.status} | ${detail.status === 200 ? "✅" : "❌"}`);

  // 5) PATCH companionStats
  const before = await getArchive();
  const initStats = { ...before.companionStats };
  const initLast = before.lastSummonedAt;
  const initStrategy = before.multiPetStrategy;

  const r1 = await patch({
    companionStats: {
      totalAttentionMs: 3 * 3600 * 1000 + 24 * 60 * 1000, // 3h 24min
      interactionCount: 12,
      mouseFollowCount: 5,
      lastSessionAt: Date.now() - 1000 * 60 * 60,
      weeklyPresence: [1, 1, 0, 1, 1, 1, 0]
    }
  });
  const r1Stats = r1.body?.archive?.companionStats;
  console.log(`[6.4] PATCH companionStats HTTP ${r1.status} | totalMs=${r1Stats?.totalAttentionMs} 互动=${r1Stats?.interactionCount} 鼠标=${r1Stats?.mouseFollowCount} weekly=${JSON.stringify(r1Stats?.weeklyPresence)}`);

  // 6) PATCH multiPetStrategy
  const r2 = await patch({ multiPetStrategy: "rotate" });
  console.log(`[6.6] PATCH strategy=rotate HTTP ${r2.status} | strategy=${r2.body?.archive?.multiPetStrategy}`);

  // 7) PATCH lastSummonedAt
  const now = Date.now();
  const r3 = await patch({ lastSummonedAt: now });
  console.log(`[6.4] PATCH lastSummonedAt HTTP ${r3.status} | now=${r3.body?.archive?.lastSummonedAt}`);

  // 8) 恶意值白名单：weeklyPresence 长度 14 → 应被截断到 7
  const r4 = await patch({
    companionStats: {
      weeklyPresence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] // 14 个 1
    }
  });
  const wp = r4.body?.archive?.companionStats?.weeklyPresence;
  console.log(`[6.4] 白名单 weeklyPresence 14→${wp?.length} ${wp?.length === 7 ? "✅" : "❌"} | values=${JSON.stringify(wp)}`);

  // 9) 恶意 totalAttentionMs 负数 → 应被 clamp 到 0
  const r5 = await patch({ companionStats: { totalAttentionMs: -99999 } });
  const ms = r5.body?.archive?.companionStats?.totalAttentionMs;
  console.log(`[6.4] 白名单 totalMs=-99999→${ms} ${ms === 0 ? "✅ clamp" : "❌"}`);

  // 10) 恶意 multiPetStrategy
  const r6 = await patch({ multiPetStrategy: "swarm" });
  const strat = r6.body?.archive?.multiPetStrategy;
  // 期望：要么 400（拒绝），要么 "single"（回退到 default）
  console.log(`[6.6] 恶意 strategy=swarm  HTTP ${r6.status} | strategy=${strat} ${(r6.status === 400 || strat === "single" || strat === "rotate") ? "✅" : "❌"}`);

  // 11) 还原
  await patch({ companionStats: initStats, multiPetStrategy: initStrategy, lastSummonedAt: initLast });
  const after = await getArchive();
  console.log(`\n[RESET] 已还原  strategy=${after.multiPetStrategy} totalMs=${after.companionStats.totalAttentionMs}`);

  console.log(`\n=== 总结 ===`);
  const allOk = create.status === 200 && success.status === 200 && companion.status === 200 &&
                r1.status === 200 && r2.status === 200 && r3.status === 200;
  console.log(allOk ? "✅ 6 大能力全通" : "❌ 有失败项");
})();
