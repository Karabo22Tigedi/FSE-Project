# Compile the two Group 3 reports to PDF (pdflatex + bibtex).
# Run from anywhere:  powershell -File docs/reports/compile.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Papers = @(
    @{ Dir = Join-Path $Root "spec";      Tex = "business_technical_specification.tex" },
    @{ Dir = Join-Path $Root "rationale"; Tex = "group_rationale.tex" }
)

function Compile-Paper($dir, $tex) {
    Push-Location $dir
    try {
        $job = [System.IO.Path]::GetFileNameWithoutExtension($tex)
        Write-Host "=== Compiling $tex ==="
        pdflatex -interaction=nonstopmode $tex | Out-Null
        if (Test-Path "$job.aux") { bibtex $job | Out-Null }
        pdflatex -interaction=nonstopmode $tex | Out-Null
        pdflatex -interaction=nonstopmode $tex | Out-Null
        if (-not (Test-Path "$job.pdf")) { throw "PDF not produced for $tex" }
        Write-Host "Wrote $dir\$job.pdf"
    }
    finally {
        Pop-Location
    }
}

foreach ($p in $Papers) {
    Compile-Paper $p.Dir $p.Tex
}
