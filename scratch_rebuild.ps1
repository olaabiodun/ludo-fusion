$lines = New-Object System.Collections.Generic.List[string]

function Process-File($path) {
    $content = Get-Content $path
    $started = $false
    foreach ($line in $content) {
        if ($line -match '^\d+:') {
            $started = $true
        }
        if ($started) {
            # Check if line matches line number format
            if ($line -match '^\d+:\s(.*)$') {
                $lines.Add($Matches[1])
            } elseif ($line -match '^\d+:$') {
                $lines.Add("")
            } else {
                # In case there's no space after colon (empty line or specific formatting)
                if ($line -match '^\d+:(.*)$') {
                    $lines.Add($Matches[1])
                }
            }
        }
    }
}

Process-File "C:\Users\HP\ludo\scratch_2056.txt"
Process-File "C:\Users\HP\ludo\scratch_2058.txt"

# Save the lines as a file
$lines | Out-File -FilePath "C:\Users\HP\ludo\scratch_offline_reconstructed.tsx" -Encoding utf8
Write-Output "Reconstructed file with $($lines.Count) lines"
