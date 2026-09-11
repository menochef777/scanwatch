FROM python:3.10-slim

# Install essential native system libraries required by PaddlePaddle, OpenCV and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip and install pinned compatible PaddlePaddle CPU and PaddleOCR
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    paddlepaddle==2.6.2 \
    paddleocr==2.7.3 \
    fastapi==0.110.0 \
    uvicorn[standard]==0.28.0 \
    python-multipart==0.0.9 \
    Pillow==10.2.0 \
    numpy==1.26.4 \
    opencv-python-headless==4.9.0.80

COPY server.py .

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]


