# System Architecture Blueprint

## Overview
The Multi-Class Vehicle Localization and Automatic License Plate Recognition (ALPR) platform is designed as a modular monolith API backend with asynchronous worker queue boundaries and separate cross-platform clients (Web Studio & Android Native Application).

## High-Level Architecture Diagram
```
                       +-----------------------------------+
                       |        Public / Web Studio        |
                       |       (Next.js + TypeScript)      |
                       +-----------------+-----------------+
                                         |
                                         v
+-----------------------+      +-------------------+      +------------------------+
|  Android Native App   |----->|  FastAPI Backend  |<---->|   PostgreSQL Database  |
| (Kotlin + Jetpack C.) |      |   (Python 3.11)   |      |       (PostgreSQL)     |
+-----------------------+      +---------+---------+      +------------------------+
                                         |
                                         v
                               +-------------------+
                               | Redis Task Queue  |
                               +---------+---------+
                                         |
                                         v
                               +-------------------+
                               |  AI Worker Engine |
                               | (YOLO + OCR Model)|
                               +-------------------+
```

## Architectural Decoupling
1. **Frontend & Mobile Clients**: Rely exclusively on REST API endpoints (`/api/v1/*`).
2. **Backend API**: Enforces authentication, authorization, and standard JSON schemas.
3. **AI Worker Subsystem**: Executes heavy computer vision tasks off the main web looper thread using Redis queues.
