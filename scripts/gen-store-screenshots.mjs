#!/usr/bin/env node

/**
 * Generate Chrome Web Store screenshots using Puppeteer with the real extension loaded.
 * Usage: node scripts/gen-store-screenshots.mjs
 *
 * Produces 1280x800 PNGs in src/assets/store/screenshots/
 */

import puppeteer from 'puppeteer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'src/assets/store/screenshots');

const WIDTH = 1280;
const HEIGHT = 800;

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Styled test pages ─────────────────────────────────────────────

function videoPageHTML(title, channel, views, style = 'youtube') {
  const bgColor = style === 'dark' ? '#0f0f0f' : '#f9f9f9';
  const textColor = style === 'dark' ? '#f1f1f1' : '#0f0f0f';
  const mutedColor = style === 'dark' ? '#aaa' : '#606060';
  const cardBg = style === 'dark' ? '#212121' : '#fff';

  return `<!DOCTYPE html>
<html><head>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:${bgColor}; color:${textColor}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .layout { display:grid; grid-template-columns:1fr 380px; gap:24px; padding:24px 24px 24px 88px; }
  .player-area { position:relative; }
  .player-wrap { position:relative; width:100%; aspect-ratio:16/9; background:#000; border-radius:12px; overflow:hidden; }
  video { width:100%; height:100%; object-fit:cover; display:block; }
  .meta { padding:16px 0; }
  .meta h1 { font-size:20px; font-weight:600; line-height:1.3; margin-bottom:8px; }
  .meta-row { display:flex; align-items:center; gap:12px; color:${mutedColor}; font-size:14px; }
  .meta-row .channel { font-weight:500; color:${textColor}; }
  .sidebar { display:flex; flex-direction:column; gap:12px; }
  .sidebar-card { display:flex; gap:10px; background:${cardBg}; border-radius:8px; overflow:hidden; cursor:pointer; }
  .sidebar-thumb { width:168px; height:94px; background:linear-gradient(135deg,#555,#333); flex-shrink:0; }
  .sidebar-info { padding:8px 8px 8px 0; display:flex; flex-direction:column; gap:4px; }
  .sidebar-info h3 { font-size:13px; font-weight:500; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .sidebar-info span { font-size:11px; color:${mutedColor}; }
  .nav { height:56px; background:${cardBg}; border-bottom:1px solid ${style === 'dark' ? '#303030' : '#e0e0e0'}; display:flex; align-items:center; padding:0 24px 0 88px; gap:24px; }
  .nav-logo { font-size:20px; font-weight:700; color:#f00; letter-spacing:-0.5px; display:flex; align-items:center; gap:4px; }
  .nav-logo svg { width:28px; height:20px; }
  .nav-search { flex:1; max-width:560px; height:36px; border-radius:18px; border:1px solid ${style === 'dark' ? '#303030' : '#ccc'}; background:${bgColor}; padding:0 16px; font-size:14px; color:${textColor}; }
  .controls-bar { display:flex; align-items:center; gap:12px; margin-top:12px; }
  .ctrl-btn { padding:8px 16px; border-radius:20px; font-size:13px; font-weight:500; border:none; background:${style === 'dark' ? '#272727' : '#f0f0f0'}; color:${textColor}; cursor:pointer; }
  .ctrl-btn.active { background:${textColor}; color:${bgColor}; }
</style>
</head>
<body>
  <nav class="nav">
    <div class="nav-logo">
      <svg viewBox="0 0 90 20" fill="none"><rect width="28" height="20" rx="4" fill="#f00"/><path d="M11 5.5L20 10L11 14.5Z" fill="#fff"/><text x="33" y="15" font-size="16" font-weight="700" fill="${textColor}" font-family="sans-serif">YouTube</text></svg>
    </div>
    <input class="nav-search" placeholder="Search" />
  </nav>
  <div class="layout">
    <div class="player-area">
      <div class="player-wrap">
        <video controls autoplay muted loop>
          <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">
        </video>
      </div>
      <div class="meta">
        <h1>${title}</h1>
        <div class="meta-row">
          <span class="channel">${channel}</span>
          <span>•</span>
          <span>${views} views</span>
          <span>•</span>
          <span>3 weeks ago</span>
        </div>
        <div class="controls-bar">
          <button class="ctrl-btn active">👍 12K</button>
          <button class="ctrl-btn">👎</button>
          <button class="ctrl-btn">Share</button>
          <button class="ctrl-btn">Save</button>
        </div>
      </div>
    </div>
    <div class="sidebar">
      ${Array.from({ length: 6 }, (_, i) => `
        <div class="sidebar-card">
          <div class="sidebar-thumb" style="background:linear-gradient(${135 + i * 30}deg,hsl(${i * 60},40%,35%),hsl(${i * 60 + 30},30%,25%))"></div>
          <div class="sidebar-info">
            <h3>Related video suggestion ${i + 1} with a longer title</h3>
            <span>Channel ${i + 1} • ${Math.floor(Math.random() * 900 + 100)}K views</span>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body></html>`;
}

function coursePageHTML() {
  return `<!DOCTYPE html>
<html><head>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#1a1a2e; color:#eee; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .top-bar { height:64px; background:#16213e; display:flex; align-items:center; padding:0 32px; gap:24px; border-bottom:1px solid #1a1a3e; }
  .logo { font-size:22px; font-weight:700; color:#e94560; letter-spacing:-0.5px; }
  .breadcrumb { font-size:13px; color:#8a8ab0; }
  .breadcrumb a { color:#a0a0d0; text-decoration:none; }
  .layout { display:grid; grid-template-columns:1fr 360px; height:calc(100vh - 64px); }
  .player-section { background:#000; display:flex; align-items:center; justify-content:center; }
  video { width:100%; height:100%; object-fit:contain; }
  .sidebar { background:#16213e; padding:20px; overflow-y:auto; }
  .sidebar h2 { font-size:16px; font-weight:600; margin-bottom:4px; }
  .sidebar .course-sub { font-size:12px; color:#8a8ab0; margin-bottom:16px; }
  .lesson { display:flex; align-items:center; gap:12px; padding:12px; border-radius:8px; cursor:pointer; }
  .lesson:hover { background:#1a1a3e; }
  .lesson.active { background:#1f1f3f; border-left:3px solid #e94560; }
  .lesson-num { width:28px; height:28px; border-radius:50%; background:#1a1a3e; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:#8a8ab0; flex-shrink:0; }
  .lesson.active .lesson-num { background:#e94560; color:#fff; }
  .lesson.done .lesson-num { background:#0f3460; color:#4ecca3; }
  .lesson-info h3 { font-size:13px; font-weight:500; line-height:1.3; }
  .lesson-info span { font-size:11px; color:#8a8ab0; }
  .progress-bar { height:4px; background:#1a1a3e; border-radius:2px; margin-bottom:16px; }
  .progress-fill { height:100%; width:35%; background:linear-gradient(90deg,#e94560,#0f3460); border-radius:2px; }
</style>
</head>
<body>
  <div class="top-bar">
    <div class="logo">Coursera</div>
    <div class="breadcrumb"><a href="#">Courses</a> / <a href="#">Computer Science</a> / Data Structures</div>
  </div>
  <div class="layout">
    <div class="player-section">
      <video controls autoplay muted loop>
        <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">
      </video>
    </div>
    <div class="sidebar">
      <h2>Data Structures & Algorithms</h2>
      <p class="course-sub">Module 3 · 12 lessons · 2h 40m</p>
      <div class="progress-bar"><div class="progress-fill"></div></div>
      ${['Binary Trees Intro', 'Tree Traversal', 'BST Operations', 'AVL Trees', 'Red-Black Trees', 'B-Trees', 'Heaps & Priority Queues', 'Graph Basics', 'BFS & DFS', 'Shortest Paths'].map((title, i) => `
        <div class="lesson ${i < 3 ? 'done' : i === 3 ? 'active' : ''}">
          <div class="lesson-num">${i < 3 ? '✓' : i + 1}</div>
          <div class="lesson-info">
            <h3>${title}</h3>
            <span>${Math.floor(Math.random() * 15 + 8)}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}</span>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Launching Chrome with extension...');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: false,
    args: [
      `--load-extension=${DIST}`,
      `--disable-extensions-except=${DIST}`,
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-features=TranslateUI',
      `--window-size=${WIDTH},${HEIGHT + 100}`,
      '--allow-file-access-from-files',
    ],
    ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
    defaultViewport: { width: WIDTH, height: HEIGHT },
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  // Find the extension ID
  await sleep(2000);
  const targets = browser.targets();
  const extTarget = targets.find(
    (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')
  );

  if (!extTarget) {
    console.error('❌ Extension not found. Make sure dist/ is built.');
    await browser.close();
    process.exit(1);
  }

  const extId = new URL(extTarget.url()).hostname;
  console.log(`✅ Extension loaded: ${extId}`);

  // ── Screenshot 1: Video page with extension overlay ──
  console.log('\n📸 Screenshot 1: YouTube-like page with speed overlay...');
  const videoPage1 = videoPageHTML(
    'Advanced TypeScript Patterns — Mapped Types & Template Literals',
    'Matt Pocock',
    '284K',
    'dark'
  );
  const page1File = join(OUT, '_page1.html');
  writeFileSync(page1File, videoPage1);
  await page.goto(`file://${page1File}`, { waitUntil: 'domcontentloaded' });
  await sleep(3000); // Wait for video + extension to inject

  // Try to make the controller visible and set speed
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = 2.0;
      video.muted = true;
      video.play().catch(() => {});
    }
  });
  await sleep(1500);

  // Make the VSC controller visible
  await page.evaluate(() => {
    const controller = document.querySelector('.vsc-controller');
    if (controller && controller.shadowRoot) {
      const ctrl = controller.shadowRoot.querySelector('#controller');
      if (ctrl) ctrl.style.opacity = '1';
    }
  });
  await sleep(500);
  await page.screenshot({ path: join(OUT, 'screenshot-1-video-overlay.png') });
  console.log('   ✅ Saved screenshot-1-video-overlay.png');

  // ── Screenshot 2: Course page with overlay ──
  console.log('\n📸 Screenshot 2: Course/lecture page...');
  const coursePage = coursePageHTML();
  const page2File = join(OUT, '_page2.html');
  writeFileSync(page2File, coursePage);
  await page.goto(`file://${page2File}`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = 1.5;
      video.muted = true;
      video.play().catch(() => {});
    }
  });
  await sleep(1500);

  await page.evaluate(() => {
    const controller = document.querySelector('.vsc-controller');
    if (controller && controller.shadowRoot) {
      const ctrl = controller.shadowRoot.querySelector('#controller');
      if (ctrl) ctrl.style.opacity = '1';
    }
  });
  await sleep(500);
  await page.screenshot({ path: join(OUT, 'screenshot-2-course-overlay.png') });
  console.log('   ✅ Saved screenshot-2-course-overlay.png');

  // ── Screenshot 3: Popup as standalone page (composited over video background) ──
  console.log('\n📸 Screenshot 3: Popup over video page...');

  // Navigate main page back to the YouTube-like video page for background
  await page.goto(`file://${page1File}`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = 2.0;
      video.muted = true;
      video.play().catch(() => {});
    }
  });
  await sleep(1000);

  // Open the real popup page in a new tab so Chrome APIs work
  const popupPage = await browser.newPage();
  await popupPage.setViewport({ width: 320, height: 500 });

  // First create a composite page: video background + popup centered
  // We open the popup URL directly — it has full extension API access
  await popupPage.goto(`chrome-extension://${extId}/ui/popup/popup.html`, {
    waitUntil: 'domcontentloaded',
  });
  await sleep(2000);

  // Now composite: take a screenshot of the video page as background,
  // and the popup, then combine them using a page
  const videoBgDataUrl = await page.screenshot({ encoding: 'base64' });
  // Get the actual popup body height to clip the screenshot properly
  const popupBodyHeight = await popupPage.evaluate(() => document.body.scrollHeight);
  const popupDataUrl = await popupPage.screenshot({
    encoding: 'base64',
    clip: { x: 0, y: 0, width: 320, height: Math.min(popupBodyHeight, 500) },
  });

  // Create a composite page
  const compositePage = await browser.newPage();
  await compositePage.setViewport({ width: WIDTH, height: HEIGHT });
  const compositeHTML = `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; }
  body { width:${WIDTH}px; height:${HEIGHT}px; position:relative; overflow:hidden; }
  .bg { width:100%; height:100%; object-fit:cover; }
  .popup-frame {
    position:absolute; top:40px; right:80px;
    width:320px;
    border-radius:14px; overflow:hidden;
    box-shadow: 0 12px 48px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25);
  }
  .popup-frame img { width:100%; display:block; }
  .scrim { position:absolute; inset:0; background:rgba(0,0,0,0.15); }
</style></head>
<body>
  <img class="bg" src="data:image/png;base64,${videoBgDataUrl}" />
  <div class="scrim"></div>
  <div class="popup-frame">
    <img src="data:image/png;base64,${popupDataUrl}" />
  </div>
</body></html>`;
  const compositeFile = join(OUT, '_composite.html');
  writeFileSync(compositeFile, compositeHTML);
  await compositePage.goto(`file://${compositeFile}`, { waitUntil: 'domcontentloaded' });
  await sleep(500);
  await compositePage.screenshot({ path: join(OUT, 'screenshot-3-popup-on-video.png') });
  console.log('   ✅ Saved screenshot-3-popup-on-video.png');
  await popupPage.close();
  await compositePage.close();
  try { unlinkSync(compositeFile); } catch {}

  // ── Screenshot 4: Options page ──
  console.log('\n📸 Screenshot 4: Options/settings page...');
  const optionsPage = await browser.newPage();
  await optionsPage.setViewport({ width: WIDTH, height: HEIGHT });
  await optionsPage.goto(`chrome-extension://${extId}/ui/options/options.html`, {
    waitUntil: 'domcontentloaded',
  });
  await sleep(2000);
  await optionsPage.screenshot({ path: join(OUT, 'screenshot-4-settings.png') });
  console.log('   ✅ Saved screenshot-4-settings.png');

  // ── Screenshot 5: Options page scrolled to shortcuts ──
  console.log('\n📸 Screenshot 5: Shortcuts section...');
  await optionsPage.evaluate(() => {
    const shortcuts = document.querySelector('#customs');
    if (shortcuts) shortcuts.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(500);
  await optionsPage.screenshot({ path: join(OUT, 'screenshot-5-shortcuts.png') });
  console.log('   ✅ Saved screenshot-5-shortcuts.png');

  // Clean up temp HTML files
  try { unlinkSync(page1File); } catch {}
  try { unlinkSync(page2File); } catch {}

  await optionsPage.close();
  await browser.close();

  console.log(`\n✅ All screenshots saved to ${OUT}/`);
  console.log('   Files:');
  console.log('   - screenshot-1-video-overlay.png   (YouTube-like with speed overlay)');
  console.log('   - screenshot-2-course-overlay.png   (Course page with overlay)');
  console.log('   - screenshot-3-popup-on-video.png   (Popup over video)');
  console.log('   - screenshot-4-settings.png         (Options page)');
  console.log('   - screenshot-5-shortcuts.png        (Shortcuts section)');
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
