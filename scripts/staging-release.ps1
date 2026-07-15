[CmdletBinding()]
param(
    [ValidateSet("Preflight", "Deploy", "Smoke", "Rollback")][string]$Action = "Preflight",
    [string]$EnvironmentFile = "deploy/staging/.env",
    [string]$EvidenceDirectory = "deploy/staging/evidence"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $root "deploy/staging/docker-compose.yml"
$envFile = Join-Path $root $EnvironmentFile
$evidence = Join-Path $root $EvidenceDirectory

function Read-ReleaseValue([string]$Name) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^$Name=" } | Select-Object -Last 1
    if (-not $line) { throw "$Name is missing from $EnvironmentFile" }
    return ($line -split "=", 2)[1].Trim()
}

function Invoke-Preflight {
    if (-not (Test-Path $envFile)) { throw "Copy deploy/staging/.env.example to $EnvironmentFile first." }
    $raw = Get-Content $envFile -Raw
    if ($raw -match "replace-with|example\.invalid|:latest") { throw "Environment contains placeholders or a mutable latest tag." }
    foreach ($name in @("RELEASE_VERSION", "PREVIOUS_RELEASE_VERSION", "JWT_SECRET", "POSTGRES_PASSWORD",
            "PASSWORD_RESET_FINGERPRINT_SECRET", "OBJECT_STORAGE_SECRET_KEY", "GRAFANA_ADMIN_PASSWORD", "ALERT_WEBHOOK_URL")) {
        if ([string]::IsNullOrWhiteSpace((Read-ReleaseValue $name))) { throw "$name cannot be blank" }
    }
    $webhook = Read-ReleaseValue "ALERT_WEBHOOK_URL"
    $uri = $null
    if (-not [Uri]::TryCreate($webhook, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne "https" -or $webhook -match '["\s]') {
        throw "ALERT_WEBHOOK_URL must be an approved absolute HTTPS URL without whitespace."
    }
    $template = Join-Path $root "deploy/staging/alertmanager/alertmanager.template.yml"
    $generated = Join-Path $root "deploy/staging/alertmanager/alertmanager.generated.yml"
    (Get-Content $template -Raw).Replace("__ALERT_WEBHOOK_URL__", $webhook) | Set-Content -Encoding utf8 $generated
    $token = Join-Path $root "deploy/staging/secrets/prometheus-bearer-token"
    if (-not (Test-Path $token) -or (Get-Item $token).Length -eq 0) {
        throw "Create deploy/staging/secrets/prometheus-bearer-token with a PLATFORM_ADMIN JWT."
    }
    docker compose --env-file $envFile -f $compose config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose validation failed." }
}

function Invoke-Smoke {
    $deadline = (Get-Date).AddMinutes(3)
    do {
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:8080/actuator/health/readiness" -TimeoutSec 5
            if ($health.status -eq "UP") { return }
        } catch { Start-Sleep -Seconds 5 }
    } while ((Get-Date) -lt $deadline)
    throw "Backend readiness did not become UP within three minutes."
}

Invoke-Preflight
if ($Action -eq "Preflight") { Write-Host "Staging preflight passed."; exit 0 }
New-Item -ItemType Directory -Force $evidence | Out-Null
$release = Read-ReleaseValue "RELEASE_VERSION"
$started = Get-Date

if ($Action -eq "Deploy") {
    docker compose --env-file $envFile -f $compose pull
    if ($LASTEXITCODE -ne 0) { throw "Image pull failed." }
    docker compose --env-file $envFile -f $compose up -d --remove-orphans
    if ($LASTEXITCODE -ne 0) { throw "Staging deployment failed." }
    Invoke-Smoke
} elseif ($Action -eq "Smoke") {
    Invoke-Smoke
} elseif ($Action -eq "Rollback") {
    $release = Read-ReleaseValue "PREVIOUS_RELEASE_VERSION"
    $env:RELEASE_VERSION = $release
    try {
        docker compose --env-file $envFile -f $compose pull backend frontend
        docker compose --env-file $envFile -f $compose up -d --no-deps backend frontend
        if ($LASTEXITCODE -ne 0) { throw "Rollback failed." }
        Invoke-Smoke
    } finally { Remove-Item Env:RELEASE_VERSION -ErrorAction SilentlyContinue }
}

[ordered]@{
    issue = "DAI-315"; action = $Action; releaseVersion = $release
    startedAt = $started.ToUniversalTime().ToString("o")
    completedAt = (Get-Date).ToUniversalTime().ToString("o"); readiness = "UP"
} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $evidence "$($Action.ToLower())-$release.json")
Write-Host "$Action passed for release $release."
