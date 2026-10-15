/// <reference types="node" />
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
// Start npm run dev, then execute with node --experimental-strip-types scripts/capture.ts.
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route("**/capture.html", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<html><body style="margin:0;background:#0d1b25"><canvas style="display:block;width:1280px;height:720px"></canvas></body></html>',
  }),
);
page.on("pageerror", (e) => {
  throw e;
});
await page.goto("http://localhost:5173/capture.html");
const host = await page.evaluateHandle(async () => {
  const path = "/scripts/capture-host.ts";
  const module = await import(path);
  return module.createCapture();
});
await mkdir("showcase", { recursive: true });
await host.evaluate(async (e) => {
  const d = e.debug;
  e.apply((s) => d.setScreen(s, "in-mine"));
  e.apply((s) => d.generateMine(s));
  await e.advance(1);
});
await page.screenshot({ path: "showcase/surface.png" });
await host.evaluate(async (e) => {
  const d = e.debug;
  e.apply((s) => d.setTier(s, "fuel", 3));
  e.apply((s) => d.setFuel(s, 250));
  e.apply((s) => d.setTier(s, "drill", 3));
  e.apply((s) => d.setTier(s, "hull", 3));
  e.apply((s) => d.setHull(s, 220));
  e.apply((s) => d.setTier(s, "cargo", 3));
  e.apply((s) => d.setTier(s, "jetpack", 3));
  e.apply((s) => d.setTier(s, "scanner", 3));
  for (let row = 178; row <= 181; row++)
    for (let col = 10; col <= 20; col++)
      e.apply((s) => d.setTile(s, col, row, "tunnel"));
  for (let row = 167; row <= 181; row++)
    e.apply((s) => d.setTile(s, 14, row, "tunnel"));
  for (let col = 10; col <= 20; col++)
    e.apply((s) => d.setTile(s, col, 182, "rock"));
  for (const [col, row, ore] of [
    [9, 179, "cobaltine"],
    [10, 182, "cuprite"],
    [11, 182, "cuprite"],
    [15, 182, "argenite"],
    [16, 182, "argenite"],
    [17, 183, "verdite"],
    [21, 180, "voltite"],
    [22, 180, "voltite"],
  ] as const)
    e.apply((s) => d.setOreTile(s, col, row, ore));
  e.apply((s) => d.setMaterialTile(s, 20, 183, "resonite"));
  e.apply((s) => d.setTile(s, 8, 180, "stone"));
  e.apply((s) => d.setTile(s, 22, 182, "gas"));
  e.apply((s) => d.setCargo(s, "cuprite", 8));
  e.apply((s) => d.setCargo(s, "argenite", 4));
  e.apply((s) => d.setMinerPosition(s, 14 * 80 + 12, 182 * 80 - 72));
  e.apply((s) => d.setMinerVelocity(s, 0, 0));
  await e.advance(1);
});
await page.screenshot({ path: "showcase/rockbed.png" });
await host.evaluate((e) => e.startRecording());
await page.keyboard.down("KeyS");
await host.evaluate(async (e) => {
  await e.advance(55);
});
await page.keyboard.up("KeyS");
await page.keyboard.down("Space");
await host.evaluate(async (e) => {
  await e.advance(45);
});
await page.keyboard.up("Space");
await host.evaluate(async (e) => {
  await e.advance(20);
});
const recording = await host.evaluate((e) => e.stopRecording());
await writeFile(
  "showcase/descent.json.gz",
  gzipSync(JSON.stringify(recording)),
);
await host.evaluate((e) => e.destroy());
await browser.close();
