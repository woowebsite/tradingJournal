@echo off

:: Backend
start cmd /k "cd /d D:\PROGRAMMING\MyGithub\tradingJournal\backend && yarn run prod"

:: Frontend
start cmd /k "cd /d D:\PROGRAMMING\MyGithub\tradingJournal\frontend && yarn run prod"

:: Ngrok
start cmd /k "npx ngrok http 1337"