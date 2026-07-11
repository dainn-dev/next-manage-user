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
  param([string]$Method, [string]$Path, [string]$Token, $Body = $null)
  $headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
  $params = @{ Uri = "$Base$Path"; Method = $Method; Headers = $headers; UseBasicParsing = $true }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 8) }
  return Invoke-WebRequest @params
}

function Get-Status {
  param([string]$Method, [string]$Path, [string]$Token, $Body = $null)
  try {
    return [int](Invoke-Api -Method $Method -Path $Path -Token $Token -Body $Body).StatusCode
  } catch {
    if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode.value__ }
    return -1
  }
}

function Decode-JwtPayload([string]$Jwt) {
  $part = $Jwt.Split('.')[1].Replace('-', '+').Replace('_', '/')
  while ($part.Length % 4) { $part += '=' }
  return ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($part)) | ConvertFrom-Json)
}

# --- Tenant A ---
$taA = "e2emb_ta_a_$Suffix"
Invoke-RestMethod -Uri "$Base/api/auth/register" -Method POST -ContentType 'application/json' -Body (@{
    organizationName = "E2E Mem Org A $Suffix"
    managementModel  = 'school'
    areaCount        = 1
    username         = $taA
    email            = "$taA@example.com"
    password         = $Pass
  } | ConvertTo-Json) | Out-Null
Assert-Case 'Register tenant A' $true

$loginA = Invoke-Login $taA $Pass
$tokA = $loginA.token
$sitesA = ((Invoke-Api -Method GET -Path '/api/sites' -Token $tokA).Content | ConvertFrom-Json)
if ($sitesA -isnot [System.Array]) { $sitesA = @($sitesA) }
$siteA = $sitesA[0].id
Assert-Case 'Tenant A has site' ($null -ne $siteA) "$siteA"

# Invite new MEMBER
$memUser = "e2emb_mem_$Suffix"
$invite = Invoke-Api -Method POST -Path '/api/member-affiliations/invite' -Token $tokA -Body @{
  email     = "$memUser@example.com"
  username  = $memUser
  password  = $Pass
  firstName = 'Platform'
  lastName  = 'Member'
}
$aff = $invite.Content | ConvertFrom-Json
Assert-Case 'Invite new MEMBER' ($aff.status -eq 'ACTIVE' -and $aff.userId) "status=$($aff.status)"

$memLogin = Invoke-Login $memUser $Pass
$memTok = $memLogin.token
$memJwt = Decode-JwtPayload $memTok
Assert-Case 'MEMBER login role' ($memLogin.user.role -eq 'MEMBER') "$($memLogin.user.role)"
Assert-Case 'MEMBER JWT omits tenant_id' ($null -eq $memJwt.tenant_id -or $memJwt.tenant_id -eq '') "tenant_id=$($memJwt.tenant_id)"
$affIds = @($memJwt.affiliation_tenant_ids)
Assert-Case 'MEMBER JWT has affiliation' ($affIds.Count -ge 1) (($affIds | ConvertTo-Json -Compress))
Assert-Case 'MEMBER DTO affiliations' (@($memLogin.user.affiliationTenantIds).Count -ge 1) 'dto'

# List affiliations as TA
$list = ((Invoke-Api -Method GET -Path '/api/member-affiliations' -Token $tokA).Content | ConvertFrom-Json)
if ($list -isnot [System.Array]) { $list = @($list) }
Assert-Case 'TA list affiliations' (($list | Where-Object { $_.userId -eq $aff.userId }).Count -eq 1)

# --- Tenant B: link same MEMBER ---
$taB = "e2emb_ta_b_$Suffix"
Invoke-RestMethod -Uri "$Base/api/auth/register" -Method POST -ContentType 'application/json' -Body (@{
    organizationName = "E2E Mem Org B $Suffix"
    managementModel  = 'boarding-house'
    areaCount        = 1
    username         = $taB
    email            = "$taB@example.com"
    password         = $Pass
  } | ConvertTo-Json) | Out-Null
$tokB = (Invoke-Login $taB $Pass).token

$link = Invoke-Api -Method POST -Path '/api/member-affiliations/invite' -Token $tokB -Body @{
  email = "$memUser@example.com"
}
$linkAff = $link.Content | ConvertFrom-Json
Assert-Case 'Link MEMBER to tenant B' ($linkAff.status -eq 'ACTIVE' -and $linkAff.userId -eq $aff.userId) "uid=$($linkAff.userId)"

$memLogin2 = Invoke-Login $memUser $Pass
$memJwt2 = Decode-JwtPayload $memLogin2.token
$affIds2 = @($memJwt2.affiliation_tenant_ids)
Assert-Case 'MEMBER has 2 affiliations after link' ($affIds2.Count -ge 2) "count=$($affIds2.Count)"

# Revoke on B
$rev = ((Invoke-Api -Method DELETE -Path "/api/member-affiliations/$($aff.userId)" -Token $tokB).Content | ConvertFrom-Json)
Assert-Case 'Revoke affiliation on B' ($rev.status -eq 'REVOKED') "$($rev.status)"

# --- Parking bank transfer ---
$bank = Invoke-Api -Method POST -Path '/api/v1/parking/bank-accounts' -Token $tokA -Body @{
  siteId        = $siteA
  bankCode      = 'VCB'
  accountNumber = '0123456789'
  accountName   = 'PARKVISION E2E'
}
Assert-Case 'Upsert site bank account' (([int]$bank.StatusCode) -in @(200, 201))

$sessionResp = Invoke-Api -Method POST -Path '/api/v1/parking/sessions' -Token $tokA -Body @{
  siteId        = $siteA
  licensePlate  = "PK$Suffix"
}
$session = $sessionResp.Content | ConvertFrom-Json
Assert-Case 'Open parking session' ($session.status -eq 'OPEN' -and $session.id) "id=$($session.id)"

$claimStatus = Get-Status -Method POST -Path "/api/v1/parking/sessions/$($session.id)/claim" -Token $memTok
Assert-Case 'MEMBER claim session' ($claimStatus -eq 200) "status=$claimStatus"

$xfer = ((Invoke-Api -Method POST -Path "/api/v1/parking/sessions/$($session.id)/bank-transfer" -Token $memTok).Content | ConvertFrom-Json)
Assert-Case 'Bank transfer instructions' ($xfer.transferContent -like 'PV*' -and $xfer.amountVnd -gt 0) "$($xfer.transferContent) amount=$($xfer.amountVnd)"

$hook = Invoke-RestMethod -Uri "$Base/api/v1/parking/webhooks/sepay" -Method POST -ContentType 'application/json' -Body (@{
    content         = "Thanh toan bai xe $($xfer.transferContent) OK"
    transferAmount  = "$($xfer.amountVnd)"
    referenceCode   = "E2E-$Suffix"
  } | ConvertTo-Json)
Assert-Case 'SePay webhook marks paid' ($hook.status -eq 'ok') (($hook | ConvertTo-Json -Compress))

# Frontend
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
Write-Host "TA_A=$taA TA_B=$taB MEMBER=$memUser"
$Results | Where-Object { $_ -like 'FAIL*' } | ForEach-Object { Write-Host $_ }
if ($failN -gt 0) { exit 1 } else { exit 0 }
