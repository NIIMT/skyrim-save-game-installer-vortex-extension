# (Skyrim) SGI Save Game Installer - Vortex 

Automatically moves Skyrim save files that ship inside mods from the **mod folder** into the correct **Documents\My Games\…\Saves** folder.

- Works with **Skyrim (LE)** and **Skyrim Special Edition / Anniversary (SE/AE)**
- No settings, no UI. Runs on **startup**, **mod install**, and **deploy**
- Finds saves in `Data\`, `Data\Saves\…`, `Data\Data\…`, or—if no `Data\`—at the **mod root** / a **“save”**-named subfolder
- Moves `.ess` and matching `.skse` co-saves

---

## Contents

SGI Save Game Installer/
index.js ← the extension code
info.json ← Vortex extension manifest
README.md ← this file 
Install.bat ← optional one-click installer


> If your download doesn’t include `Install.bat`, use **Manual install** below.

---

## Install 

### Option A — One-click (if `Install.bat` is included)

1) **Close Vortex completely** (also exit from the tray icon).  
2) Extract the zip. **Double-click `Install.bat`**.  
3) Start Vortex.

> The script copies the files to  
> `%APPDATA%\Vortex\plugins\SGI Save Game Installer\`

### Option B — Manual

1) **Close Vortex completely** (also exit from the tray icon).  
2) Create the folder (if it doesn’t exist):

%APPDATA%\Vortex\plugins\SGI Save Game Installer\


3) Copy **`index.js`** and **`info.json`** into that folder.  
4) Start Vortex.

Vortex automatically loads any extension found under `%APPDATA%\Vortex\plugins\*` at startup.

---


## How it works (short)

- On startup and after each **Deploy**, SGI scans:
  - `%APPDATA%\Vortex\skyrim\mods\*`
  - `%APPDATA%\Vortex\skyrimse\mods\*`
- For every mod folder:
  - If `Data\` exists → **recurses inside `Data` only** to find `.ess` (+ `.skse`)
  - If `Data\` does **not** exist → treats the **mod root** as “virtual Data”:
    - grabs root-level `.ess`
    - recurses into **immediate** subfolders whose name contains “save”
- Saves are moved to the correct game’s **Documents\My Games\…\Saves** (handles OneDrive/library redirection)

---

## Notes & FAQ

- **Vortex still shows the mod tile.**  
  Correct. SGI moves the **save files**, not the **mod entry**. Disable/remove the entry yourself if you don’t want to see it.

- **OneDrive / custom Documents location?**  
  Supported. SGI uses Vortex’s Documents path, so saves land in the right place.

- **LE vs SE/AE detection?**  
  SGI scans both `skyrim` and `skyrimse` staging trees and also reacts to Vortex’s install/deploy events for the correct game.

---

## Update

Close Vortex → overwrite `index.js` (and `info.json` if provided) in:

%APPDATA%\Vortex\plugins\SGI Save Game Installer\


Start Vortex.

---

## Uninstall

Close Vortex → delete:

%APPDATA%\Vortex\plugins\SGI Save Game Installer\


Start Vortex.

---

## Troubleshooting

- **“Nothing moved.”**  
  Put a `.ess` exactly in a **mod’s** `Data\` (or at the mod root if there is no `Data\`) under the staging folder, then click **Deploy** once.

- **“It moved, but the game’s Data still showed a file.”**  
  Vortex may have deployed a hardlink. Click **Deploy** again, or remove the leftover from `<Game>\Data` if it persists. (This does not affect your saves in Documents.)

---

*SGI Save Game Installer — made for Skyrim LE & SE/AE. No settings, no UI—just clean saves where they belong.*





