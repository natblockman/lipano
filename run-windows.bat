@echo off
setlocal
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%~dp0desktop.py"
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  python "%~dp0desktop.py"
  exit /b
)
echo Python 3 was not found. Download lipano.exe from GitHub Releases instead.
pause
exit /b 1
