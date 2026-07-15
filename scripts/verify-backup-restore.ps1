[CmdletBinding()]
param([string]$EvidenceDirectory = "artifacts/security-reliability", [string]$RestoreDatabase = "vehicle_management_restore_verify")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$evidence = Join-Path $root $EvidenceDirectory
New-Item -ItemType Directory -Force $evidence | Out-Null
$started = Get-Date
$container = "vehicle-management-db"
$dumpInContainer = "/tmp/dai-313-backup.dump"
$dump = Join-Path $evidence "postgres-backup.dump"

docker compose -f (Join-Path $root "docker-compose.yml") exec -T postgres pg_dump -U postgres -d vehicle_management -Fc -f $dumpInContainer
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
docker cp "${container}:${dumpInContainer}" $dump
docker compose -f (Join-Path $root "docker-compose.yml") exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $RestoreDatabase WITH (FORCE)"
docker compose -f (Join-Path $root "docker-compose.yml") exec -T postgres createdb -U postgres $RestoreDatabase
docker compose -f (Join-Path $root "docker-compose.yml") exec -T postgres pg_restore -U postgres -d $RestoreDatabase --clean --if-exists $dumpInContainer
$counts = docker compose -f (Join-Path $root "docker-compose.yml") exec -T postgres psql -U postgres -d $RestoreDatabase -At -c "SELECT json_build_object('tenants',(SELECT count(*) FROM tenant),'sites',(SELECT count(*) FROM site),'cameras',(SELECT count(*) FROM camera));"
if ($LASTEXITCODE -ne 0) { throw "restore verification query failed" }
[ordered]@{ issue="DAI-313"; backupSha256=(Get-FileHash $dump -Algorithm SHA256).Hash; restoreDatabase=$RestoreDatabase; measuredRtoSeconds=[math]::Round(((Get-Date)-$started).TotalSeconds,2); measuredData=$counts.Trim(); verifiedAt=(Get-Date).ToUniversalTime().ToString("o") } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $evidence "backup-restore-report.json")

