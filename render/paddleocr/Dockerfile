FROM python:3.10-slim
RUN pip install paddlepaddle paddleocr fastapi uvicorn python-multipart
WORKDIR /app
COPY server.py .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
