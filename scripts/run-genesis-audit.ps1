$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (Test-Path $bundledNode) {
  $node = $bundledNode
} else {
  $node = "node"
}

& $node (Join-Path $workspace "scripts\genesis-audit.js") @args
exit $LASTEXITCODE
