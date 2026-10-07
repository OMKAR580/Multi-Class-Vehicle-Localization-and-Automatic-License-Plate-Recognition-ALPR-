#!/usr/bin/env bash
set -e

echo "Setting up local development environment for ALPR Platform..."

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

echo "Installing backend dependencies..."
pip install -r backend/requirements.txt

echo "Installing AI module dependencies..."
pip install -r ai/requirements.txt

echo "Environment setup complete!"
