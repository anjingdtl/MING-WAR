@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "START_BAT=%~dp0start.bat"
set "WORK_DIR=%~dp0"

echo 正在创建桌面快捷方式 ...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $desktop=[Environment]::GetFolderPath('Desktop'); $lnkPath=Join-Path $desktop '万历：山河崩塌.lnk'; $lnk=$ws.CreateShortcut($lnkPath); $lnk.TargetPath=$env:START_BAT; $lnk.WorkingDirectory=$env:WORK_DIR; $lnk.WindowStyle=1; $lnk.Description='万历：山河崩塌 一键启动'; $lnk.Save(); Write-Host ('已创建: '+$lnkPath)"

if errorlevel 1 (
    echo.
    echo [错误] 快捷方式创建失败，请查看上方错误信息。
    pause
    exit /b 1
)

echo.
echo 完成！桌面已生成「万历：山河崩塌」图标，双击即可启动游戏。
echo.
pause
