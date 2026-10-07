# Model Weights Directory

This directory stores trained model checkpoints (`.pt`, `.onnx`, `.engine`, `.safetensors`).

> **IMPORTANT SECURITY & REPOSITORY POLICY:**
> - Large weight binaries MUST NOT be committed to git.
> - The `.gitignore` at the repository root ignores `ai/models/*.pt`, `*.onnx`, `*.engine`.
> - Model weights should be downloaded during setup using release scripts or hosted on cloud storage buckets.
