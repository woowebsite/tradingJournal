@echo off
title Trading Journal - Development Mode

:: Backend
start "TradingJournal - Backend (Dev)" cmd /k "cd /d %~dp0backend && yarn run dev"

:: Frontend
start "TradingJournal - Frontend (Dev)" cmd /k "cd /d %~dp0frontend && yarn run dev"

:: Ngrok
start "TradingJournal - Ngrok" cmd /k "npx ngrok http 1337"