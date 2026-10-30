param(
    [string]$SourceUrl = $env:REHEARSAL_DATABASE_URL
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($SourceUrl)) {
    throw "Set REHEARSAL_DATABASE_URL to a disposable database containing synthetic data."
}
if ($env:REHEARSAL_SYNTHETIC_DATA -ne "1") {
    throw "Set REHEARSAL_SYNTHETIC_DATA=1 only after confirming the source contains synthetic data."
}

$normalizedUrl = $SourceUrl -replace '^postgresql\+psycopg://', 'postgresql://'
$sourceUri = [Uri]$normalizedUrl
$sourceDatabase = [Uri]::UnescapeDataString($sourceUri.AbsolutePath.TrimStart('/'))
if ($sourceUri.Scheme -ne "postgresql") {
    throw "Only PostgreSQL URLs are accepted."
}
if ($sourceDatabase -notmatch '^(delta_demo_[a-zA-Z0-9_]+|[a-zA-Z0-9_]+_test)$') {
    throw "Source database name must start with delta_demo_ or end with _test."
}

$pgTools = @("pg_dump", "pg_restore", "createdb", "dropdb", "psql")
foreach ($tool in $pgTools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required PostgreSQL tool '$tool' is not installed or not on PATH."
    }
}

$separator = $sourceUri.UserInfo.IndexOf(':')
if ($separator -ge 0) {
    $encodedUsername = $sourceUri.UserInfo.Substring(0, $separator)
    $encodedPassword = $sourceUri.UserInfo.Substring($separator + 1)
}
else {
    $encodedUsername = $sourceUri.UserInfo
    $encodedPassword = $null
}
$username = [Uri]::UnescapeDataString($encodedUsername)
if ([string]::IsNullOrWhiteSpace($username)) {
    throw "The rehearsal URL must include a PostgreSQL username."
}
$oldPassword = $env:PGPASSWORD
if ($null -ne $encodedPassword) {
    $env:PGPASSWORD = [Uri]::UnescapeDataString($encodedPassword)
}

$port = if ($sourceUri.IsDefaultPort) { "5432" } else { [string]$sourceUri.Port }
$hostName = $sourceUri.DnsSafeHost
$commonArgs = @("-w", "-h", $hostName, "-p", $port, "-U", $username)
$runId = [Guid]::NewGuid().ToString("N")
$restoreDatabase = "delta_restore_$runId"
$rollbackDatabase = "delta_rollback_$runId"
$outputDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "delta-db-rehearsal"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$dumpPath = Join-Path $outputDirectory "backup_$runId.dump"
$logPath = Join-Path $outputDirectory "rehearsal_$runId.log"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$apiDirectory = Join-Path $repoRoot "API"
$rollbackUrl = $SourceUrl -replace "/$([Regex]::Escape($sourceDatabase))(?=\?|$)", "/$rollbackDatabase"

function Write-RehearsalLog {
    param([string]$Message)
    $line = "$(Get-Date -Format o) $Message"
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    Write-Output $line
}

function Invoke-Psql {
    param([string]$Database, [string]$Sql)
    $output = & psql @commonArgs -d $Database -X -A -t -v ON_ERROR_STOP=1 -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed for database '$Database': $($output -join ' ')"
    }
    return ($output -join "`n").Trim()
}

function Invoke-Alembic {
    param([string]$DatabaseUrl, [string[]]$MigrationArgs)
    $previousUrl = $env:DATABASE_URL
    $env:DATABASE_URL = $DatabaseUrl
    try {
        Push-Location $apiDirectory
        try {
            $output = & python -m alembic -c ..\database\alembic.ini @MigrationArgs 2>&1
            $safeOutput = ($output -join "`n").Replace($DatabaseUrl, "[DATABASE_URL REDACTED]")
            if ($LASTEXITCODE -ne 0) {
                Write-RehearsalLog $safeOutput
                throw "Alembic $($MigrationArgs -join ' ') failed."
            }
            if (-not [string]::IsNullOrWhiteSpace($safeOutput)) {
                Write-RehearsalLog $safeOutput
            }
        }
        finally {
            Pop-Location
        }
    }
    finally {
        $env:DATABASE_URL = $previousUrl
    }
}

function Get-TableCounts {
    param([string]$Database)
    $names = Invoke-Psql $Database "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version' ORDER BY tablename;"
    $counts = [ordered]@{}
    foreach ($table in ($names -split "`n" | Where-Object { $_ })) {
        if ($table -notmatch '^[a-zA-Z_][a-zA-Z0-9_]*$') {
            throw "Unexpected table name returned from PostgreSQL catalog."
        }
        $counts[$table] = Invoke-Psql $Database "SELECT count(*) FROM public.`"$table`";"
    }
    return $counts
}

try {
    Write-RehearsalLog "Starting synthetic-data backup/restore and migration rollback rehearsal."
    Write-RehearsalLog "Source database: $sourceDatabase; credentials and connection URL are not logged."

    $dumpOutput = & pg_dump @commonArgs -d $sourceDatabase -Fc --no-owner --file $dumpPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed: $($dumpOutput -join ' ')"
    }
    Write-RehearsalLog "Backup created: $dumpPath"

    & createdb @commonArgs -T template0 $restoreDatabase
    if ($LASTEXITCODE -ne 0) {
        throw "Could not create isolated restore database '$restoreDatabase'."
    }
    $restoreOutput = & pg_restore @commonArgs -d $restoreDatabase --exit-on-error --no-owner $dumpPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore failed: $($restoreOutput -join ' ')"
    }
    $sourceCounts = Get-TableCounts $sourceDatabase
    $requiredTables = @("audit_events", "bookings", "favorites", "schedules", "sessions", "tours", "users")
    if (($sourceCounts.Keys -join ",") -ne ($requiredTables -join ",")) {
        throw "Source database does not have the expected seven-table ORM schema."
    }
    if ([int]$sourceCounts["tours"] -lt 1 -or [int]$sourceCounts["schedules"] -lt 1) {
        throw "Seed synthetic tours and schedules before running the backup rehearsal."
    }
    $restoredCounts = Get-TableCounts $restoreDatabase
    if (($sourceCounts | ConvertTo-Json -Compress) -ne ($restoredCounts | ConvertTo-Json -Compress)) {
        throw "Restored table counts do not match the synthetic source database."
    }
    Write-RehearsalLog "Restore verified; table row counts match."

    & createdb @commonArgs -T template0 $rollbackDatabase
    if ($LASTEXITCODE -ne 0) {
        throw "Could not create isolated rollback database '$rollbackDatabase'."
    }
    Invoke-Alembic $rollbackUrl @("upgrade", "head")
    Invoke-Alembic $rollbackUrl @("downgrade", "base")
    Invoke-Alembic $rollbackUrl @("upgrade", "head")
    $revision = Invoke-Psql $rollbackDatabase "SELECT version_num FROM alembic_version;"
    if ($revision -ne "0001_initial") {
        throw "Migration re-apply ended at unexpected revision '$revision'."
    }
    Write-RehearsalLog "Fresh-database upgrade, downgrade, and re-upgrade verified."
    Write-RehearsalLog "PASS. Preserve this log and backup as QA evidence."
}
catch {
    Write-RehearsalLog "FAIL: $($_.Exception.Message)"
    throw
}
finally {
    foreach ($database in @($restoreDatabase, $rollbackDatabase)) {
        & dropdb @commonArgs --if-exists $database 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-RehearsalLog "WARNING: temporary database '$database' could not be removed."
        }
    }
    if ($null -eq $oldPassword) {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    else {
        $env:PGPASSWORD = $oldPassword
    }
}
