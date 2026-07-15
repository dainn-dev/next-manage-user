[CmdletBinding()]
param(
    [ValidateSet("BackendUnavailable", "DatabaseUnavailable")][string]$Scenario,
    [string]$EnvironmentFile = "deploy/staging/.env",
    [string]$EvidenceDirectory = "deploy/staging/evidence"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $root "deploy/staging/docker-compose.yml"
$envFile = Join-Path $root $EnvironmentFile
$service = if ($Scenario -eq "BackendUnavailable") { "backend" } else { "postgres" }
$started = Get-Date
$observed = $false
docker compose --env-file $envFile -f $compose stop $service
try {
    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 10
        try {
            $alerts = Invoke-RestMethod -Uri "http://localhost:9093/api/v2/alerts" -TimeoutSec 5
            $observed = $null -ne ($alerts | Where-Object { $_.labels.alertname -eq $Scenario })
        } catch { $observed = $false }
    } while (-not $observed -and (Get-Date) -lt $deadline)
    if (-not $observed) { throw "$Scenario did not reach Alertmanager." }
    $receiverLogs = docker compose --env-file $envFile -f $compose logs --since $started.ToUniversalTime().ToString("o") alert-receiver
    if (($receiverLogs -join "`n") -notmatch $Scenario) { throw "$Scenario was not delivered to the staging incident receiver." }
} finally {
    docker compose --env-file $envFile -f $compose up -d $service
}
New-Item -ItemType Directory -Force (Join-Path $root $EvidenceDirectory) | Out-Null
[ordered]@{ issue="DAI-315"; scenario=$Scenario; alertmanagerObserved=$observed; receiverObserved=$true;
    injectedAt=$started.ToUniversalTime().ToString("o"); recoveredAt=(Get-Date).ToUniversalTime().ToString("o") } |
    ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $root "$EvidenceDirectory/drill-$($Scenario.ToLower()).json")
Write-Host "$Scenario alert and routing drill passed."
