# Builds public/download/whatsapp-sender.zip for other people to run their own sender.
# Only listed files are copied, so your WhatsApp login (.wwebjs_auth), .env and results never get in.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$include = @('src', 'package.json', 'package-lock.json', '.env.example', 'contacts.csv', 'start.bat', 'scripts', 'README.md', 'LICENSE')

$stage = Join-Path ([IO.Path]::GetTempPath()) "whatsapp-sender-$([guid]::NewGuid())"
$target = Join-Path $stage 'whatsapp-sender'
New-Item -ItemType Directory -Force $target | Out-Null
foreach ($item in $include) { Copy-Item (Join-Path $root $item) $target -Recurse }

$outDir = Join-Path $root 'public\download'
New-Item -ItemType Directory -Force $outDir | Out-Null
$zip = Join-Path $outDir 'whatsapp-sender.zip'
Compress-Archive -Path $target -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
Write-Host "Created $zip"
