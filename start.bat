@echo off
title Aplikasi Suka Duka Guru & Pegawai Sekolah
echo ========================================================
echo   MENJALANKAN APLIKASI SUKA DUKA GURU DAN PEGAWAI
echo ========================================================
echo.
echo Membuka server lokal di port 3000...
echo.
start http://localhost:3000
node --watch server.js
pause

