[CmdletBinding()]
param(
  [ValidateSet('Docker','Local','PrepareOnly')]
  [string]$Mode = '',
  [switch]$NoBuild,
  [switch]$ConfigureSmtp,
  [switch]$SeedDemo
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SetupLocal = Join-Path $PSScriptRoot 'setup-local.ps1'
$EnvPath = Join-Path $Root '.env'

function Set-EnvValue([string]$Name, [string]$Value) {
  $lines = [Collections.Generic.List[string]](Get-Content $EnvPath)
  $prefix = "$Name="
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].StartsWith($prefix)) {
      $lines[$i] = $prefix + $Value
      $found = $true
      break
    }
  }
  if (-not $found) { $lines.Add($prefix + $Value) }
  [IO.File]::WriteAllLines($EnvPath, $lines, (New-Object Text.UTF8Encoding($false)))
}

function Read-Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$modeWasProvided = $PSBoundParameters.ContainsKey('Mode')
$KeysPath = Join-Path $PSScriptRoot 'keys'

function Reset-LocalConfigIfNeeded {
  $hasEnv = Test-Path $EnvPath
  $hasKeys = (Test-Path $KeysPath) -and @((Get-ChildItem $KeysPath -Filter '*.pem' -ErrorAction SilentlyContinue)).Count -gt 0
  if (-not ($hasEnv -or $hasKeys)) { return }

  Write-Warning 'Existing local configuration was found.'
  Write-Host 'The following local configuration can be regenerated:' -ForegroundColor Yellow
  if ($hasEnv) { Write-Host "  - $EnvPath" }
  if ($hasKeys) { Write-Host "  - $KeysPath\*.pem" }
  Write-Host 'This does not delete Docker containers, images, volumes or databases.' -ForegroundColor Yellow
  $answer = Read-Host 'Delete old local config and regenerate it? [y/N]'
  if ($answer -notmatch '^(y|yes)$') {
    Write-Host 'Keeping existing local configuration.' -ForegroundColor Yellow
    return
  }

  if ($hasEnv) {
    $envInfo = Get-Item -LiteralPath $EnvPath
    if ($envInfo.Length -gt 1MB) {
      $backup = "$EnvPath.corrupt.$((Get-Date).ToString('yyyyMMddHHmmss'))"
      Move-Item -LiteralPath $EnvPath -Destination $backup -Force
      Write-Host "Corrupt .env moved to $backup" -ForegroundColor Yellow
    } else {
      Remove-Item -LiteralPath $EnvPath -Force
    }
  }
  if ($hasKeys) { Remove-Item (Join-Path $KeysPath '*.pem') -Force -ErrorAction SilentlyContinue }
  Write-Host 'Old local configuration deleted.' -ForegroundColor Green
}

Write-Host '=== Maternal Healthcare local setup ===' -ForegroundColor Cyan
Write-Host "Root: $Root"

if (-not $Mode) {
  Write-Host 'Select run mode:'
  Write-Host '  1. Docker - run the full stack with Docker Compose (recommended)'
  Write-Host '  2. Local  - run databases with Docker and apps with Node/Nest'
  Write-Host '  3. PrepareOnly - create .env, keys and secrets only'
  $choice = Read-Host 'Enter choice [1]'
  $Mode = switch ($choice) { '2' { 'Local' } '3' { 'PrepareOnly' } default { 'Docker' } }
}

Reset-LocalConfigIfNeeded

if (-not (Test-Path $EnvPath)) {
  Copy-Item (Join-Path $Root '.env.example') $EnvPath
  Write-Host 'Created .env from .env.example' -ForegroundColor Green
}

# setup-local creates or updates keys, peppers, database URLs and local secrets.
& $SetupLocal -Mode 'PrepareOnly'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$configureSmtpNow = $ConfigureSmtp
if (-not $modeWasProvided) {
  $smtpChoice = Read-Host 'Configure SMTP for password reset? [y/N]'
  $configureSmtpNow = $smtpChoice -match '^(y|yes)$'
}
if ($configureSmtpNow) {
  Set-EnvValue 'AUTH_SMTP_HOST' (Read-Host 'SMTP host')
  $smtpPort = Read-Host 'SMTP port [587]'; if (-not $smtpPort) { $smtpPort = '587' }
  Set-EnvValue 'AUTH_SMTP_PORT' $smtpPort
  $smtpSecure = Read-Host 'SMTP secure true/false [false]'; if (-not $smtpSecure) { $smtpSecure = 'false' }
  Set-EnvValue 'AUTH_SMTP_SECURE' $smtpSecure
  Set-EnvValue 'AUTH_SMTP_USER' (Read-Host 'SMTP user, optional')
  Set-EnvValue 'AUTH_SMTP_PASSWORD' (Read-Secret 'SMTP password')
  Set-EnvValue 'AUTH_EMAIL_FROM' (Read-Host 'Sender email')
}

if ($Mode -eq 'PrepareOnly') {
  Write-Host "Preparation completed. Config file: $EnvPath" -ForegroundColor Green
  exit 0
}

if ($Mode -eq 'Docker') {
  if ($NoBuild) { & $SetupLocal -Mode 'Docker' -NoBuild }
  else { & $SetupLocal -Mode 'Docker' }
} elseif ($Mode -eq 'Local') {
  & $SetupLocal -Mode 'Local'
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($SeedDemo -and $Mode -eq 'Docker') {
  Push-Location (Join-Path $Root 'services')
  try { npm.cmd run prisma:seed:demo }
  finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host 'Setup completed.' -ForegroundColor Green
if ($Mode -eq 'Docker') {
  Write-Host 'Frontend: http://localhost:3000'
  Write-Host 'Gateway:  http://localhost:8080'
}
if ($Mode -eq 'Local') {
  Write-Host 'Databases are ready. Start local apps according to docs/first-run.md.'
}
