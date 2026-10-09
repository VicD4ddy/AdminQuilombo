@echo off
title El Quilombo - Servidor y Tunel Cloudflare
echo ========================================================
echo   EL QUILOMBO - CONTROL DE ACCESO EN LA NUBE
echo ========================================================
echo.
echo 1. Iniciando servidor local en puerto 3000...
start /b node server.js
timeout /t 2 >nul
echo.
echo 2. Creando enlace publico seguro HTTPS con Cloudflare...
echo    (Copia y abre este enlace en cualquier telefono movil)
echo.
.\cloudflared.exe tunnel --url http://localhost:3000
pause
