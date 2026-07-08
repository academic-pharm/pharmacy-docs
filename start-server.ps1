$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$http = [System.Net.HttpListener]::new()
$http.Prefixes.Add('http://localhost:8080/')
$http.Start()
Write-Host "Server running at http://localhost:8080/" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
while ($http.IsListening) {
    $ctx = $http.GetContext()
    $path = $ctx.Request.Url.LocalPath.TrimStart('/')
    if (-not $path) { $path = 'academic-form-system.html' }
    $file = Join-Path $root $path
    if (Test-Path $file -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $ctx.Response.ContentType = switch ($ext) {
            '.html' { 'text/html; charset=utf-8' }
            '.js'   { 'application/javascript' }
            '.css'  { 'text/css' }
            '.png'  { 'image/png' }
            '.jpg'  { 'image/jpeg' }
            default { 'application/octet-stream' }
        }
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
    }
    $ctx.Response.OutputStream.Close()
}
