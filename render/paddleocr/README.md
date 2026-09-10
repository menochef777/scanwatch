# Instruções de Deploy Manual — PaddleOCR no Render.com

Este guia descreve como realizar o deploy do serviço `PaddleOCR` (FastAPI) no Render.com.

---

## Passo a Passo no Dashboard do Render

1. **Acessar o Render**:
   - Faça login em [https://dashboard.render.com/](https://dashboard.render.com/).

2. **Criar Novo Web Service**:
   - Clique em **"New +"** no canto superior direito e selecione **"Web Service"**.
   - Conecte o repositório do projeto ou faça deploy a partir da pasta `render/paddleocr`.

3. **Configurações do Serviço**:
   - **Name**: `watchdocs-ocr`
   - **Region**: Selecione a região padrão (ex: `Oregon (US West)` ou `Ohio (US East)`).
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `render/paddleocr/Dockerfile` (ou `./Dockerfile` no diretório da build).
   - **Instance Type**: `Free` ou Starter.

4. **Variáveis de Ambiente (Environment Variables)**:
   - `INTERNAL_SECRET`: A mesma chave secreta compartilhada configurada no Next.js (ex: `wd_internal_secret_key_prod_xxxxxx`).
   - `PORT`: `8000`

5. **Deploy**:
   - Clique em **"Create Web Service"**.
   - O Docker construirá a imagem Python 3.10 instalando `paddlepaddle`, `paddleocr`, `fastapi`, `uvicorn` e executará o `server.py`.

6. **Configuração no WatchDocs (Next.js)**:
   - Adicione no `.env.local` / ambiente de produção:
     ```env
     PADDLEOCR_URL=https://watchdocs-ocr.onrender.com
     PADDLEOCR_INTERNAL_SECRET=sua_chave_secreta_aqui
     ```

---

## Especificação da API Interna

- **Endpoint**: `POST /ocr`
- **Headers**:
  - `X-Internal-Token`: `<INTERNAL_SECRET>` (Obrigatório — 401 Unauthorized se inválido/ausente)
  - `Content-Type`: `application/json` ou `multipart/form-data`
- **Formatos aceitos**: `image/jpeg`, `image/png`, `application/pdf`
- **Limite de tamanho**: 5MB
- **Resposta**:
  ```json
  {
    "text": "Extracted document text...",
    "confidence": 0.985,
    "pages": 1
  }
  ```
