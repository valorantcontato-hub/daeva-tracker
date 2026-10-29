# Prepara a ponte de captura: baixa/atualiza o motor do Aion2DpsMeter e compila daeva-capture.exe.
# Requisitos: git, .NET 10 SDK e Npcap (com "WinPcap API-compatible Mode").
#   setup.ps1 [-Out <pasta de saída>] [-SelfContained]
#   -SelfContained: exe único com o runtime .NET embutido (usado no instalador; o usuário não precisa do .NET).
param([string]$Out = (Join-Path $PSScriptRoot 'bin'), [switch]$SelfContained)
$ErrorActionPreference = 'Stop'

function Run($exe, [string[]]$argv) {
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { throw "$exe falhou (código $LASTEXITCODE)" }
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Instale o .NET 10 SDK: https://dotnet.microsoft.com/download' }
if (-not (Test-Path "$env:WINDIR\System32\Npcap\wpcap.dll")) { Write-Warning 'Npcap não encontrado. Instale em https://npcap.com marcando "WinPcap API-compatible Mode".' }

# Caminho curto: o repositório tem arquivos profundos e estoura o limite de 260 caracteres do Windows.
$engine = Join-Path $env:LOCALAPPDATA 'DaevaTracker\engine\Aion2DPSMeter'
if (Test-Path (Join-Path $engine '.git')) {
  Run git @('-C', $engine, 'pull', '--ff-only')
} else {
  New-Item -ItemType Directory -Force (Split-Path $engine) | Out-Null
  Run git @('-c', 'core.longpaths=true', 'clone', '--depth', '1', 'https://github.com/domel1998/Aion2DPSMeter.git', $engine)
}
$commit = (& git -C $engine rev-parse --short HEAD)
Run node @((Join-Path $PSScriptRoot 'patch-engine.mjs'), $engine)

$pack = if ($SelfContained) { @('--self-contained', 'true', '-p:PublishSingleFile=true', '-p:IncludeNativeLibrariesForSelfExtract=true') } else { @('--self-contained', 'false') }
Run dotnet (@('publish', (Join-Path $PSScriptRoot 'CaptureBridge.csproj'), '-c', 'Release', '-r', 'win-x64', "-p:EngineDir=$engine", '-o', $Out) + $pack)
Set-Content -Path (Join-Path $Out 'engine-version.txt') -Value $commit -Encoding utf8
Write-Host "`nPronto: $Out\daeva-capture.exe (motor $commit)."
