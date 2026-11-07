param(
    [string]$Blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    if (!(Test-Path -LiteralPath $Blender)) { throw 'Không tìm thấy Blender. Truyền đường dẫn bằng -Blender.' }
    $cli = Get-ChildItem "$env:LOCALAPPDATA/npm-cache/_npx/*/node_modules/@gltf-transform/cli/bin/cli.js" | Where-Object {
        (Get-Content (Join-Path $_.Directory.Parent.FullName 'package.json') -Raw | ConvertFrom-Json).version -eq '4.5.0'
    } | Select-Object -First 1 -ExpandProperty FullName
    if (!$cli) { throw 'Chạy npx.cmd --yes @gltf-transform/cli@4.5.0 --version một lần để chuẩn bị công cụ tối ưu.' }
    python scripts/create-street-textures.py
    if ($LASTEXITCODE) { throw 'Tạo texture thất bại.' }
    $blenderProcess = Start-Process -FilePath $Blender -ArgumentList '-b', '--factory-startup', '--python', 'scripts/build-sakura-street.py' -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput 'assets/processed/blender-build.log' -RedirectStandardError 'assets/processed/blender-stderr.log'
    if ($blenderProcess.ExitCode -ne 0 -or !(Select-String -Path assets/processed/blender-build.log -Pattern 'SAKURA_EXPORT_COMPLETE' -Quiet)) { throw 'Blender thất bại. Xem assets/processed/blender-build.log.' }
    $files = Get-ChildItem assets/processed/*.raw.glb
    foreach ($file in $files) {
        $target = if ($file.Name -eq 'buildings.raw.glb') { 'apps/web/public/assets/buildings/sakura-street.glb' } else { 'apps/web/public/assets/props/' + $file.Name.Replace('.raw', '') }
        node $cli optimize $file.FullName $target --compress quantize --simplify false --join false --texture-compress false --palette false --prune-attributes false
        if ($LASTEXITCODE) { throw "Tối ưu thất bại: $($file.Name)" }
    }
    python scripts/package-street-assets.py
    if ($LASTEXITCODE) { throw 'Đóng gói texture dùng chung thất bại.' }
} finally { Pop-Location }
