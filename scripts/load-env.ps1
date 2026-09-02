param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $EnvFile)) { throw "Không tìm thấy file .env: $EnvFile" }

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) { return }
  $parts = $line -split '=', 2
  $name = $parts[0].Trim()
  $value = $parts[1].Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  $value = $value.Replace('\r\n', [string][char]13 + [char]10)
  $value = $value.Replace('\n', [string][char]10)
  [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}
Write-Host "Đã load .env vào PowerShell process hiện tại."
