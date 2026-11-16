param([string]$RagRoot = 'D:\rag-phu-san-chatbot')
$ErrorActionPreference = 'Stop'
$python = Join-Path $RagRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw "Missing Python environment: $python" }
if (-not (Test-Path -LiteralPath (Join-Path $RagRoot 'web_app.py'))) { throw 'Missing web_app.py' }
if (Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue) {
    $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 5
    if ($health.conversationApiVersion -eq 1) { Write-Output 'RAG conversation API is already running on port 8000.'; exit 0 }
    throw 'Port 8000 is occupied by another service.'
}
$collections = Invoke-RestMethod 'http://127.0.0.1:6333/collections' -TimeoutSec 5
if ('chunks' -notin $collections.result.collections.name) { throw 'Qdrant is missing the chunks collection.' }
$models = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
if ('qwen2.5:3b' -notin $models.models.name) { throw 'Ollama is missing qwen2.5:3b.' }
$runtimeDirectory = Join-Path $RagRoot 'data\private'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$process = Start-Process -FilePath $python -ArgumentList @('-u', 'web_app.py') -WorkingDirectory $RagRoot `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $runtimeDirectory 'api.stdout.log') `
    -RedirectStandardError (Join-Path $runtimeDirectory 'api.stderr.log')
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $ready = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2
        if ($ready.conversationApiVersion -eq 1) {
            Write-Output "Started local RAG API (launcher PID $($process.Id)). Health: http://localhost:8000/api/health"
            exit 0
        }
    } catch { }
    if ($process.HasExited) { throw "RAG API exited. Check logs in $runtimeDirectory" }
    Start-Sleep -Milliseconds 500
}
throw "RAG API did not become ready. Check logs in $runtimeDirectory"
