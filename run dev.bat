@echo off

:: Backend
start cmd /k "cd /d D:\PROGRAMMING\MyGithub\tradingJournal\backend && yarn run dev"

:: Frontend
start cmd /k "cd /d D:\PROGRAMMING\MyGithub\tradingJournal\frontend && yarn run dev"

:: Ngrok
start cmd /k "npx ngrok http 1337"