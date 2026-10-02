@echo off

echo ==============================
echo Status do repositorio:
echo ==============================
git status

echo.
set /p "mensagem=Digite a mensagem do commit: "

if "%mensagem%"=="" (
    echo.
    echo A mensagem do commit nao pode estar vazia.
    pause
    exit /b 1
)

echo.
echo ==============================
echo Adicionando arquivos...
echo ==============================
git add .

echo.
echo ==============================
echo Criando commit...
echo ==============================
git commit -m "%mensagem%"

if errorlevel 1 (
    echo.
    echo O commit falhou. O push nao sera executado.
    pause
    exit /b 1
)

echo.
echo ==============================
echo Enviando para o GitHub...
echo ==============================
git push origin main

echo.
echo ==============================
echo Processo concluido.
echo ==============================
pause