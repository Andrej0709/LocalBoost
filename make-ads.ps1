# Makes ads for one Adronis account by calling the engine function.
# Usage:  .\make-ads.ps1 demo@example.com
# Asks for ENGINE_CRON_SECRET each time; it is never saved to a file.
param([Parameter(Mandatory = $true)][string]$Email)

$secure = Read-Host "ENGINE_CRON_SECRET" -AsSecureString
$secret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

$result = Invoke-RestMethod -Method Post `
  -Uri "https://jctvpizlzznabcjaxlgk.supabase.co/functions/v1/engine" `
  -Headers @{ "x-cron-secret" = $secret } `
  -Body (@{ make = $Email } | ConvertTo-Json) `
  -ContentType "application/json"

$result | ConvertTo-Json -Depth 5
Write-Host "`nSlike stizu asinhrono. Pokreni ponovo za minut-dva ako nisu gotove."
