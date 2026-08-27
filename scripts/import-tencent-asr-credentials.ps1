param(
    [Parameter(Mandatory = $true)]
    [string]$CsvPath,

    [string]$EnvPath = ".env.local"
)

$ErrorActionPreference = "Stop"
$credentialRows = @(Import-Csv -LiteralPath $CsvPath)
if ($credentialRows.Count -ne 1) {
    throw "密钥 CSV 必须且只能包含一条记录。"
}

$secretId = [string]$credentialRows[0].SecretId
$secretKey = [string]$credentialRows[0].SecretKey
if ([string]::IsNullOrWhiteSpace($secretId) -or [string]::IsNullOrWhiteSpace($secretKey)) {
    throw "密钥 CSV 缺少 SecretId 或 SecretKey。"
}

$resolvedEnvPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $EnvPath))
$envLines = [System.Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath $resolvedEnvPath) {
    foreach ($line in Get-Content -LiteralPath $resolvedEnvPath) {
        $envLines.Add($line)
    }
}

function Set-EnvValue {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [string]$Name,
        [string]$Value
    )

    $replacement = "$Name=$Value"
    for ($index = 0; $index -lt $Lines.Count; $index += 1) {
        if ($Lines[$index] -match "^$([regex]::Escape($Name))=") {
            $Lines[$index] = $replacement
            return
        }
    }
    $Lines.Add($replacement)
}

Set-EnvValue -Lines $envLines -Name "TENCENT_CLOUD_SECRET_ID" -Value $secretId.Trim()
Set-EnvValue -Lines $envLines -Name "TENCENT_CLOUD_SECRET_KEY" -Value $secretKey.Trim()
Set-EnvValue -Lines $envLines -Name "TENCENT_ASR_REGION" -Value "ap-shanghai"
Set-EnvValue -Lines $envLines -Name "TENCENT_ASR_ENGINE_TYPE" -Value "16k_zh"

[System.IO.File]::WriteAllLines(
    $resolvedEnvPath,
    $envLines,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Output "腾讯云语音识别配置已写入 $resolvedEnvPath（密钥值未显示）。"
