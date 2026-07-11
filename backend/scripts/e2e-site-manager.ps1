$ErrorActionPreference = 'Continue'
$Base = 'http://localhost:8080'
$Pass = 'SecurePass123!'
$Suffix = Get-Random -Maximum 99999
$Results = [System.Collections.Generic.List[string]]::new()

function Assert-Case([string]$Name, [bool]$Cond, [string]$Detail = '') {
  if ($Cond) {
    $Results.Add("PASS  $Name")
    Write-Host "PASS  $Name"
  } else {
    $Results.Add("FAIL  $Name :: $Detail")
    Write-Host "FAIL  $Name :: $Detail"
  }
}

function Invoke-Login([string]$Username, [string]$Password) {
  return Invoke-RestMethod -Uri "$Base/api/auth/login" -Method POST -ContentType 'application/json' -Body (@{
      username = $Username
      password = $Password
    } | ConvertTo-Json)
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Token,
    $Body = $null
  )
  $headers = @{
    Authorization = "Bearer $Token"
    'Content-Type' = 'application/json'
  }
  $params = @{
    Uri = "$Base$Path"
    Method = $Method
    Headers = $headers
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8)
  }
  return Invoke-WebRequest @params
}

function Get-Status {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Token,
    $Body = $null
  )
  try {
    $r = Invoke-Api -Method $Method -Path $Path -Token $Token -Body $Body
    return [int]$r.StatusCode
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode.value__
    }
    return -1
  }
}

function Decode-JwtPayload([string]$Jwt) {
  $part = $Jwt.Split('.')[1].Replace('-', '+').Replace('_', '/')
  while ($part.Length % 4) { $part += '=' }
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($part))
  return $json | ConvertFrom-Json
}

# --- fresh tenant via public register ---
$taUser = "e2esm_ta_$Suffix"
$regBody = @{
  organizationName = "E2E SM Org $Suffix"
  managementModel  = 'school'
  areaCount        = 2
  username         = $taUser
  email            = "$taUser@example.com"
  password         = $Pass
}
try {
  $reg = Invoke-RestMethod -Uri "$Base/api/auth/register" -Method POST -ContentType 'application/json' -Body ($regBody | ConvertTo-Json)
  Assert-Case 'Register tenant' ($true) "$taUser"
} catch {
  Assert-Case 'Register tenant' $false $_.ErrorDetails.Message
  Write-Host ($Results -join "`n")
  exit 1
}

$ta = Invoke-Login $taUser $Pass
$taTok = $ta.token
Assert-Case 'TA login' ($ta.user.role -eq 'TENANT_ADMIN') "$($ta.user.role)"

# --- sites ---
$sitesResp = Invoke-Api -Method GET -Path '/api/sites' -Token $taTok
$sites = $sitesResp.Content | ConvertFrom-Json
if ($sites -isnot [System.Array]) { $sites = @($sites) }
Assert-Case 'TA list sites' ($sites.Count -ge 1) "count=$($sites.Count)"
$site1 = $sites[0].id
Write-Host "site1=$site1 totalSites=$($sites.Count)"

$site2 = $null
try {
  $cr = Invoke-Api -Method POST -Path '/api/sites' -Token $taTok -Body @{
    name = "E2E Campus B $Suffix"
    location = 'Branch B'
  }
  $site2Obj = $cr.Content | ConvertFrom-Json
  $site2 = $site2Obj.id
  Assert-Case 'TA create second site' ($null -ne $site2) "$site2"
} catch {
  $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { 'n/a' }
  Assert-Case 'TA second site blocked (free plan)' ($code -in @(400, 403, 409)) "status=$code"
  Write-Host "second site result status=$code"
}

$sites = ((Invoke-Api -Method GET -Path '/api/sites' -Token $taTok).Content | ConvertFrom-Json)
if ($sites -isnot [System.Array]) { $sites = @($sites) }
if (-not $site2 -and $sites.Count -ge 2) { $site2 = $sites[1].id }

# --- create SITE_MANAGER ---
$smUser = "e2esm_sm_$Suffix"
$smBody = @{
  username  = $smUser
  email     = "$smUser@example.com"
  password  = $Pass
  firstName = 'Site'
  lastName  = 'Manager'
  role      = 'SITE_MANAGER'
  status    = 'ACTIVE'
  siteIds   = @($site1)
}
try {
  $smCreate = Invoke-Api -Method POST -Path '/api/admin/users' -Token $taTok -Body $smBody
  $smObj = $smCreate.Content | ConvertFrom-Json
  Assert-Case 'TA create SITE_MANAGER' ($smObj.role -eq 'SITE_MANAGER') ($smObj | ConvertTo-Json -Compress)
  $hasSite = @($smObj.siteIds) -contains $site1
  Assert-Case 'SM DTO has siteIds' $hasSite (($smObj.siteIds | ConvertTo-Json -Compress))
} catch {
  Assert-Case 'TA create SITE_MANAGER' $false $_.ErrorDetails.Message
  Write-Host $_.Exception.Message
  Write-Host ($Results -join "`n")
  exit 1
}

# Reject SITE_MANAGER without sites via update
$memberUser = "e2esm_mem_$Suffix"
try {
  $memCreate = Invoke-Api -Method POST -Path '/api/admin/users' -Token $taTok -Body @{
    username  = $memberUser
    email     = "$memberUser@example.com"
    password  = $Pass
    firstName = 'Mem'
    lastName  = 'Ber'
    role      = 'MEMBER'
    status    = 'ACTIVE'
  }
  $memObj = $memCreate.Content | ConvertFrom-Json
  $badStatus = Get-Status -Method PUT -Path "/api/admin/users/$($memObj.id)" -Token $taTok -Body @{
    role    = 'SITE_MANAGER'
    siteIds = @()
  }
  Assert-Case 'Reject SM without sites' ($badStatus -eq 400) "status=$badStatus"
} catch {
  $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { -1 }
  Assert-Case 'Reject SM without sites (setup)' $false "status=$code"
}

# --- SM login ---
$sm = Invoke-Login $smUser $Pass
$smTok = $sm.token
Assert-Case 'SM login role' ($sm.user.role -eq 'SITE_MANAGER') "$($sm.user.role)"
$payload = Decode-JwtPayload $smTok
Write-Host ("JWT role=$($payload.role) site_ids=" + ($payload.site_ids | ConvertTo-Json -Compress))
Assert-Case 'JWT site_ids contains site1' (@($payload.site_ids) -contains $site1) (($payload.site_ids | ConvertTo-Json -Compress))

# --- SM allowed ---
Assert-Case 'SM GET /api/sites' ((Get-Status -Method GET -Path '/api/sites' -Token $smTok) -eq 200)
$smSites = ((Invoke-Api -Method GET -Path '/api/sites' -Token $smTok).Content | ConvertFrom-Json)
if ($smSites -isnot [System.Array]) { $smSites = @($smSites) }
Assert-Case 'SM sites only assigned' ($smSites.Count -eq 1 -and $smSites[0].id -eq $site1) "count=$($smSites.Count)"
Assert-Case 'SM GET /api/gates' ((Get-Status -Method GET -Path '/api/gates' -Token $smTok) -eq 200)
Assert-Case 'SM GET /api/vehicles' ((Get-Status -Method GET -Path '/api/vehicles' -Token $smTok) -eq 200)
Assert-Case 'SM GET /api/vehicle-logs' ((Get-Status -Method GET -Path '/api/vehicle-logs' -Token $smTok) -eq 200)

# --- Phase 2: vehicle currentSiteId scoping ---
$ownerId = $memObj.id
$plateIn = "E2E$Suffix"
$plateNull = "NUL$Suffix"
try {
  $vIn = Invoke-Api -Method POST -Path '/api/vehicles' -Token $taTok -Body @{
    ownerId = $ownerId
    licensePlate = $plateIn
    vehicleType = 'car'
    registrationDate = (Get-Date -Format 'yyyy-MM-dd')
    status = 'approved'
    currentSiteId = $site1
  }
  $vehIn = ($vIn.Content | ConvertFrom-Json).vehicle
  if (-not $vehIn) { $vehIn = $vIn.Content | ConvertFrom-Json }
  Assert-Case 'TA create vehicle with site' ($vehIn.currentSiteId -eq $site1 -or $vehIn.id) "id=$($vehIn.id)"
} catch {
  Assert-Case 'TA create vehicle with site' $false $_.ErrorDetails.Message
}

try {
  $vNull = Invoke-Api -Method POST -Path '/api/vehicles' -Token $taTok -Body @{
    ownerId = $ownerId
    licensePlate = $plateNull
    vehicleType = 'car'
    registrationDate = (Get-Date -Format 'yyyy-MM-dd')
    status = 'approved'
  }
  $vehNull = ($vNull.Content | ConvertFrom-Json).vehicle
  if (-not $vehNull) { $vehNull = $vNull.Content | ConvertFrom-Json }
  Assert-Case 'TA create vehicle without site' ($null -eq $vehNull.currentSiteId -or $vehNull.currentSiteId -eq '') "site=$($vehNull.currentSiteId)"
} catch {
  Assert-Case 'TA create vehicle without site' $false $_.ErrorDetails.Message
}

$smVehList = ((Invoke-Api -Method GET -Path '/api/vehicles/list' -Token $smTok).Content | ConvertFrom-Json)
if ($smVehList -isnot [System.Array]) { $smVehList = @($smVehList) }
$smPlates = @($smVehList | ForEach-Object { $_.licensePlate })
Assert-Case 'SM sees site-assigned vehicle' ($smPlates -contains $plateIn) (($smPlates | ConvertTo-Json -Compress))
Assert-Case 'SM hides null-site vehicle' (-not ($smPlates -contains $plateNull)) (($smPlates | ConvertTo-Json -Compress))

$smCreateNoSite = Get-Status -Method POST -Path '/api/vehicles' -Token $smTok -Body @{
  ownerId = $ownerId
  licensePlate = "SMX$Suffix"
  vehicleType = 'car'
  registrationDate = (Get-Date -Format 'yyyy-MM-dd')
  status = 'approved'
}
Assert-Case 'SM create vehicle requires site' ($smCreateNoSite -in @(400, 403)) "status=$smCreateNoSite"

# --- SM denied ---
Assert-Case 'SM denied GET /api/admin/users' ((Get-Status -Method GET -Path '/api/admin/users' -Token $smTok) -eq 403)
Assert-Case 'SM denied GET /api/v1/tenant/me' ((Get-Status -Method GET -Path '/api/v1/tenant/me' -Token $smTok) -eq 403)
Assert-Case 'SM denied POST /api/sites' ((Get-Status -Method POST -Path '/api/sites' -Token $smTok -Body @{
      name = "Nope $Suffix"
      location = 'x'
    }) -eq 403)
Assert-Case 'SM denied billing' ((Get-Status -Method GET -Path '/api/v1/billing/status' -Token $smTok) -eq 403)

# --- TA still ok ---
Assert-Case 'TA GET users' ((Get-Status -Method GET -Path '/api/admin/users' -Token $taTok) -eq 200)
Assert-Case 'TA GET tenant/me' ((Get-Status -Method GET -Path '/api/v1/tenant/me' -Token $taTok) -eq 200)

# --- Frontend ---
try {
  $fe = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 5
  Assert-Case 'Frontend :3000' ($fe.StatusCode -eq 200) "$($fe.StatusCode)"
} catch {
  Assert-Case 'Frontend :3000' $false $_.Exception.Message
}

Write-Host ''
Write-Host '==== SUMMARY ===='
$passN = @($Results | Where-Object { $_ -like 'PASS*' }).Count
$failN = @($Results | Where-Object { $_ -like 'FAIL*' }).Count
Write-Host "passed=$passN failed=$failN"
Write-Host "TA=$taUser SM=$smUser"
$Results | Where-Object { $_ -like 'FAIL*' } | ForEach-Object { Write-Host $_ }
if ($failN -gt 0) { exit 1 } else { exit 0 }
