$content = Get-Content "C:\Users\HP\.gemini\antigravity\brain\faaba39d-df75-41cb-875f-2ee44ef2ad38\.system_generated\logs\transcript.jsonl"
foreach ($line in $content) {
    if ($line -match '"step_index":(\d+)') {
        $step = $Matches[1]
        if ($line -match 'write_to_file' -and $line -match 'offline\.tsx') {
            Write-Output "Step $step is write_to_file of offline.tsx"
        }
    }
}
