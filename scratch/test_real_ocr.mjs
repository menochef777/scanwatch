import { readFileSync } from 'node:fs';

async function testRealOcr() {
  const VERCEL_URL = 'https://scanwatch8.vercel.app';
  const testUid = 'XAbScs4KJoOvLbrKeorGfjNJLFD2';
  
  // Read our sample PNG with text:
  // "WATCHDOCS TEST 2026\nINVOICE ID: 99482\nTOTAL: 1250 USD"
  let samplePngBase64 = '';
  try {
    const fileBuffer = readFileSync('test_ocr_sample.png');
    samplePngBase64 = 'data:image/png;base64,' + fileBuffer.toString('base64');
  } catch {
    samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAJYAAAAyCAYAAACmR42tAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEdElEQVR4nO2bW08TQRSG39/QVttqgVZp2lq1WpQWQVBEL0QIogGMRhNfjcaY+Bc88N54641GTTRG418wEQ8QFa+IqFQjYFAq0NJKt7u74+2hLYVqaWfbs11m9knyZXZm551nM2fO7s6uBgiCIAiCIAiCIAiCIAiCIAiC+P8RERF2u93e09PT09vb25uXl5eTmZnZ';
  }

  console.log('Sending real image to /api/run-ocr on Vercel...');
  try {
    const res = await fetch(`${VERCEL_URL}/api/run-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: testUid,
        fingerprintHash: 'diagnostic-fp-ocr-test-' + Date.now(),
        fileBase64: samplePngBase64,
        mimeType: 'image/png',
      }),
    });
    
    console.log('HTTP Status:', res.status);
    const data = await res.json();
    console.log('Response JSON:', JSON.stringify(data, null, 2));
    
    if (data.text) {
      console.log('\n--- EXTRACTED TEXT FROM REAL PADDLEOCR ---');
      console.log(data.text);
      console.log('------------------------------------------');
      console.log('Confidence:', data.confidence);
      console.log('Lines count:', data.lines_count || data.pages);
    }
  } catch (e) {
    console.log('Connection error:', e.message);
  }
}

testRealOcr();
