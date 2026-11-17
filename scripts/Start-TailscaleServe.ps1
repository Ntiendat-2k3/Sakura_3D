# Mở game cho máy khác trong tailnet qua HTTPS bằng `tailscale serve` (miễn phí, chỉ người trong tailnet truy cập được).
# Web 443 -> 127.0.0.1:3000, API 8443 -> 127.0.0.1:4000, world server 10000 -> 127.0.0.1:2567 (wss).
# Không sửa .env; chỉ in dòng CORS_ORIGIN cần thêm. Dùng -Reset để gỡ toàn bộ cấu hình serve/funnel.
# -Funnel: mở CÔNG KHAI ra internet bằng `tailscale funnel` để gửi link cho người không cài Tailscale.
#   Ai có link cũng vào được và auth demo không có bảo mật thật: chỉ bật khi đang test, xong chạy -Reset.
param([switch]$Reset, [switch]$Funnel)
$ErrorActionPreference = 'Stop'
$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if (!$tailscale) { throw 'Chưa cài Tailscale hoặc chưa có lệnh tailscale trong PATH. Cài từ https://tailscale.com/download rồi mở lại PowerShell.' }
if ($Reset) { & tailscale serve reset; Write-Host 'Đã gỡ cấu hình tailscale serve/funnel (link công khai cũng ngừng hoạt động).'; exit 0 }

$status = & tailscale status --json | ConvertFrom-Json
if ($status.BackendState -ne 'Running') { throw 'Tailscale chưa đăng nhập/kết nối. Chạy `tailscale up` (hoặc đăng nhập trong ứng dụng) rồi thử lại.' }
$hostName = ([string]$status.Self.DNSName).TrimEnd('.')
if (!$hostName) { throw 'Không đọc được tên MagicDNS. Bật MagicDNS và HTTPS Certificates trong trang quản trị Tailscale (DNS).' }

# Ba cổng HTTPS mà tailscale serve cho phép: 443, 8443, 10000. Khớp SECURE_SERVICE_PORTS trong apps/web/game/networking/serviceUrls.ts.
# Funnel dùng đúng ba cổng này nên cả hai chế độ chung một cấu hình. Lần đầu bật Funnel, Tailscale có thể in link để cấp quyền trong trang quản trị.
$mode = if ($Funnel) { 'funnel' } else { 'serve' }
foreach ($pair in @(@(443, 3000), @(8443, 4000), @(10000, 2567))) {
  & tailscale $mode --bg --yes "--https=$($pair[0])" "http://127.0.0.1:$($pair[1])"
  if ($LASTEXITCODE -ne 0) { throw "tailscale $mode cổng $($pair[0]) thất bại. Làm theo hướng dẫn Tailscale in ở trên (bật HTTPS Certificates / Funnel) rồi chạy lại." }
}
& tailscale $mode status

Write-Host ''
if ($Funnel) {
  Write-Host "LINK CÔNG KHAI gửi cho bạn chơi cùng: https://$hostName" -ForegroundColor Yellow
  Write-Host 'Bất kỳ ai có link đều vào được. Test xong chạy: .\scripts\Start-TailscaleServe.ps1 -Reset' -ForegroundColor Yellow
} else {
  Write-Host "Địa chỉ chơi (cả hai máy): https://$hostName"
}
Write-Host 'Thêm origin này vào CORS_ORIGIN trong .env rồi khởi động lại `npm run dev`, ví dụ:'
Write-Host "  CORS_ORIGIN=http://localhost:3000,https://$hostName"
