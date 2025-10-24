// (Skyrim) Save Game Installer SGI - Vortex
// Data-first scan (recursive inside Data only). If no Data/, treat mod root as virtual Data:
//   - look for *.ess at mod root
//   - look inside immediate subfolders whose name contains "save" (recursive)
// Moves .ess (+ matching .skse) into Documents\My Games\<Skyrim*\Saves.
// Triggers: startup, did-install-mod, deploy. Logs to Documents\SGI_Diag\SGI_SaveMover_RunLog.txt

const path = require('path');
const { util } = require('vortex-api');
const fs = require('fs');
const fsp = fs.promises;

const GIDS = ['skyrim', 'skyrimse']; // LE, SE/AE
const MOVE_INSTEAD_OF_COPY = true;
const DEBUG = false;

// --- toasts & run-log ---------------------------------------------------------
function notify(api, type, msg, ms = 6000) { try { api.sendNotification({ type, message: `[SGI] ${msg}`, displayMS: ms }); } catch {} }
function logToast(api, msg) { if (DEBUG) notify(api, 'info', msg, 4500); }
async function logLines(lines) {
  try {
    const docs = (util.getVortexPath && util.getVortexPath('documents')) || process.env.USERPROFILE || 'C:\\';
    const outDir = path.join(docs, 'SGI_Diag');
    const outFile = path.join(outDir, 'SGI_SaveMover_RunLog.txt');
    await fsp.mkdir(outDir, { recursive: true });
    await fsp.appendFile(outFile, `[${new Date().toISOString()}] ${lines.join('\n')}\n\n`, 'utf8');
    return outFile;
  } catch { return null; }
}

// --- fs helpers (Node-only) ---------------------------------------------------
async function exists(p) { try { await fsp.stat(p); return true; } catch { return false; } }
async function ensureDir(p) { await fsp.mkdir(p, { recursive: true }); }
async function readdirDirents(p) { try { return await fsp.readdir(p, { withFileTypes: true }); } catch { return []; } }
async function readdirNames(p) { try { return await fsp.readdir(p); } catch { return []; } }
async function copyFile(src, dst) {
  await ensureDir(path.dirname(dst));
  try { await fsp.copyFile(src, dst); }
  catch { const buf = await fsp.readFile(src); await fsp.writeFile(dst, buf); }
}
async function removeFile(p) { try { await fsp.unlink(p); } catch {} }

// --- paths --------------------------------------------------------------------
function appDataCandidates() {
  const out = [];
  try { const a = util.getVortexPath('appData'); if (a) out.push(a); } catch {}
  if (process.env.APPDATA) out.push(path.join(process.env.APPDATA, 'Vortex'));
  return Array.from(new Set(out.map(p => path.normalize(p))));
}
function stagingCandidates(gid) {
  const bases = appDataCandidates();
  const cand = [];
  for (const b of bases) cand.push(path.join(b, gid, 'mods'));
  try { const active = util.getVortexPath('install'); if (active) cand.push(path.normalize(active)); } catch {}
  return Array.from(new Set(cand));
}
function savesDirFor(gid) {
  const docs = (function(){ try { return util.getVortexPath('documents'); } catch {} return process.env.USERPROFILE || 'C:\\'; })();
  if (gid === 'skyrim')   return path.join(docs, 'My Games', 'Skyrim', 'Saves');
  if (gid === 'skyrimse') return path.join(docs, 'My Games', 'Skyrim Special Edition', 'Saves');
  return null;
}

// --- discovery inside Data (recursive) ---------------------------------------
function isEss(name) { return name.toLowerCase().endsWith('.ess'); }

async function listEssRecursive(dir) {
  const found = [];
  const dirents = await readdirDirents(dir);
  for (const de of dirents) {
    const full = path.join(dir, de.name);
    if (de.isDirectory()) {
      found.push(...await listEssRecursive(full));
    } else if (de.isFile() && isEss(de.name)) {
      found.push(full);
    }
  }
  return found;
}

async function addCoSaves(files) {
  const out = files.slice();
  for (const ess of files) {
    const co = ess.slice(0, -4) + '.skse';
    if (await exists(co)) out.push(co);
  }
  return out;
}

// Main gatherer:
// 1) If Data exists: recurse inside Data only.
// 2) If no Data: treat mod root as virtual Data:
//    - pick up *.ess at root (non-recursive)
//    - recurse into any immediate subfolder whose name contains "save"
async function gatherSaveFiles(modRoot, report) {
  const d1 = path.join(modRoot, 'Data');
  const d2 = path.join(modRoot, 'data');

  if (await exists(d1) || await exists(d2)) {
    const dataRoot = (await exists(d1)) ? d1 : d2;
    report.push(`  - Data root: ${dataRoot}`);
    const ess = await listEssRecursive(dataRoot);
    report.push(`    (Data scan) .ess files: ${ess.length}`);
    return await addCoSaves(ess);
  }

  report.push(`  - No Data folder in "${modRoot}" → treating mod root as Data`);
  const files = [];

  // root-level *.ess
  const names = await readdirNames(modRoot);
  const rootEss = names.filter(n => isEss(n)).map(n => path.join(modRoot, n));
  files.push(...rootEss);

  // immediate subfolders with "save" in the name (recurse)
  const dirents = await readdirDirents(modRoot);
  for (const de of dirents) {
    if (!de.isDirectory()) continue;
    const lbl = de.name.toLowerCase();
    if (lbl.includes('save')) {
      const sub = path.join(modRoot, de.name);
      report.push(`    - Save-like subdir: ${sub}`);
      const ess = await listEssRecursive(sub);
      files.push(...ess);
    }
  }

  report.push(`    (Root/Save-subdir scan) .ess files: ${files.length}`);
  return await addCoSaves(files);
}

// --- mover --------------------------------------------------------------------
async function moveOrCopy(src, dst, cut) { await copyFile(src, dst); if (cut) await removeFile(src); }

// --- per-mod / per-game -------------------------------------------------------
async function processModFolder(api, gid, modRoot, report) {
  report.push(`Scanning mod: ${modRoot}`);
  const files = await gatherSaveFiles(modRoot, report);
  report.push(`  -> Found ${files.length} candidate file(s)`);
  if (files.length === 0) return 0;

  const dstRoot = savesDirFor(gid);
  if (!dstRoot) { report.push(`  !! No savesDir for gid=${gid}`); return 0; }
  try { await ensureDir(dstRoot); } catch { notify(api, 'error', `Cannot access Saves for ${gid}`); return 0; }

  let moved = 0;
  for (const src of files) {
    const dst = path.join(dstRoot, path.basename(src));
    try { await moveOrCopy(src, dst, MOVE_INSTEAD_OF_COPY); moved++; report.push(`  MOVE "${src}" -> "${dst}"`); }
    catch (e) { report.push(`  !! Failed ${path.basename(src)}: ${String(e && e.message ? e.message : e)}`); }
  }
  if (moved > 0) notify(api, 'success', `Moved ${moved} save file(s) from ${path.basename(modRoot)} → ${gid} Saves`);
  return moved;
}

async function sweepGame(api, gid, reason) {
  const report = [`==== Sweep gid=${gid} [${reason}] ====`, `Candidates base(s):`];
  const stages = stagingCandidates(gid);
  for (const s of stages) report.push(`  * ${s}`);

  let total = 0;
  for (const stage of stages) {
    if (!(await exists(stage))) { report.push(`  - Missing stage: ${stage}`); continue; }
    const dirents = await readdirDirents(stage);
    report.push(` Stage ${stage} → ${dirents.length} entries`);
    for (const de of dirents) {
      if (!de.isDirectory()) continue;
      const modRoot = path.join(stage, de.name);
      total += await processModFolder(api, gid, modRoot, report);
    }
  }
  report.push(`Total moved (gid=${gid}): ${total}`);
  await logLines(report);
  if (total === 0 && DEBUG) logToast(api, `Scan[${gid}]: no saves detected (root/Data)`);
  return total;
}

// Attempt to use explicit path from install event if present
async function handleInstallEvent(api, gid, _archiveId, _modId, fullInfo) {
  const report = [`==== did-install-mod gid=${gid} ====`,];
  let modRoot = null;
  try {
    const p = fullInfo && (fullInfo.installationPath || fullInfo.installPath);
    if (p && typeof p === 'string') modRoot = p;
  } catch {}

  if (modRoot && !(await exists(modRoot))) modRoot = null;

  if (modRoot) {
    report.push(`Using fullInfo path: ${modRoot}`);
    const moved = await processModFolder(api, gid, modRoot, report);
    report.push(`Moved via fullInfo path: ${moved}`);
    await logLines(report);
    if (moved === 0) {
      await new Promise(r => setTimeout(r, 1500));
      const moved2 = await processModFolder(api, gid, modRoot, report);
      report.push(`Retry moved: ${moved2}`);
      await logLines(report);
    }
    return;
  }

  report.push(`No fullInfo path; fallback sweep ${gid}`);
  await logLines(report);
  await sweepGame(api, gid, 'install-fallback');
}

// --- entry --------------------------------------------------------------------
function init(context) {
  try {
    context.once(() => {
      const api = context.api;

      // Startup sweep
      setTimeout(() => {
        (async () => { for (const gid of GIDS) await sweepGame(api, gid, 'startup'); })()
          .catch(err => logLines([`!! Startup error: ${String(err && err.message ? err.message : err)}`]));
      }, 300);

      // Install-time
      api.events.on('did-install-mod', (gid, a, m, info) => {
        if (gid !== 'skyrim' && gid !== 'skyrimse') return;
        handleInstallEvent(api, gid, a, m, info)
          .catch(err => logLines([`!! Install handler error: ${String(err && err.message ? err.message : err)}`]));
      });

      // Deploy
      api.onAsync('did-deploy', async () => {
        for (const gid of GIDS) {
          try { await sweepGame(api, gid, 'deploy'); }
          catch (err) { await logLines([`!! Deploy sweep error: ${String(err && err.message ? err.message : err)}`]); }
        }
      });

      if (DEBUG) notify(api, 'info', 'Skyrim Save Auto-Mover v2.9 loaded (Data-first, root fallback)');
    });
  } catch (err) {
    try { logLines([`!! Extension init error: ${String(err && err.message ? err.message : err)}`]); } catch {}
    throw err;
  }
  return true;
}

exports.default = init;
