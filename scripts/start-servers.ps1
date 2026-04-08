param(
  [string]$ProjectRoot = "",
  [string]$PreviewDir = "",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Stop-PortProcess {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    return
  }

  foreach ($connection in $connections) {
    $processId = $connection.OwningProcess
    if ($processId) {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($process) {
        Stop-Process -Id $process.Id -Force
      }
    }
  }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 25
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Seconds 2
    try {
      $response = Invoke-RestMethod -Uri $Url -TimeoutSec 3
      if ($null -ne $response) {
        return $true
      }
    } catch {
      continue
    }
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Start-BackgroundNpmScript {
  param(
    [string]$Workdir,
    [string]$ScriptName,
    [string]$LogPath
  )

  Start-Process `
    -FilePath "powershell" `
    -ArgumentList @(
      "-NoProfile",
      "-Command",
      "Set-Location '$Workdir'; npm run $ScriptName *> '$LogPath'"
    ) `
    -WindowStyle Hidden | Out-Null
}

function Ensure-Dependencies {
  param([string]$Workdir)

  $nodeModules = Join-Path $Workdir "node_modules"
  if (Test-Path $nodeModules) {
    return
  }

  Push-Location $Workdir
  try {
    npm install
  } finally {
    Pop-Location
  }
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
}

$resolvedRoot = (Resolve-Path $ProjectRoot).ProviderPath

if ([string]::IsNullOrWhiteSpace($PreviewDir)) {
  $resolvedPreview = Join-Path (Split-Path $resolvedRoot -Parent) "multi-agent-workspace"
} else {
  $resolvedPreview = $PreviewDir
}

Write-Host ""
Write-Host "[1/4] 기존 서버 정리"
Stop-PortProcess -Port 3030
Stop-PortProcess -Port 4040

if (-not $SkipInstall) {
  Write-Host "[2/4] 의존성 확인"
  Ensure-Dependencies -Workdir $resolvedRoot
  if (Test-Path (Join-Path $resolvedPreview "package.json")) {
    Ensure-Dependencies -Workdir $resolvedPreview
  }
}

Write-Host "[3/4] 메인 서버 시작"
Start-BackgroundNpmScript `
  -Workdir $resolvedRoot `
  -ScriptName "web" `
  -LogPath (Join-Path $resolvedRoot ".web-server.log")

$mainReady = Wait-HttpReady -Url "http://127.0.0.1:3030/api/health"
if (-not $mainReady) {
  throw "메인 멀티에이전트 서버(3030)가 준비되지 않았습니다."
}

$previewStarted = $false
if (Test-Path (Join-Path $resolvedPreview "package.json")) {
  Write-Host "[4/4] 생성 앱 미리보기 서버 시작"
  Start-BackgroundNpmScript `
    -Workdir $resolvedPreview `
    -ScriptName "dev" `
    -LogPath (Join-Path $resolvedPreview "app-runtime.log")

  $previewStarted = Wait-HttpReady -Url "http://127.0.0.1:4040/api/health"
}

Write-Host ""
Write-Host "메인 UI: http://127.0.0.1:3030"
Write-Host "헬스체크: http://127.0.0.1:3030/api/health"

if ($previewStarted) {
  Write-Host "생성 앱 미리보기: http://127.0.0.1:4040"
  Write-Host "앱 헬스체크: http://127.0.0.1:4040/api/health"
} elseif (Test-Path (Join-Path $resolvedPreview "package.json")) {
  Write-Host "생성 앱 미리보기 서버는 시작 요청했지만 4040 응답을 아직 확인하지 못했습니다."
  Write-Host "로그: $(Join-Path $resolvedPreview 'app-runtime.log')"
} else {
  Write-Host "생성 앱 워크스페이스를 찾지 못해 4040 서버는 건너뛰었습니다."
  Write-Host "예상 경로: $resolvedPreview"
}

Write-Host ""
Write-Host "메인 서버 로그: $(Join-Path $resolvedRoot '.web-server.log')"
