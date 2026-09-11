import os
import io
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, UploadFile, File
import paddle
from paddleocr import PaddleOCR
import numpy as np
from PIL import Image

app = FastAPI(title="WatchDocs PaddleOCR Microservice", version="1.0.0")

INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "dev_secret")
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Initialize PaddleOCR engine at module startup
try:
    ocr_engine = PaddleOCR(use_angle_cls=True, lang="en")
    print(f"[PaddleOCR] Engine initialized successfully. PaddlePaddle version: {paddle.__version__}")
except Exception as e:
    print(f"[PaddleOCR ERROR] Failed to initialize PaddleOCR engine: {e}")
    ocr_engine = None

@app.get("/health")
def health():
    return {
        "status": "ok" if ocr_engine is not None else "error",
        "service": "paddleocr-microservice",
        "paddle_version": paddle.__version__,
        "engine_ready": ocr_engine is not None,
    }

@app.post("/ocr")
async def extract_text(
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
    file: Optional[UploadFile] = File(None),
):
    # 1. Authenticate internal caller
    if not x_internal_token or x_internal_token != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing X-Internal-Token")

    # 2. Check engine readiness
    if ocr_engine is None:
        raise HTTPException(
            status_code=503,
            detail="PaddleOCR engine failed to initialize on startup."
        )

    # 3. Validate file upload
    if not file:
        raise HTTPException(status_code=400, detail="Missing file in multipart upload")

    detected_mime = (file.content_type or "").lower()
    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 5MB (Received: {len(file_bytes)} bytes)"
        )

    # 4. Process OCR with real PaddleOCR engine
    try:
        image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        image_np = np.array(image)
        
        result = ocr_engine.ocr(image_np, cls=True)

        extracted_lines = []
        confidences = []

        if result and len(result) > 0 and result[0] is not None:
            for line in result[0]:
                if len(line) >= 2 and len(line[1]) >= 2:
                    text_str = line[1][0]
                    conf_val = float(line[1][1])
                    extracted_lines.append(text_str)
                    confidences.append(conf_val)

        full_text = "\n".join(extracted_lines)
        avg_confidence = round(sum(confidences) / len(confidences), 4) if confidences else None

        return {
            "text": full_text if full_text else "No text detected in document.",
            "confidence": avg_confidence,
            "lines_count": len(extracted_lines),
            "pages": 1,
        }
    except Exception as e:
        print(f"[PaddleOCR Process Error]: {e}")
        raise HTTPException(status_code=500, detail=f"PaddleOCR execution error: {str(e)}")
