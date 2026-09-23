@echo off
title Trading Journal - Production Mode (High Performance)

echo ======================================================================
echo   KHOI DONG TRADING JOURNAL - CHE DO PRODUCTION (TOI DA TOC DO)
echo ======================================================================
echo.

:: Backend
echo Dang khoi dong Backend (Strapi Start)...
start "TradingJournal - Backend (Prod)" cmd /k "cd /d %~dp0backend && yarn run start:prod"

:: Frontend
echo Dang khoi dong Frontend (Vite Fast Bundle Preview)...
start "TradingJournal - Frontend (Prod)" cmd /k "cd /d %~dp0frontend && yarn run preview"

:: Ngrok
echo Dang khoi dong Ngrok tunnel...
start "TradingJournal - Ngrok" cmd /k "npx ngrok http 1337"