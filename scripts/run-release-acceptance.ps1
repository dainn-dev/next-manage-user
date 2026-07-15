[CmdletBinding()]
param(
    [ValidateSet("smoke", "full")]
    [string]$Mode = "smoke",
    [string]$EvidenceDirectory = "artifacts/acceptance",
    [string]$WorkloadManifest,
    [string]$AiManifest,
    [switch]$AllowDirtyWorktree,
    [switch]$ContinueOnFailure
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$dirty = @(git -C $repoRoot status --porcelain --untracked-files=all)
if (-not $AllowDirtyWorktree -and $dirty.Count -gt 0) {
    throw "Release evidence requires a clean worktree; commit or intentionally stash all $($dirty.Count) changes first."
}
$revision = (git -C $repoRoot rev-parse HEAD).Trim()
$powerShellHost = (Get-Process -Id $PID).Path
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

function Add-BlockedSuite([string]$Id, [string]$Capability, [string]$Reason) {
    $logPath = Join-Path $evidenceRoot "$Id.log"
    $Reason | Set-Content -Encoding utf8 $logPath
    $results.Add([ordered]@{ id=$Id; capability=$Capability; required=$true; status="failed";
        exitCode=2; durationSeconds=0; evidence=(Resolve-Path -Relative $logPath).Replace("\", "/") })
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
    Invoke-AcceptanceSuite "SEC-01" "Security, replay, dependency and tenant-isolation gate" "." $powerShellHost @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/run-security-reliability.ps1"
    )
    Invoke-AcceptanceSuite "RECOVERY-01" "PostgreSQL backup and isolated restore exercise" "." $powerShellHost @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/verify-backup-restore.ps1"
    )
    if ([string]::IsNullOrWhiteSpace($WorkloadManifest) -or [string]::IsNullOrWhiteSpace($AiManifest)) {
        Add-BlockedSuite "PERF-AI-01" "Pilot capacity and real-model AI calibration" `
            "Full mode requires -WorkloadManifest and -AiManifest; fixture evidence is never promotable."
    } else {
        Invoke-AcceptanceSuite "PERF-AI-01" "Pilot capacity and real-model AI calibration" "." $powerShellHost @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/run-performance-ai.ps1",
            "-WorkloadManifest", $WorkloadManifest, "-AiManifest", $AiManifest,
            "-EvidenceDirectory", "artifacts/performance-ai"
        )
    }
    Invoke-AcceptanceSuite "EVIDENCE-01" "Staging rehearsal, recovery, calibration and pilot decision evidence" "." "python" @(
        "tools/release/verify_release_evidence.py", "--root", $repoRoot
    )
}

$finishedAt = (Get-Date).ToUniversalTime()
$failedRequired = @($results | Where-Object { $_.required -and $_.status -ne "passed" })
$report = [ordered]@{
    schemaVersion = 1
    issue = "DAI-317"
    runId = $runId
    mode = $Mode
    revision = $revision
    worktreeClean = ($dirty.Count -eq 0)
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
