@echo off
setlocal
if defined GEORAMP_QGIS_ROOT goto configured
set "GEORAMP_QGIS_ROOT=C:\Program Files\QGIS 3.44.12"
:configured
call "%GEORAMP_QGIS_ROOT%\bin\python-qgis-ltr.bat" %*
exit /b %errorlevel%
