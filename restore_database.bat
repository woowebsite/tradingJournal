@echo off
chcp 65001 >nul
title Restore Database - tradingjournal

echo ====================================================
echo         TIEN HANH RESTORE DATABASE POSTGRESQL
echo ====================================================
echo.

:: Cau hinh thong so ket noi tu .env
set DB_HOST=localhost
set DB_PORT=5433
set DB_NAME=tradingjournal
set DB_USER=postgres
set PGPASSWORD=123456
set SQL_FILE=D:\PROGRAMMING\MyGithub\tradingJournal\backend\database\backup_tradingjournaldev_--_--.sql

:: Kiem tra file sql co ton tai khong
if not exist "%SQL_FILE%" (
    echo [ERROR] Khong tim thay file SQL tai:
    echo "%SQL_FILE%"
    echo.
    pause
    exit /b 1
)

:: Tim kiem psql.exe
set "PSQL_CMD="
where psql >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PSQL_CMD=psql"
) else (
    echo [INFO] psql chua co trong PATH, dang tim kiem trong Program Files...
    for /d %%D in ("C:\Program Files\PostgreSQL\*") do (
        if exist "%%D\bin\psql.exe" set "PSQL_CMD=%%D\bin\psql.exe"
    )
    if not defined PSQL_CMD (
        for /d %%D in ("C:\Program Files (x86)\PostgreSQL\*") do (
            if exist "%%D\bin\psql.exe" set "PSQL_CMD=%%D\bin\psql.exe"
        )
    )
)

if not defined PSQL_CMD (
    echo [ERROR] Khong tim thay PostgreSQL psql.exe tren he thong!
    echo Vui long kiem tra lai duong dan hoac them thu muc bin cua PostgreSQL vao PATH.
    echo.
    pause
    exit /b 1
)

echo [1/3] Su dung: "%PSQL_CMD%"
echo [2/3] Dang ket noi toi %DB_HOST%:%DB_PORT%, Database: %DB_NAME% (User: %DB_USER%)...
echo [3/3] Dang import du lieu tu file:
echo       %SQL_FILE%
echo.

:: Chay lenh psql de restore
"%PSQL_CMD%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SQL_FILE%"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ====================================================
    echo   [SUCCESS] Restore database THANH CONG!
    echo ====================================================
) else (
    echo.
    echo ====================================================
    echo   [WARNING/ERROR] Co loi hoac chu y trong qua trinh restore.
    echo   Vui long kiem tra lai thong tin ket noi / log o tren.
    echo ====================================================
)

echo.
pause
