FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Copy the entire project into /app
COPY . /app

# Set PYTHONPATH so ml/, gee/, and backend/ are importable as top-level packages
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Run FastAPI with 2 workers for better throughput
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
