param(
  [string]$SourceDirectory = 'C:\Users\yanag\Documents\Codex\2026-10-03\s\outputs\勤怠アプリ_ゲーム付き別版'
)
$ErrorActionPreference = 'Stop'
$gameSource = Join-Path $SourceDirectory 'games'
$catalogPath = Join-Path $gameSource 'catalog.json'
if (-not (Test-Path -LiteralPath $catalogPath)) { throw 'ゲーム一覧が見つかりません。ゲームアプリのフォルダを指定してください。' }
$catalog = Get-Content -LiteralPath $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json
$gameIds = @($catalog.PSObject.Properties.Name)
foreach ($game in $catalog.PSObject.Properties) {
  $file = [string]$game.Value.file
  if ($file -notmatch '^[a-z0-9-]+\.html$' -or -not (Test-Path -LiteralPath (Join-Path $gameSource $file))) { throw 'ゲーム一覧のファイルを確認してください。' }
}
$gameTarget = Join-Path $PSScriptRoot 'games'
New-Item -ItemType Directory -Path $gameTarget -Force | Out-Null
Get-ChildItem -LiteralPath $gameSource -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $gameTarget $_.Name) -Force }
$configPath = Join-Path $PSScriptRoot 'games-config.js'
$currentText = Get-Content -LiteralPath $configPath -Raw -Encoding utf8
$currentConfig = ($currentText -replace '(?s)^.*?window.KINTAI_GAMES\s*=','' -replace ';\s*$','') | ConvertFrom-Json
$currentConfig.gameIds = $gameIds
$currentConfig.version = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
$configText = '// enabled:false でゲームを解除できます。' + [Environment]::NewLine + 'window.KINTAI_GAMES=' + ($currentConfig | ConvertTo-Json -Depth 5) + ';'
Set-Content -LiteralPath $configPath -Value $configText -Encoding utf8
$rankingSource = Join-Path $SourceDirectory 'google-apps-script\GameRanking.gs'
if (Test-Path -LiteralPath $rankingSource) { Copy-Item -LiteralPath $rankingSource -Destination (Join-Path $PSScriptRoot 'google-apps-script\GameRanking.gs') -Force }
Write-Output ('ゲームを更新しました：' + $gameIds.Count + '種類。勤怠本体は変更していません。')
