@echo off
setlocal EnableExtensions
set "SRC=%~dp0Skyrim Save Game Installer"
set "DST=%APPDATA%\Vortex\plugins\Skyrim Save Game Installer"

if not exist "%SRC%\index.js" (
  echo [ERROR] Couldn't find "Skyrim Save Game Installer\index.js" next to this installer.
  echo Make sure the zip contains the folder and this script side-by-side.
  pause
  exit /b 1
)

mkdir "%DST%" 2>nul
copy /y "%SRC%\index.js" "%DST%\index.js" >nul
copy /y "%SRC%\info.json" "%DST%\info.json" >nul

echo Installed to:
echo   "%DST%"
echo.
echo Now start Vortex.
pause
exit /b 0
