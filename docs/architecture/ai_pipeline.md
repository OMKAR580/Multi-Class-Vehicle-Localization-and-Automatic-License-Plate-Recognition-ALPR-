# AI Pipeline Architecture

## Sequential Pipeline Flow
```
Input Media (Image/Video)
    │
    ▼
Input Validation & Resizing
    │
    ▼
Vehicle Localization (YOLOv8 Multi-Class: Car, Truck, Bus, Motorbike)
    │
    ▼
License Plate Region Detection (YOLO ROI Extractor)
    │
    ▼
License Plate Cropping & Perspective Correction
    │
    ▼
Image Preprocessing (Grayscale, Adaptive Binarization)
    │
    ▼
Optical Character Recognition (OCR Engine tuned for Indian Formats)
    │
    ▼
Postprocessing & State Code Regex Validation
    │
    ▼
Confidence Scoring
    │
    ▼
Standardized JSON Result Contract
```
