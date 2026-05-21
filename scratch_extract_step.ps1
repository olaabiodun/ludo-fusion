$content = Get-Content "C:\Users\HP\.gemini\antigravity\brain\faaba39d-df75-41cb-875f-2ee44ef2ad38\.system_generated\logs\transcript.jsonl"
foreach ($line in $content) {
    if ($line -match '"step_index":2036') {
        $json = ConvertFrom-Json $line
        # Find the tool call for write_to_file
        foreach ($tool in $json.tool_calls) {
            if ($tool.name -eq "write_to_file") {
                $code = $tool.args.CodeContent
                $code | Out-File -FilePath "C:\Users\HP\ludo\scratch_step_2036_code.tsx" -Encoding utf8
                Write-Output "Extracted step 2036 code to scratch_step_2036_code.tsx. Code length: $($code.Length) characters."
            }
        }
    }
}
