// Audit script for real live services
const CHANGEDETECTION_URL = 'https://watchdocs-monitor.onrender.com';
const PADDLEOCR_URL = 'https://watchdocs-ocr.onrender.com';

async function auditChangedetection() {
  console.log('\n--- AUDITORIA: CHANGEDETECTION.IO ---');
  
  // Teste 1: GET /api/v1/systeminfo (sem header e com vários possíveis headers)
  console.log('\n[TESTE 1] GET /api/v1/systeminfo');
  try {
    const resNoAuth = await fetch(`${CHANGEDETECTION_URL}/api/v1/systeminfo`);
    console.log('Sem auth - Status:', resNoAuth.status);
    const textNoAuth = await resNoAuth.text();
    console.log('Sem auth - Body:', textNoAuth.substring(0, 300));
  } catch (e) {
    console.log('Erro de rede:', e.message);
  }

  // Teste 2: POST /api/v1/watch (sem chave ou com chaves padrão)
  console.log('\n[TESTE 2] POST /api/v1/watch');
  try {
    const resWatch = await fetch(`${CHANGEDETECTION_URL}/api/v1/watch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com',
      }),
    });
    console.log('Watch sem chave - Status:', resWatch.status);
    const textWatch = await resWatch.text();
    console.log('Watch sem chave - Body:', textWatch.substring(0, 300));
  } catch (e) {
    console.log('Erro de rede:', e.message);
  }
}

async function auditPaddleOCR() {
  console.log('\n--- AUDITORIA: PADDLEOCR ---');
  
  // Teste 1: GET /health
  console.log('\n[TESTE 1] GET /health');
  try {
    const resHealth = await fetch(`${PADDLEOCR_URL}/health`);
    console.log('Health - Status:', resHealth.status);
    const textHealth = await resHealth.text();
    console.log('Health - Body:', textHealth);
  } catch (e) {
    console.log('Erro de rede:', e.message);
  }

  // Teste 2: POST /ocr com imagem real simples (1x1 PNG transparente ou pequeno PNG)
  console.log('\n[TESTE 2] POST /ocr (multipart upload)');
  try {
    // 1x1 black PNG
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(pngBase64, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'sample.png');

    const resOcr = await fetch(`${PADDLEOCR_URL}/ocr`, {
      method: 'POST',
      headers: {
        'X-Internal-Token': 'dev_secret',
      },
      body: formData,
    });
    console.log('OCR POST - Status:', resOcr.status);
    const textOcr = await resOcr.text();
    console.log('OCR POST - Body:', textOcr);
  } catch (e) {
    console.log('Erro de rede:', e.message);
  }
}

async function run() {
  await auditChangedetection();
  await auditPaddleOCR();
}

run();
