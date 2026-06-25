# Project PRAGATI - Quick Start

## Prerequisites
- Python 3.10+
- Node.js 18+

## 1. Install Dependencies
```bash
pip install -r requirements.txt
cd project/frontend && npm install && cd ../..
```

## 2. Pre-train Models
Run once; this takes about 60 seconds.

```bash
python -m project.ml.realistic_trainer
python -m project.ml.train_lstm_synthetic
python -m project.ml.crop.pipeline --mode synthetic
```

## 3. Start Backend
```bash
python run.py
# API:  http://localhost:8000
# Docs: http://localhost:8000/docs
```

## 4. Start Frontend
Use a new terminal.

```bash
cd project/frontend && npm run dev
# Dashboard: http://localhost:5173
```

## 5. Run Tests
```bash
pytest tests/ -v
# Expected: 40+ tests passing
```

## GEE Authentication
Optional, for live satellite data.

```bash
earthengine authenticate
cp project/backend/.env.example project/backend/.env
# Edit .env: set GEE_PROJECT=your-gee-project-id
```
