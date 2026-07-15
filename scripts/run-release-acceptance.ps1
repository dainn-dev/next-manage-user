[CmdletBinding()]
param(
    [ValidateSet("smoke", "full")]
    [string]$Mode = "smoke",
    [string]$EvidenceDirectory = "artifacts/acceptance",
    [switch]$ContinueOnFailure
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$evidenceRoot = Join-Path $repoRoot $EvidenceDirectory
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null

$runId = "dai-317-{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss")
$startedAt = (Get-Date).ToUniversalTime()
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-AcceptanceSuite {
    param(
        [string]$Id,
        [string]$Capability,
        [string]$WorkingDirectory,
        [string]$Executable,
        [string[]]$Arguments,
        [bool]$Required = $true
    )

    $logPath = Join-Path $evidenceRoot "$Id.log"
    $suiteStartedAt = Get-Date
    Push-Location (Join-Path $repoRoot $WorkingDirectory)
    try {
        & $Executable @Arguments *>&1 | Tee-Object -FilePath $logPath
        $exitCode = $LASTEXITCODE
    }
    catch {
        $_ | Out-String | Set-Content -Encoding utf8 $logPath
        $exitCode = 1
    }
    finally {
        Pop-Location
    }

    $status = if ($exitCode -eq 0) { "passed" } else { "failed" }
    $results.Add([ordered]@{
        id = $Id
        capability = $Capability
        required = $Required
        status = $status
        exitCode = $exitCode
        durationSeconds = [math]::Round(((Get-Date) - $suiteStartedAt).TotalSeconds, 2)
        evidence = (Resolve-Path -Relative $logPath).Replace("\\", "/")
    })

    if ($exitCode -ne 0 -and $Required -and -not $ContinueOnFailure) {
        Write-Warning "Required acceptance suite $Id failed; remaining suites will run so the report is complete."
    }
}

# The smoke gate is deterministic and does not require external credentials or production models.
Invoke-AcceptanceSuite "TEN-01" "Tenant isolation, authentication, and RBAC" "backend" "mvn" @(
    "-q", "-Dtest=TenantIsolationIntegrationTest,RlsFailClosedIntegrationTest,RlsNonSuperuserLoginIntegrationTest,SiteAccessTest", "test"
)
Invoke-AcceptanceSuite "BILL-01" "Billing lifecycle and entitlement enforcement" "backend" "mvn" @(
    "-q", "-Dtest=BillingLifecycleIntegrationTest,EntitlementGuardIntegrationTest", "test"
)
Invoke-AcceptanceSuite "CAM-01" "Camera enrollment, key auth, heartbeat, and idempotent ingest" "backend" "mvn" @(
    "-q", "-Dtest=CameraManagementIntegrationTest,CameraKeyAuthIntegrationTest,CameraHeartbeatIntegrationTest,CameraIngestIntegrationTest", "test"
)
Invoke-AcceptanceSuite "SLOT-01" "Parking slot mapping, occupancy, and relocation" "backend" "mvn" @(
    "-q", "-Dtest=ParkingSlotMappingIntegrationTest,ParkingSlotMappingServiceTest", "test"
)
Invoke-AcceptanceSuite "UI-01" "Dashboard scope, metrics, search, and realtime behavior" "frontend" "node" @(
    "--test", "tests/dashboard-foundation.test.mjs"
)
Invoke-AcceptanceSuite "LPR-01" "Deterministic day/night LPR pipeline contract" "." "python" @(
    "edge/tools/pipeline_eval/evaluate_pipeline.py", "--manifest", "edge/tools/pipeline_eval/sample-evaluation.json",
    "--output-json", (Join-Path $evidenceRoot "LPR-01.json")
)
Invoke-AcceptanceSuite "EDGE-01" "Edge tracking, resilience, and ingest serialization" "." "python" @(
    "-m", "pytest", "-q", "edge/edge"
)

if ($Mode -eq "full") {
    Invoke-AcceptanceSuite "API-01" "Complete backend regression suite" "backend" "mvn" @("-q", "test")
    Invoke-AcceptanceSuite "WEB-01" "Production frontend build" "frontend" "pnpm" @("build")
}

$finishedAt = (Get-Date).ToUniversalTime()
$failedRequired = @($results | Where-Object { $_.required -and $_.status -ne "passed" })
$report = [ordered]@{
    schemaVersion = 1
    issue = "DAI-317"
    runId = $runId
    mode = $Mode
    revision = (git -C $repoRoot rev-parse HEAD).Trim()
    startedAt = $startedAt.ToString("o")
    finishedAt = $finishedAt.ToString("o")
    status = if ($failedRequired.Count -eq 0) { "passed" } else { "failed" }
    suites = $results
}

$jsonPath = Join-Path $evidenceRoot "acceptance-report.json"
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $jsonPath

$rows = $results | ForEach-Object {
    "| $($_.id) | $($_.capability) | $($_.status) | $($_.durationSeconds) | [$($_.evidence)]($($_.evidence)) |"
}
$markdown = @"
# DAI-317 acceptance report

- Run: ``$runId``
- Revision: ``$($report.revision)``
- Mode: ``$Mode``
- Result: **$($report.status)**
- Started (UTC): ``$($report.startedAt)``
- Finished (UTC): ``$($report.finishedAt)``

| Test ID | Capability | Result | Seconds | Evidence |
|---|---|---:|---:|---|
$($rows -join "`n")
"@
$markdown | Set-Content -Encoding utf8 (Join-Path $evidenceRoot "acceptance-report.md")

Write-Host "Acceptance result: $($report.status)"
Write-Host "Evidence: $evidenceRoot"
if ($failedRequired.Count -gt 0) { exit 1 }
