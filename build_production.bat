@echo off
title Build Trading Journal - Production Release

echo ======================================================================
echo       TIEN HANH BUILD NHANH BAN PRODUCTION TRADING JOURNAL
echo ======================================================================
echo.

set "ROOT_DIR=%~dp0"
set "PACKAGE_MANAGER=yarn"

where yarn >nul 2>nul
if %ERRORLEVEL% neq 0 (
    set "PACKAGE_MANAGER=npm"
)

echo [INFO] Su dung trinh quan ly goi: %PACKAGE_MANAGER%
echo [INFO] Thu muc goc du an: %ROOT_DIR%
echo.

REM ====================================================================
REM 1. BUILD BACKEND (STRAPI PRODUCTION)
REM ====================================================================
echo ----------------------------------------------------------------------
echo [1/2] Dang Build Backend (Strapi Production)...
echo ----------------------------------------------------------------------
cd /d "%ROOT_DIR%backend"

if "%PACKAGE_MANAGER%"=="yarn" (
    call yarn run build:prod
) else (
    call npm run build:prod
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo ======================================================================
    echo   [ERROR] Qua trinh build Backend that bai! Vui long kiem tra loi tren.
    echo ======================================================================
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [OK] Backend build thanh cong!
echo.

REM ====================================================================
REM 2. BUILD FRONTEND (VITE + REACT PRODUCTION)
REM ====================================================================
echo ----------------------------------------------------------------------
echo [2/2] Dang Build Frontend (Vite + React Production)...
echo ----------------------------------------------------------------------
cd /d "%ROOT_DIR%frontend"

if "%PACKAGE_MANAGER%"=="yarn" (
    call yarn run build:prod
) else (
    call npm run build:prod
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo ======================================================================
    echo   [ERROR] Qua trinh build Frontend that bai! Vui long kiem tra loi tren.
    echo ======================================================================
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [OK] Frontend build thanh cong!
echo.

REM ====================================================================
REM HOAN TAT
REM ====================================================================
cd /d "%ROOT_DIR%"
echo ======================================================================
echo   [SUCCESS] TOAN BO DU AN DA DUOC BUILD PRODUCTION THANH CONG!
echo ======================================================================
echo   - Backend: Dist va Admin panel da duoc toi uu hoa cho Production.
echo   - Frontend: Dist bundle (HTML/CSS/JS) da duoc nen va toi uu hoa.
echo.
echo   Ban co the nhap dup file "run prod.bat" de khoi dong che do Production.
echo ======================================================================
echo.
pause
