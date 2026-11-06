$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDirectory = Join-Path $repoRoot "API"
$python = Join-Path $apiDirectory ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  throw "Không tìm thấy API\.venv. Hãy tạo môi trường và cài API\requirements.txt, pyodbc trước."
}

$hostName = Read-Host "SQL Server host [sql8020.site4now.net]"
if ([string]::IsNullOrWhiteSpace($hostName)) { $hostName = "sql8020.site4now.net" }
$database = Read-Host "Database name [db_ad0b71_dattour]"
if ([string]::IsNullOrWhiteSpace($database)) { $database = "db_ad0b71_dattour" }
$username = Read-Host "SQL login [db_ad0b71_dattour_admin]"
if ([string]::IsNullOrWhiteSpace($username)) { $username = "db_ad0b71_dattour_admin" }

$securePassword = Read-Host "SQL password (input is hidden)" -AsSecureString
if ($securePassword.Length -eq 0) { throw "Mật khẩu không được để trống." }
$passwordPointer = [IntPtr]::Zero
try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $escapedUser = [uri]::EscapeDataString($username)
  $escapedPassword = [uri]::EscapeDataString($password)
  $escapedDatabase = [uri]::EscapeDataString($database)
  $env:THAM_SQLSERVER_URL = "mssql+pyodbc://${escapedUser}:${escapedPassword}@${hostName}:1433/${escapedDatabase}?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no"
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  $password = $null
}

$gateway = $null
try {
  $env:THAM_SQLSERVER_CATALOG_API_URL = "http://127.0.0.1:8010"
  $env:HOST = "127.0.0.1"
  $env:PORT = "8001"
  $gateway = Start-Process -FilePath $python `
    -ArgumentList @("-m", "uvicorn", "api.tham_sqlserver_app:app", "--host", "127.0.0.1", "--port", "8010") `
    -WorkingDirectory $apiDirectory -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:8010/api/v1/health/ready" -TimeoutSec 5
      if ($health.status -eq "ok") {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  if (-not $ready) {
    throw "SQL Server API chưa sẵn sàng. Kiểm tra database, tài khoản, mạng và ODBC Driver 18."
  }

  Remove-Item Env:THAM_SQLSERVER_URL
  Write-Host "Đã kết nối SQL Server ở chế độ chỉ đọc."
  Write-Host "Website: http://127.0.0.1:8001/"
  Write-Host "Dừng website bằng Ctrl+C; API kết nối SQL Server sẽ được dừng cùng."
  Push-Location $repoRoot
  try {
    & node "server.js"
    if ($LASTEXITCODE -ne 0) { throw "Node.js server đã thoát với lỗi." }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item Env:THAM_SQLSERVER_URL -ErrorAction SilentlyContinue
  Remove-Item Env:THAM_SQLSERVER_CATALOG_API_URL -ErrorAction SilentlyContinue
  Remove-Item Env:HOST -ErrorAction SilentlyContinue
  Remove-Item Env:PORT -ErrorAction SilentlyContinue
  if ($gateway -and -not $gateway.HasExited) {
    Stop-Process -Id $gateway.Id -ErrorAction SilentlyContinue
  }
}
