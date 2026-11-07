# Tạo khóa JWT và mật khẩu database ngẫu nhiên khi chưa có .env.
# Chạy trên PowerShell 5.1+ và không thay đổi thiết lập toàn máy.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root '.env.example'
$target = Join-Path $root '.env'
if (Test-Path $target) { Write-Host '.env already exists; not overwriting.'; exit 0 }
if (!(Test-Path $source)) { throw '.env.example missing' }
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$secret = [Convert]::ToBase64String($bytes)
$dbBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($dbBytes) } finally { $rng.Dispose() }
$dbPassword = [BitConverter]::ToString($dbBytes).Replace('-', '').ToLowerInvariant()
$content = [IO.File]::ReadAllText($source)
$content = $content.Replace('replace-this-with-a-private-random-secret-32-chars-min', $secret)
$content = $content.Replace('replace-this-with-a-private-random-db-password', $dbPassword)
[IO.File]::WriteAllText($target, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Created .env with random JWT and database secrets. Keep it private.'
