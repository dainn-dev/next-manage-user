[CmdletBinding()]
param([string]$EvidenceDirectory = "artifacts/security-reliability", [switch]$SkipScans)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$evidence = Join-Path $root $EvidenceDirectory
New-Item -ItemType Directory -Force $evidence | Out-Null
$results = [System.Collections.Generic.List[object]]::new()
$runStarted = (Get-Date).ToUniversalTime()

# Compose validates required-secret wiring without using real credentials.
if (-not $env:JWT_SECRET) { $env:JWT_SECRET = "dai-313-config-validation-secret-32-chars" }
if (-not $env:PASSWORD_RESET_FINGERPRINT_SECRET) { $env:PASSWORD_RESET_FINGERPRINT_SECRET = "dai-313-password-reset-validation-secret" }

function Invoke-Gate([string]$id, [string]$description, [string]$cwd, [string]$command, [string[]]$arguments) {
    $started = Get-Date
    $log = Join-Path $evidence "$id.log"
    Push-Location (Join-Path $root $cwd)
    try { & $command @arguments *>&1 | Tee-Object -FilePath $log; $code = $LASTEXITCODE }
    catch { $_ | Out-String | Set-Content -Encoding utf8 $log; $code = 1 }
    finally { Pop-Location }
    $results.Add([ordered]@{ id=$id; description=$description; status=$(if ($code -eq 0) {"passed"} else {"failed"}); exitCode=$code; durationSeconds=[math]::Round(((Get-Date)-$started).TotalSeconds,2); evidence=(Resolve-Path -Relative $log).Replace("\","/") })
}

Invoke-Gate "SEC-DB-01" "RLS, raw SQL, pooled connection, and API isolation" "backend" "mvn" @("-q", "-Dtest=TenantIsolationIntegrationTest,RlsFailClosedIntegrationTest,RlsNonSuperuserLoginIntegrationTest,N2RawSqlDbLayerIsolationIntegrationTest,N6PooledConnectionConcurrencyIntegrationTest", "test")
Invoke-Gate "SEC-AUTH-01" "Gate/camera credentials, JWT/RBAC, and snapshot scoping" "backend" "mvn" @("-q", "-Dtest=GateApiKeyAuthFilterTest,CameraKeyAuthIntegrationTest,CameraDtoSecurityTest,ObjectStorageServiceTest,VehicleRbacTest", "test")
Invoke-Gate "SEC-REPLAY-01" "Billing, camera ingest, and occupancy replay convergence" "backend" "mvn" @("-q", "-Dtest=BillingLifecycleIntegrationTest,CameraIngestIntegrationTest,ParkingSlotMappingIntegrationTest,GateEventDeduplicatorTest", "test")
Invoke-Gate "REL-EDGE-01" "Offline queue, reconnect, restart, and retry behavior" "." "python" @("-m", "pytest", "-q", "edge/edge/test_edge_resilience.py", "edge/edge/test_camera_ingest_client.py", "edge/edge/test_tracker_state_store.py")
Invoke-Gate "SEC-CONFIG-01" "Production compose configuration resolves" "." "docker" @("compose", "config", "--quiet")
if (-not $SkipScans) {
    Invoke-Gate "SEC-SCAN-BACKEND" "Backend dependency vulnerability scan" "backend" "mvn" @("-q", "org.owasp:dependency-check-maven:check", "-DfailBuildOnCVSS=7")
    Invoke-Gate "SEC-SCAN-FRONTEND" "Frontend production dependency audit" "frontend" "pnpm" @("audit", "--prod", "--audit-level", "high")
}

$failed = @($results | Where-Object status -ne "passed")
$report = [ordered]@{ schemaVersion=1; issue="DAI-313"; revision=(git -C $root rev-parse HEAD).Trim(); scansSkipped=[bool]$SkipScans; startedAt=$runStarted.ToString("o"); finishedAt=(Get-Date).ToUniversalTime().ToString("o"); status=$(if ($failed.Count -eq 0 -and -not $SkipScans) {"passed"} elseif ($failed.Count -eq 0) {"incomplete"} else {"failed"}); suites=$results }
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $evidence "security-reliability-report.json")
exit $(if ($failed.Count -eq 0 -and -not $SkipScans) { 0 } else { 1 })
