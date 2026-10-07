# PowerShell Dev Setup Script
Write-Host "Setting up local development environment for ALPR Platform..."

if (-not (Test-Path .env)) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item .env.example .env
}

Write-Host "Installing backend & AI dependencies..."
pip install -r backend/requirements.txt
pip install -r ai/requirements.txt

Write-Host "Environment setup complete!"
