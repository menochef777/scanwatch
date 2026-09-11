import requests
import json

def test_render_direct():
    print("--- 1. TESTING RENDER DIRECT /health ---")
    try:
        health_res = requests.get("https://watchdocs-ocr.onrender.com/health", timeout=30)
        print("Health status code:", health_res.status_code)
        print("Health response:", health_res.json())
    except Exception as e:
        print("Health request failed:", e)

    print("\n--- 2. TESTING RENDER DIRECT /ocr ---")
    headers = {
        "X-Internal-Token": "scanwatch-prod-internal-key-9921-secure"
    }
    try:
        with open("test_ocr_sample.png", "rb") as f:
            files = {"file": ("test_ocr_sample.png", f, "image/png")}
            ocr_res = requests.post(
                "https://watchdocs-ocr.onrender.com/ocr",
                headers=headers,
                files=files,
                timeout=60
            )
        print("OCR status code:", ocr_res.status_code)
        print("OCR response body:", ocr_res.text)
        if ocr_res.ok:
            data = ocr_res.json()
            print("\nExtracted text:\n" + data.get("text", ""))
            print(f"Confidence: {data.get('confidence')}")
            print(f"Lines count: {data.get('lines_count')}")
    except Exception as e:
        print("OCR request failed:", e)

if __name__ == "__main__":
    test_render_direct()
