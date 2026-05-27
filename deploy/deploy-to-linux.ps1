param(
  [Parameter(Mandatory = $true)]
  [string] $HostName,

  [string] $User,
  [int] $Port = 3000,
  [switch] $EnableHttps,
  [int] $HttpsPort = 3443,
  [string] $PublicHost,
  [string] $AllowedOrigins = "*",
  [string] $AppDir = "/home/kmh251/deployment/chatty",
  [string] $RemoteWorkDir = "/tmp/chatty-deploy"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $repoRoot "dist"
$archive = Join-Path $distDir "chatty-production.tar.gz"
$target = if ([string]::IsNullOrWhiteSpace($User)) { $HostName } else { "$User@$HostName" }
$resolvedPublicHost = if ([string]::IsNullOrWhiteSpace($PublicHost)) { $HostName } else { $PublicHost }

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $archive) {
  Remove-Item -LiteralPath $archive -Force
}

Push-Location $repoRoot
try {
  tar `
    --exclude=".git" `
    --exclude="node_modules" `
    --exclude="dist" `
    -czf $archive .
}
finally {
  Pop-Location
}

ssh -o ConnectTimeout=10 $target "rm -rf '$RemoteWorkDir' && mkdir -p '$RemoteWorkDir'"
scp $archive "${target}:/tmp/chatty-production.tar.gz"

$remoteCommand = @"
set -e
tar -xzf /tmp/chatty-production.tar.gz -C '$RemoteWorkDir'
cd '$RemoteWorkDir'
sudo APP_DIR='$AppDir' PORT='$Port' ENABLE_HTTPS='$($EnableHttps.IsPresent.ToString().ToLowerInvariant())' HTTPS_PORT='$HttpsPort' PUBLIC_HOST='$resolvedPublicHost' ALLOWED_ORIGINS='$AllowedOrigins' bash deploy/linux/install-chatty.sh
curl -fsS "http://127.0.0.1:$Port/api/health"
"@

if ($EnableHttps.IsPresent) {
  $remoteCommand = @"
$remoteCommand
curl -k -fsS "https://127.0.0.1:$HttpsPort/api/health"
"@
}

ssh -t $target $remoteCommand
