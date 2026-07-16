[CmdletBinding()]
param(
    [string]$EvidenceDirectory = "artifacts/commissioning",
    [switch]$ContinueOnFailure
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$evidenceRoot = Join-Path $repoRoot $EvidenceDirectory
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
$runId = "dai-329-{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss")
$revision = (git -C $repoRoot rev-parse HEAD).Trim()
$startedAt = (Get-Date).ToUniversalTime()
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-CommissioningSuite {
    param(
        [string]$Id,
        [string]$Capability,
        [string]$WorkingDirectory,
        [string]$Executable,
        [string[]]$Arguments
    )
    $logPath = Join-Path $evidenceRoot "$Id.log"
    $stdoutPath = Join-Path $evidenceRoot "$Id.stdout.log"
    $stderrPath = Join-Path $evidenceRoot "$Id.stderr.log"
    $suiteStartedAt = Get-Date
    Push-Location (Join-Path $repoRoot $WorkingDirectory)
    try {
        $process = Start-Process -FilePath $Executable -ArgumentList $Arguments `
            -NoNewWindow -Wait -PassThru `
            -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        $exitCode = $process.ExitCode
        @(
            Get-Content -Raw -ErrorAction SilentlyContinue $stdoutPath
            Get-Content -Raw -ErrorAction SilentlyContinue $stderrPath
        ) | Set-Content -Encoding utf8 $logPath
    } catch {
        $_ | Out-String | Set-Content -Encoding utf8 $logPath
        $exitCode = 1
    } finally {
        Pop-Location
        Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    }
    $results.Add([ordered]@{
        id = $Id
        capability = $Capability
        status = if ($exitCode -eq 0) { "passed" } else { "failed" }
        exitCode = $exitCode
        durationSeconds = [math]::Round(((Get-Date) - $suiteStartedAt).TotalSeconds, 2)
        evidence = (Resolve-Path -Relative $logPath).Replace("\", "/")
    })
    if ($exitCode -ne 0 -and -not $ContinueOnFailure) {
        Write-Warning "$Id failed; remaining suites still run to produce a complete evidence report."
    }
}

Invoke-CommissioningSuite "COMM-E2E" "Commissioning happy path, HTTP contract, geometry/calibration, multi-camera, RLS, republish, and rollback" `
    "backend" "mvn" @("-q", "-Dtest=CommissioningE2EIntegrationTest,ParkingMapContractControllerTest,ParkingMapContractAuthorizationTest,ParkingMapContractServiceTest,ParkingMapCommissioningServiceTest,HomographyCalibrationServiceTest", "test")
Invoke-CommissioningSuite "CAM-EDGE" "Camera CRUD, credential, heartbeat, and idempotent/replayed ingest" `
    "backend" "mvn" @("-q", "-Dtest=CameraManagementIntegrationTest,CameraKeyAuthIntegrationTest,CameraHeartbeatIntegrationTest,CameraIngestIntegrationTest", "test")
Invoke-CommissioningSuite "PARKING-RUNTIME" "Point mapping, occupancy, relocation, exit, and dashboard read models" `
    "backend" "mvn" @("-q", "-Dtest=ParkingSlotMappingIntegrationTest,DashboardApiIntegrationTest", "test")
Invoke-CommissioningSuite "TENANT-RLS" "Two-tenant service and database RLS isolation" `
    "backend" "mvn" @("-q", "-Dtest=TenantIsolationIntegrationTest,RlsFailClosedIntegrationTest,RlsNonSuperuserLoginIntegrationTest,N2RawSqlDbLayerIsolationIntegrationTest", "test")
Invoke-CommissioningSuite "COMMISSIONING-UI" "Wizard policy, calibration/publish gates, and dashboard regression" `
    "frontend" "pnpm" @("test:dashboard")
Invoke-CommissioningSuite "COMMISSIONING-LINT" "Changed commissioning frontend lint" `
    "frontend" "pnpm" @("exec", "eslint", "app/parking/commissioning/page.tsx", "lib/api/camera-api.ts", "lib/api/zone-api.ts", "lib/api/parking-commissioning-api.ts", "lib/parking-commissioning-policy.mjs", "tests/parking-commissioning.test.mjs")

$finishedAt = (Get-Date).ToUniversalTime()
$failed = @($results | Where-Object { $_.status -ne "passed" })
$report = [ordered]@{
    schemaVersion = 1
    issue = "DAI-329"
    runId = $runId
    revision = $revision
    startedAt = $startedAt.ToString("o")
    finishedAt = $finishedAt.ToString("o")
    status = if ($failed.Count -eq 0) { "passed" } else { "failed" }
    suites = $results
}
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $evidenceRoot "commissioning-report.json")

$rows = $results | ForEach-Object {
    $logName = Split-Path -Leaf $_.evidence
    "| $($_.id) | $($_.capability) | $($_.status) | [$logName](./$logName) | $($_.durationSeconds) |"
}
@"
# DAI-329 commissioning acceptance report

- Run: ``$runId``
- Revision: ``$revision``
- Result: **$($report.status)**
- Started (UTC): ``$($report.startedAt)``
- Finished (UTC): ``$($report.finishedAt)``

| Suite | Capability | Result | Log | Seconds |
|---|---|---:|---|---:|
$($rows -join "`n")
"@ | Set-Content -Encoding utf8 (Join-Path $evidenceRoot "commissioning-report.md")

Write-Host "Commissioning acceptance: $($report.status)"
Write-Host "Evidence: $evidenceRoot"
if ($failed.Count -gt 0) { exit 1 }
