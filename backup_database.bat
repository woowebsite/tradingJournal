@echo off
chcp 65001 >nul
title Backup Database - tradingjournaldev

echo ====================================================
echo         TIEN HANH BACKUP DATABASE POSTGRESQL
echo ====================================================
echo.

:: Cau hinh thong so ket noi tu .env.dev
set DB_HOST=localhost
set DB_PORT=5433
set DB_NAME=tradingjournaldev
set DB_USER=postgres
set PGPASSWORD=123456

:: Thu muc luu tru backup
set BACKUP_DIR=D:\PROGRAMMING\MyGithub\tradingJournal\backend\database

:: Tao thu muc neu chua ton tai
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

:: Lay ngay gio hien tai de dat ten file (dinh dang: YYYY-MM-DD_HH-MM-SS)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set "DT=%%I"
if defined DT (
    set "YYYY=%DT:~0,4%"
    set "MM=%DT:~4,2%"
    set "DD=%DT:~6,2%"
    set "HH=%DT:~8,2%"
    set "MIN=%DT:~10,2%"
    set "SEC=%DT:~12,2%"
    set "BACKUP_FILE=%BACKUP_DIR%\backup_%DB_NAME%_%YYYY%-%MM%-%DD%_%HH%-%MIN%-%SEC%.sql"
) else (
    set "BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_backup.sql"
)

:: Tim kiem pg_dump.exe
set "PGDUMP_CMD="
where pg_dump >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PGDUMP_CMD=pg_dump"
) else (
    echo [INFO] pg_dump chua co trong PATH, dang tim kiem trong Program Files...
    for /d %%D in ("C:\Program Files\PostgreSQL\*") do (
        if exist "%%D\bin\pg_dump.exe" set "PGDUMP_CMD=%%D\bin\pg_dump.exe"
    )
    if not defined PGDUMP_CMD (
        for /d %%D in ("C:\Program Files (x86)\PostgreSQL\*") do (
            if exist "%%D\bin\pg_dump.exe" set "PGDUMP_CMD=%%D\bin\pg_dump.exe"
        )
    )
)

if not defined PGDUMP_CMD (
    echo [ERROR] Khong tim thay PostgreSQL pg_dump.exe tren he thong!
    echo Vui long kiem tra lai duong dan hoac them thu muc bin cua PostgreSQL vao PATH.
    echo.
    pause
    exit /b 1
)

echo [1/3] Su dung: "%PGDUMP_CMD%"
echo [2/3] Dang ket noi toi %DB_HOST%:%DB_PORT%, Database: %DB_NAME% (User: %DB_USER%)...
echo [3/3] Dang xuat du lieu ra file:
echo       %BACKUP_FILE%
echo.

:: Chay lenh pg_dump (xuat dinh dang SQL text kem schema + data)
"%PGDUMP_CMD%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --clean --if-exists -F p -f "%BACKUP_FILE%"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ====================================================
    echo   [SUCCESS] Backup database THANH CONG!
    echo   File da luu tai: %BACKUP_FILE%
    echo ====================================================
) else (
    echo.
    echo ====================================================
    echo   [WARNING/ERROR] Co loi xay ra trong qua trinh backup.
    echo   Vui long kiem tra lai log o tren.
    echo ====================================================
)

echo.
pause
