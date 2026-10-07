# Standard AI Output Interface Contract

This contract defines the unified JSON payload format returned by the AI subsystem and consumed by Web Studio, Android App, Backend API, and Database.

```json
{
  "image_id": "example_image_001",
  "vehicles": [
    {
      "type": "car",
      "confidence": 0.94,
      "bbox": [120, 80, 540, 420],
      "plate": {
        "text": "RJ14AB1234",
        "confidence": 0.91,
        "bbox": [230, 350, 410, 395]
      }
    }
  ]
}
```

## Schema Field Descriptions
- `image_id` (string, required): Unique identifier for processed media frame.
- `vehicles` (array): List of localized vehicle objects.
  - `type` (string): Vehicle class (`car`, `truck`, `bus`, `motorbike`).
  - `confidence` (float, 0.0 - 1.0): Bounding box localization confidence score.
  - `bbox` (array of 4 ints): `[xmin, ymin, xmax, ymax]` pixel coordinates.
  - `plate` (object, optional): Extracted license plate object.
    - `text` (string): Cleaned alphanumeric license plate string.
    - `confidence` (float, 0.0 - 1.0): OCR character confidence score.
    - `bbox` (array of 4 ints): `[xmin, ymin, xmax, ymax]` relative coordinates.
