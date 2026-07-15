param(
    [Parameter(Mandatory=$true)][string]$WorkloadManifest,
    [Parameter(Mandatory=$true)][string]$AiManifest,
    [string]$EvidenceDirectory = "reports/dai-314"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null

python tools/performance/parking_load_test.py --manifest $WorkloadManifest `
    --output-json "$EvidenceDirectory/load.json" --enforce-slos
if ($LASTEXITCODE -ne 0) { throw "Performance SLO gate failed (exit $LASTEXITCODE)." }

python edge/tools/pipeline_eval/evaluate_pipeline.py --manifest $AiManifest `
    --output-json "$EvidenceDirectory/ai-evaluation.json" --enforce-targets
if ($LASTEXITCODE -ne 0) { throw "AI cohort gate failed (exit $LASTEXITCODE)." }

Write-Host "DAI-314 release evidence passed: $EvidenceDirectory"
