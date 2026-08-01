@echo off
:: Install Fast Agent OS as a Windows Service via NSSM (Run as Administrator)
set SERVICE_NAME=FastAgentOS
cd /d "%~dp0.."
set PROJECT_DIR=%CD%

echo ========================================
echo  Fast Agent OS - Windows Service Install
echo ========================================
echo Project: %PROJECT_DIR%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node.exe not in PATH. Install Node.js LTS first.
  pause
  exit /b 1
)

set NPM_CMD=
for /f "delims=" %%i in ('where npm.cmd 2^>nul') do set NPM_CMD=%%i
if not defined NPM_CMD for /f "delims=" %%i in ('where npm') do set NPM_CMD=%%i
if not defined NPM_CMD (
  echo ERROR: npm not found.
  pause
  exit /b 1
)

set NSSM=
if exist "%PROJECT_DIR%\tools\nssm\nssm.exe" set NSSM=%PROJECT_DIR%\tools\nssm\nssm.exe
if exist "%PROJECT_DIR%\tools\nssm\win64\nssm.exe" set NSSM=%PROJECT_DIR%\tools\nssm\win64\nssm.exe
if exist "C:\nssm\win64\nssm.exe" set NSSM=C:\nssm\win64\nssm.exe
if exist "C:\nssm\nssm.exe" set NSSM=C:\nssm\nssm.exe
where nssm >nul 2>&1 && for /f "delims=" %%i in ('where nssm') do set NSSM=%%i

if not defined NSSM (
  echo NSSM not found.
  echo 1. Download https://nssm.cc/download
  echo 2. Put nssm.exe in C:\nssm\win64\ or tools\nssm\
  echo 3. Re-run as Administrator.
  pause
  exit /b 1
)

echo NSSM: %NSSM%
echo npm:  %NPM_CMD%
echo.

if not exist "%PROJECT_DIR%\.next" (
  echo Building production app...
  call npm run build:next
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
  )
)

"%NSSM%" status %SERVICE_NAME% >nul 2>&1
if not errorlevel 1 (
  echo Removing existing service...
  "%NSSM%" stop %SERVICE_NAME% confirm >nul 2>&1
  "%NSSM%" remove %SERVICE_NAME% confirm >nul 2>&1
)

echo Installing %SERVICE_NAME% ...
"%NSSM%" install %SERVICE_NAME% "%NPM_CMD%" run start
if errorlevel 1 (
  echo Install failed. Use Administrator CMD.
  pause
  exit /b 1
)

"%NSSM%" set %SERVICE_NAME% AppDirectory "%PROJECT_DIR%"
"%NSSM%" set %SERVICE_NAME% DisplayName "Fast Agent OS"
"%NSSM%" set %SERVICE_NAME% Description "Fast Agentic AI - Next.js on port 3000"
"%NSSM%" set %SERVICE_NAME% Start SERVICE_AUTO_START
if not exist "%PROJECT_DIR%\logs" mkdir "%PROJECT_DIR%\logs"
"%NSSM%" set %SERVICE_NAME% AppStdout "%PROJECT_DIR%\logs\service-stdout.log"
"%NSSM%" set %SERVICE_NAME% AppStderr "%PROJECT_DIR%\logs\service-stderr.log"
"%NSSM%" set %SERVICE_NAME% AppRotateFiles 1
"%NSSM%" set %SERVICE_NAME% AppRotateBytes 1048576
"%NSSM%" set %SERVICE_NAME% AppRestartDelay 5000

echo Starting...
"%NSSM%" start %SERVICE_NAME%
echo.
echo Done. URL: http://localhost:3000
echo Manage: services.msc  or  net start/stop FastAgentOS
echo Logs: %PROJECT_DIR%\logs\
pause
