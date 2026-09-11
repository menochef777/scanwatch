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
    paddleocr>=2.7.3 \
    fastapi==0.110.0 \
    uvicorn[standard]==0.28.0 \
    python-multipart==0.0.9 \
    Pillow==10.2.0 \
    numpy==1.26.4 \
    opencv-python-headless==4.9.0.80

COPY server.py .

# Pre-download PaddleOCR models during image build to verify engine initialization
RUN python3 -c "import paddle; from paddleocr import PaddleOCR; print('Paddle version:', paddle.__version__); ocr = PaddleOCR(use_angle_cls=True, lang='en'); print('PaddleOCR initialized successfully')"

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
