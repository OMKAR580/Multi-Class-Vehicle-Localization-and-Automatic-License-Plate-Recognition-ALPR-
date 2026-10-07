#!/usr/bin/env bash
set -e

echo "Running Backend Unit Tests..."
cd backend && pytest

echo "Running AI Contract Tests..."
cd ../ai && pytest

echo "Running Foundation Verification Script..."
cd .. && python scripts/verify_foundation.py

echo "All tests executed successfully!"
