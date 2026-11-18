# crop.ps1 <in.png> <out.png> <x> <y> <w> <h> <scale>
param([string]$In, [string]$Out, [int]$X, [int]$Y, [int]$W, [int]$H, [int]$Scale)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::new($In)
$src = New-Object System.Drawing.Rectangle($X, $Y, $W, $H)
$tw = [Math]::Max(1, $W * $Scale); $th = [Math]::Max(1, $H * $Scale)
$dst = New-Object System.Drawing.Bitmap($tw, $th)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, $tw, $th)), $src, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$dst.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose(); $bmp.Dispose()
Write-Output "OK $Out ${tw}x${th}"
