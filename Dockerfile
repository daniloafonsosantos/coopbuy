FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-por \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN echo "install-v3-no-strands" && pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY reprocess_receipt.py .
RUN mkdir -p uploads
# cache bust: 2026-04-08

EXPOSE 8000

ENTRYPOINT ["python", "-m", "app.main"]
