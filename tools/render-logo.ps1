# Renders the Adronis logo PNGs in brand/ from brand/logo-source.html.
# Uses headless Chrome with a transparent background, then trims the empty edges.
Add-Type -AssemblyName System.Drawing
$root   = Split-Path $PSScriptRoot -Parent
$brand  = Join-Path $root 'brand'
$src    = 'file:///' + ((Join-Path $brand 'logo-source.html') -replace '\\','/')
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$tmp    = Join-Path $env:TEMP 'adronis-logo-shot.png'

function Render($query, $w, $h, $out, $pad) {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  & $chrome --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 `
    "--window-size=$w,$h" "--screenshot=$tmp" --virtual-time-budget=3000 "$src`?$query" 2>$null | Out-Null
  $i = 0; while (-not (Test-Path $tmp) -and $i -lt 50) { Start-Sleep -Milliseconds 200; $i++ }
  $bmp = New-Object System.Drawing.Bitmap $tmp
  # Find the box that holds every non-transparent pixel.
  $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $data = $bmp.LockBits($rect, 'ReadOnly', 'Format32bppArgb')
  $bytes = New-Object byte[] ($data.Stride * $bmp.Height)
  [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    $row = $y * $data.Stride
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($bytes[$row + $x * 4 + 3] -gt 0) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
  $outBmp = New-Object System.Drawing.Bitmap ($cw + 2 * $pad), ($ch + 2 * $pad), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($outBmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle $pad, $pad, $cw, $ch), (New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch), 'Pixel')
  $g.Dispose(); $bmp.Dispose()
  $outBmp.Save((Join-Path $brand $out), [System.Drawing.Imaging.ImageFormat]::Png)
  "$out  $($outBmp.Width)x$($outBmp.Height)"
  $outBmp.Dispose()
}

# Mark only (square, no padding so it fills the file).
foreach ($s in 1024, 512, 256) { Render "size=$s" ($s + 200) ($s + 200) "adronis-logo-$s.png" 0 }
# Mark + "Adronis" wordmark: dark text for light backgrounds, light text for dark ones.
Render 'size=512&text=dark'  2400 800 'adronis-logo-text-dark.png'  24
Render 'size=512&text=light' 2400 800 'adronis-logo-text-light.png' 24
Render 'size=256&text=dark'  1300 500 'adronis-logo-text-dark-small.png'  12
Render 'size=256&text=light' 1300 500 'adronis-logo-text-light-small.png' 12
