param(
  [ValidateSet('Docker', 'Local', 'PrepareOnly')]
  [string]$Mode = 'Docker',
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$EnvPath = Join-Path $Root '.env'
$ExamplePath = Join-Path $Root '.env.example'
$ServicesPath = Join-Path $Root 'services'

function New-RandomBase64Url([int]$Bytes = 32) {
  $data = New-Object byte[] $Bytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($data) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($data).TrimEnd('=').Replace('+','-').Replace('/','_')
}

function New-RandomBase64([int]$Bytes = 32) {
  $data = New-Object byte[] $Bytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($data) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($data)
}

function New-RandomHex([int]$Bytes = 32) {
  $data = New-Object byte[] $Bytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($data) } finally { $rng.Dispose() }
  return (($data | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Read-EnvMap([string]$Path) {
  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
      $parts = $line -split '=', 2
      $value = $parts[1].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $map[$parts[0].Trim()] = $value
    }
  }
  return $map
}

function Encode-EnvValue([string]$Name, [string]$Value) {
  if ($Name.EndsWith('_PRIVATE_KEY') -or $Name.EndsWith('_PUBLIC_KEY')) {
    $normalized = $Value.Replace([string][char]13, '').Replace([string][char]10, '\n')
    return '"' + $normalized + '"'
  }
  return $Value
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = [Collections.Generic.List[string]](Get-Content $Path)
  $prefix = $Name + '='
  $encoded = Encode-EnvValue $Name $Value
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].StartsWith($prefix)) {
      $lines[$i] = $prefix + $encoded
      $found = $true
      break
    }
  }
  if (-not $found) { $lines.Add($prefix + $encoded) }
  [IO.File]::WriteAllLines($Path, $lines, (New-Object Text.UTF8Encoding($false)))
}

function Is-Placeholder([string]$Value) {
  return [string]::IsNullOrWhiteSpace($Value) -or $Value -match 'REPLACE_WITH|replace-with|<secret>|<password>'
}

function Read-Pem([string]$Path) {
  if (Test-Path $Path) { return (Get-Content $Path -Raw).Trim() }
  return $null
}

function Normalize-Pem([string]$Value) {
  if (-not $Value) { return '' }
  return $Value.Trim().Trim('"', "'").Replace('\r\n', [string][char]13 + [char]10).Replace('\n', [string][char]10)
}

function Run-Command([string]$File, [string[]]$Arguments, [string]$WorkingDirectory = $Root) {
  Push-Location $WorkingDirectory
  try {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
}

function Ensure-AuthKeys([string]$Path) {
  $values = Read-EnvMap $Path
  $privatePath = Join-Path $Root 'auth-private.pem'
  $publicPath = Join-Path $Root 'auth-public.pem'
  $private = Read-Pem $privatePath
  $public = Read-Pem $publicPath

  if (-not $private -or -not $public) {
    Run-Command 'node' @((Join-Path $Root 'generate-auth-keys.cjs'))
    $private = Read-Pem $privatePath
    $public = Read-Pem $publicPath
  }

  if (-not $private -or -not $public) { throw 'Auth RSA key pair could not be created' }
  Set-EnvValue $Path 'AUTH_JWT_PRIVATE_KEY' $private
  Set-EnvValue $Path 'AUTH_JWT_PUBLIC_KEY' $public
}

function Ensure-InternalKeys([string]$Path) {
  $privatePath = Join-Path $Root 'patient-internal-private.pem'
  $publicPath = Join-Path $Root 'patient-internal-public.pem'
  if (-not (Test-Path $privatePath) -or -not (Test-Path $publicPath)) {
    Run-Command 'node' @((Join-Path $Root 'scripts/generate-internal-keys.cjs'), $Root)
  }
  $public = Read-Pem $publicPath
  if (-not $public) { throw 'Patient internal public key could not be created' }
  Set-EnvValue $Path 'PATIENT_INTERNAL_JWT_PUBLIC_KEY' $public
}

if (-not (Test-Path $ExamplePath)) { throw "Missing environment template: $ExamplePath" }
$fresh = -not (Test-Path $EnvPath)
if ($fresh) { Copy-Item $ExamplePath $EnvPath }

$values = Read-EnvMap $EnvPath
$dbs = @(
  @('KONG_PG_PASSWORD','KONG_PG_DATABASE','kong','KONG_PG_USER','kong'),
  @('AUTH_DB_PASSWORD','AUTH_DB_NAME','auth','AUTH_DB_USER','auth'),
  @('DOCTOR_DB_PASSWORD','DOCTOR_DB_NAME','doctor','DOCTOR_DB_USER','doctor'),
  @('RECEPTIONIST_DB_PASSWORD','RECEPTIONIST_DB_NAME','receptionist','RECEPTIONIST_DB_USER','receptionist'),
  @('PATIENT_DB_PASSWORD','PATIENT_DB_NAME','patient','PATIENT_DB_USER','patient')
)
foreach ($db in $dbs) {
  if (-not $values[$db[1]]) { Set-EnvValue $EnvPath $db[1] $db[2] }
  if (-not $values[$db[3]]) { Set-EnvValue $EnvPath $db[3] $db[4] }
  if ($fresh -or (Is-Placeholder $values[$db[0]])) { Set-EnvValue $EnvPath $db[0] (New-RandomBase64Url 32) }
  $values = Read-EnvMap $EnvPath
}

$urls = @(
  @('AUTH_DATABASE_URL','AUTH_DB_USER','AUTH_DB_PASSWORD','AUTH_DB_NAME','AUTH_DB_PORT','5433'),
  @('DOCTOR_DATABASE_URL','DOCTOR_DB_USER','DOCTOR_DB_PASSWORD','DOCTOR_DB_NAME','DOCTOR_DB_PORT','5435'),
  @('RECEPTIONIST_DATABASE_URL','RECEPTIONIST_DB_USER','RECEPTIONIST_DB_PASSWORD','RECEPTIONIST_DB_NAME','RECEPTIONIST_DB_PORT','5436'),
  @('PATIENT_DATABASE_URL','PATIENT_DB_USER','PATIENT_DB_PASSWORD','PATIENT_DB_NAME','PATIENT_DB_PORT','5434')
)
foreach ($url in $urls) {
  $values = Read-EnvMap $EnvPath
  if (-not $values[$url[4]]) { Set-EnvValue $EnvPath $url[4] $url[5] }
  $values = Read-EnvMap $EnvPath
  if ($fresh -or -not $values[$url[0]]) {
    $connection = 'postgresql://' + $values[$url[1]] + ':' + $values[$url[2]] + '@localhost:' + $values[$url[4]] + '/' + $values[$url[3]] + '?schema=public'
    Set-EnvValue $EnvPath $url[0] $connection
  }
}

$values = Read-EnvMap $EnvPath
Ensure-AuthKeys $EnvPath
Ensure-InternalKeys $EnvPath
$values = Read-EnvMap $EnvPath

if (-not $values.AUTH_JWT_ISSUER) { Set-EnvValue $EnvPath 'AUTH_JWT_ISSUER' 'maternal-healthcare-auth' }
if (-not $values.AUTH_JWT_AUDIENCE) { Set-EnvValue $EnvPath 'AUTH_JWT_AUDIENCE' 'maternal-healthcare-api' }
if (-not $values.AUTH_JWT_KEY_ID -or (Is-Placeholder $values.AUTH_JWT_KEY_ID)) { Set-EnvValue $EnvPath 'AUTH_JWT_KEY_ID' 'local-dev-key' }
if ($fresh -or (Is-Placeholder $values.AUTH_REFRESH_TOKEN_PEPPER)) { Set-EnvValue $EnvPath 'AUTH_REFRESH_TOKEN_PEPPER' (New-RandomBase64Url 48) }
if ((Is-Placeholder $values.PATIENT_NATIONAL_ID_ENCRYPTION_KEY)) { Set-EnvValue $EnvPath 'PATIENT_NATIONAL_ID_ENCRYPTION_KEY' (New-RandomBase64 32) }
if ((Is-Placeholder $values.PATIENT_NATIONAL_ID_LOOKUP_PEPPER)) { Set-EnvValue $EnvPath 'PATIENT_NATIONAL_ID_LOOKUP_PEPPER' (New-RandomHex 32) }
if (-not $values.PATIENT_INTERNAL_JWT_KEY_ID -or (Is-Placeholder $values.PATIENT_INTERNAL_JWT_KEY_ID)) { Set-EnvValue $EnvPath 'PATIENT_INTERNAL_JWT_KEY_ID' 'internal-dev-key' }
if (-not $values.PATIENT_INTERNAL_JWT_ISSUER) { Set-EnvValue $EnvPath 'PATIENT_INTERNAL_JWT_ISSUER' 'maternal-healthcare-internal' }
if (-not $values.PATIENT_INTERNAL_JWT_AUDIENCE) { Set-EnvValue $EnvPath 'PATIENT_INTERNAL_JWT_AUDIENCE' 'patient-service' }
if ($fresh -or (Is-Placeholder $values.INTERNAL_SERVICE_AUTH_SECRET)) { Set-EnvValue $EnvPath 'INTERNAL_SERVICE_AUTH_SECRET' (New-RandomBase64Url 32) }
if (-not $values.AUTH_ACCOUNT_LOOKUP_URL) { Set-EnvValue $EnvPath 'AUTH_ACCOUNT_LOOKUP_URL' 'http://localhost:5003/internal/accounts' }

$values = Read-EnvMap $EnvPath
[Environment]::SetEnvironmentVariable('AUTH_DATABASE_URL', $values.AUTH_DATABASE_URL, 'Process')
[Environment]::SetEnvironmentVariable('DOCTOR_DATABASE_URL', $values.DOCTOR_DATABASE_URL, 'Process')
[Environment]::SetEnvironmentVariable('PATIENT_DATABASE_URL', $values.PATIENT_DATABASE_URL, 'Process')
Write-Host "Environment ready: $EnvPath"

if ($Mode -eq 'PrepareOnly') { exit 0 }

function Wait-Healthy([string]$Service) {
  $deadline = (Get-Date).AddMinutes(2)
  do {
    $id = (& docker compose ps -q $Service).Trim()
    if ($id) {
      $health = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $id).Trim()
      if ($health -eq 'healthy') { return }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Timeout waiting for $Service"
}

function Wait-Migration([string]$Service) {
  $deadline = (Get-Date).AddMinutes(3)
  do {
    $id = (& docker compose ps -aq $Service).Trim()
    if ($id) {
      $state = (& docker inspect --format '{{.State.Status}}|{{.State.ExitCode}}' $id).Trim()
      if ($state -eq 'exited|0') { return }
      if ($state -like 'exited|*') { throw "$Service failed. Run: docker compose logs $Service" }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Timeout waiting for $Service"
}

if ($Mode -eq 'Docker') {
  Run-Command 'docker' @('info')
  Run-Command 'docker' @('compose','config','--quiet')
  if ($NoBuild) { Run-Command 'docker' @('compose','up','-d') }
  else { Run-Command 'docker' @('compose','up','--build','-d') }
  Wait-Migration 'auth-migrate'
  Wait-Migration 'doctor-migrate'
  Wait-Migration 'receptionist-migrate'
  Wait-Migration 'patient-migrate'
  Run-Command 'docker' @('compose','ps','-a')
  exit 0
}

if ($Mode -eq 'Local') {
  Run-Command 'docker' @('compose','up','-d','auth-database','doctor-database','receptionist-database','patient-database')
  Wait-Healthy 'auth-database'
  Wait-Healthy 'doctor-database'
  Wait-Healthy 'receptionist-database'
  Wait-Healthy 'patient-database'
  Push-Location $ServicesPath
  try {
    if (-not (Test-Path (Join-Path $ServicesPath 'node_modules'))) { npm.cmd ci }
    npm.cmd run prisma:generate
    npm.cmd run prisma:generate:doctor
    npm.cmd run prisma:generate:patient
    npm.cmd run prisma:migrate:deploy
    npm.cmd run prisma:migrate:doctor
    npm.cmd run prisma:migrate:receptionist
    npm.cmd run prisma:migrate:patient
    npm.cmd run prisma:seed
    npm.cmd run prisma:seed:doctor
  } finally { Pop-Location }
  Write-Host 'Local databases migrated. Run . .\scripts\load-env.ps1 before starting each app.'
  exit 0
}
