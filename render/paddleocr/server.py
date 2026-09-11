import os
import io
import time
import threading
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, UploadFile, File
import numpy as np
from PIL import Image

app = FastAPI(title="WatchDocs PaddleOCR Microservice", version="1.0.0")

INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "dev_secret")
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

ocr_engine = None
init_error = None
is_initializing = False
paddle_version = "2.6.2"
init_lock = threading.Lock()

def initialize_engine_background():
    global ocr_engine, init_error, is_initializing, paddle_version
    with init_lock:
        if ocr_engine is not None:
            return
        is_initializing = True
        try:
            # Small pause to guarantee Uvicorn has bound to socket and Render port scan succeeds
            time.sleep(1.0)
            
            print("[PaddleOCR] Starting background import and initialization of PaddleOCR...")
            import paddle
            paddle_version = getattr(paddle, "__version__", "2.6.2")
            from paddleocr import PaddleOCR
            
            print(f"[PaddleOCR] Loading PaddleOCR engine (PaddlePaddle version: {paddle_version})...")
            # Use lightweight CPU config with 1280 limit to guarantee stable memory within 512MB RAM
            engine_instance = PaddleOCR(
                use_angle_cls=False,
                lang="en",
                enable_mkldnn=False,
                show_log=False,
                det_limit_side_len=1280
            )
            
            ocr_engine = engine_instance
            init_error = None
            print("[PaddleOCR] Engine initialized successfully.")
        except Exception as e:
            init_error = str(e)
            ocr_engine = None
            print(f"[PaddleOCR ERROR] Failed to initialize PaddleOCR engine: {e}")
        finally:
            is_initializing = False

@app.on_event("startup")
def startup_event():
    # Trigger background worker thread so Uvicorn starts listening on the port immediately
    worker = threading.Thread(target=initialize_engine_background, daemon=True, name="paddleocr-init-worker")
    worker.start()

@app.get("/health")
def health():
    if ocr_engine is not None:
        return {
            "status": "ok",
            "service": "paddleocr-microservice",
            "paddle_version": paddle_version,
            "engine_ready": True,
            "is_initializing": False,
            "init_error": None,
        }
    elif is_initializing or init_error is None:
        return {
            "status": "initializing",
            "service": "paddleocr-microservice",
            "paddle_version": paddle_version,
            "engine_ready": False,
            "is_initializing": True,
            "init_error": None,
        }
    else:
        return {
            "status": "error",
            "service": "paddleocr-microservice",
            "paddle_version": paddle_version,
            "engine_ready": False,
            "is_initializing": False,
            "init_error": init_error,
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
        if is_initializing or init_error is None:
            raise HTTPException(
                status_code=503,
                detail="PaddleOCR engine is still initializing. Please retry in a few seconds."
            )
        else:
            raise HTTPException(
                status_code=503,
                detail=f"PaddleOCR engine failed to initialize: {init_error}"
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
        
        # Proportional resize if max side > 1280 to preserve memory under 512MB RAM
        width, height = image.size
        max_side = max(width, height)
        if max_side > 1280:
            scale = 1280.0 / float(max_side)
            new_width = max(1, int(width * scale))
            new_height = max(1, int(height * scale))
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        image_np = np.array(image)
        
        result = ocr_engine.ocr(image_np, cls=False)

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
