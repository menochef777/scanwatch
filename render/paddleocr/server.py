import os
import io
import base64
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, UploadFile, File
from pydantic import BaseModel

app = FastAPI(title="WatchDocs PaddleOCR Microservice", version="1.0.0")

INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "dev_secret")
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

class Base64OcrRequest(BaseModel):
    base64: Optional[str] = None
    mimeType: Optional[str] = "image/png"

# Lazy-loaded PaddleOCR engine instance
ocr_engine = None

def get_ocr_engine():
    global ocr_engine
    if ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            ocr_engine = PaddleOCR(use_angle_cls=True, lang='en')
        except Exception as e:
            print(f"Warning: PaddleOCR model failed to load in local environment, falling back to mock engine: {e}")
            ocr_engine = "mock"
    return ocr_engine

@app.get("/health")
def health():
    return {"status": "ok", "service": "paddleocr-microservice"}

@app.post("/ocr")
async def extract_text(
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
    payload: Optional[Base64OcrRequest] = None,
    file: Optional[UploadFile] = File(None),
):
    # 1. Authenticate internal caller
    if not x_internal_token or x_internal_token != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing X-Internal-Token")

    file_bytes = b""
    detected_mime = ""

    # 2. Extract content from either multipart upload or JSON base64
    if file:
        detected_mime = file.content_type or ""
        file_bytes = await file.read()
    elif payload and payload.base64:
        detected_mime = payload.mimeType or "image/png"
        try:
            clean_b64 = payload.base64.split(",")[-1]
            file_bytes = base64.b64decode(clean_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Malformed base64 file data")
    else:
        raise HTTPException(status_code=400, detail="Missing file payload (upload or base64)")

    # 3. Validate MIME type
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported media type '{detected_mime}'. Only image/jpeg, image/png, and application/pdf are accepted."
        )

    # 4. Validate size limit (5MB)
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 5MB (Received: {len(file_bytes)} bytes)"
        )

    # 5. Process OCR
    engine = get_ocr_engine()
    
    if engine == "mock" or engine is None:
        raise HTTPException(
            status_code=503,
            detail="PaddleOCR engine is not initialized or failed to load dependencies on this host."
        )

    try:
        import numpy as np
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes)).convert('RGB')
        img_np = np.array(img)
        result = engine.ocr(img_np, cls=True)
        
        extracted_lines = []
        confidences = []
        if result and result[0]:
            for line in result[0]:
                extracted_lines.append(line[1][0])
                confidences.append(float(line[1][1]))
        
        full_text = "\n".join(extracted_lines)
        avg_conf = sum(confidences) / len(confidences) if confidences else None
        return {
            "text": full_text or "No text recognized in document.",
            "confidence": round(avg_conf, 4) if avg_conf is not None else None,
            "pages": 1
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PaddleOCR execution error: {str(e)}")
