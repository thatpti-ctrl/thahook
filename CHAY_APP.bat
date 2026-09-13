@echo off
chcp 65001 >nul
cd /d "%~dp0"
title THAHOOK - May chu (KHONG dong cua so nay khi dang day)

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js.
  echo Vui long cai Node.js tai https://nodejs.org roi chay lai file nay.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo Lan dau chay: dang cai dat thu vien, vui long doi mot chut...
  call npm install
)

echo.
echo ==================================================
echo   Trinh duyet se TU MO man hinh giao vien sau vai giay.
echo   GIU NGUYEN cua so den nay trong suot buoi day.
echo   (Dong cua so nay = tat may chu)
echo ==================================================
echo.

start /min "" "%~dp0_open_browser.bat"
call npm start
pause
