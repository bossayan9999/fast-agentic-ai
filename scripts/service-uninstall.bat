@echo off
set SERVICE_NAME=FastAgentOS
cd /d "%~dp0.."
set NSSM=
if exist "%CD%\tools\nssm\nssm.exe" set NSSM=%CD%\tools\nssm\nssm.exe
if exist "%CD%\tools\nssm\win64\nssm.exe" set NSSM=%CD%\tools\nssm\win64\nssm.exe
if exist "C:\nssm\win64\nssm.exe" set NSSM=C:\nssm\win64\nssm.exe
where nssm >nul 2>&1 && for /f "delims=" %%i in ('where nssm') do set NSSM=%%i

if defined NSSM (
  "%NSSM%" stop %SERVICE_NAME% confirm
  "%NSSM%" remove %SERVICE_NAME% confirm
) else (
  sc stop %SERVICE_NAME%
  sc delete %SERVICE_NAME%
)
echo Removed %SERVICE_NAME%.
pause
