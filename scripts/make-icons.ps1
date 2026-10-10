# Builds Mirlo Blue's icon, Android adaptive icon, and splash logo from the Mirlo bird.
# The bird is recolored Nightwing yellow; the icon sits it on the dark background with a soft cyan glow.
param([string]$Root = "c:\LLM\Mirlo-Blue")
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("$Root\assets\images\Logo-Mirlo_LogoOnly.png")

# Tight bounding box of the bird's visible pixels, so it centers by what you see
$minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = 0; $x -lt $src.Width; $x++) {
    if ($src.GetPixel($x, $y).A -gt 20) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$crop = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))

# Color matrix: drop the original color, keep alpha, paint #ffd60a
$yellow = New-Object System.Drawing.Imaging.ColorMatrix
$yellow.Matrix00 = 0; $yellow.Matrix11 = 0; $yellow.Matrix22 = 0; $yellow.Matrix33 = 1
$yellow.Matrix40 = 1.0; $yellow.Matrix41 = 0.839; $yellow.Matrix42 = 0.039
$attrs = New-Object System.Drawing.Imaging.ImageAttributes
$attrs.SetColorMatrix($yellow)

function New-Canvas([int]$size, [bool]$dark) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"; $g.InterpolationMode = "HighQualityBicubic"; $g.PixelOffsetMode = "HighQuality"
  if ($dark) {
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#070b14"))
    # Soft cyan glow behind the bird
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse([int]($size * 0.08), [int]($size * 0.08), [int]($size * 0.84), [int]($size * 0.84))
    $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $glow.CenterColor = [System.Drawing.Color]::FromArgb(70, 0, 210, 255)
    $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 210, 255))
    $g.FillPath($glow, $path)
  } else {
    $g.Clear([System.Drawing.Color]::Transparent)
  }
  return @($bmp, $g)
}

function Draw-Bird($g, [int]$size, [double]$scale) {
  # Fit the bird's longer side to $scale of the canvas, centered
  $fit = $size * $scale / [Math]::Max($crop.Width, $crop.Height)
  $w = [int]($crop.Width * $fit); $h = [int]($crop.Height * $fit)
  $dest = New-Object System.Drawing.Rectangle([int](($size - $w) / 2), [int](($size - $h) / 2), $w, $h)
  $g.DrawImage($src, $dest, $crop.X, $crop.Y, $crop.Width, $crop.Height, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
}

function Save($pair, [string]$name) {
  $pair[1].Dispose()
  $pair[0].Save("$Root\assets\images\$name", [System.Drawing.Imaging.ImageFormat]::Png)
  $pair[0].Dispose()
  "wrote $name"
}

# App icon (iOS and fallback): full square, dark with glow
$c = New-Canvas 1024 $true; Draw-Bird $c[1] 1024 0.56; Save $c "mirlo-blue-icon.png"
# Android adaptive foreground: transparent, bird inside the center safe zone
$c = New-Canvas 1024 $false; Draw-Bird $c[1] 1024 0.42; Save $c "mirlo-blue-adaptive.png"
# Splash logo: transparent, padded so Android 12+'s circular crop keeps the whole bird
$c = New-Canvas 512 $false; Draw-Bird $c[1] 512 0.62; Save $c "mirlo-blue-splash.png"

$src.Dispose()
