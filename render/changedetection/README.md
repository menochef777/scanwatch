# Instruções de Deploy Manual — changedetection.io no Render.com

Este guia descreve como realizar o deploy do serviço `changedetection.io` no plano gratuito do Render.com para uso interno pelo WatchDocs.

---

## Passo a Passo no Dashboard do Render

1. **Acessar o Render**:
   - Faça login em [https://dashboard.render.com/](https://dashboard.render.com/).

2. **Criar Novo Web Service**:
   - Clique no botão **"New +"** no canto superior direito e selecione **"Web Service"**.
   - Escolha a opção **"Deploy an existing image from a registry or repository"** (ou conecte o repositório público: `https://github.com/dgtlmoon/changedetection.io`).

3. **Configurações do Serviço**:
   - **Name**: `watchdocs-monitor`
   - **Region**: Selecione a região mais próxima (ex: `Oregon (US West)` ou `Ohio (US East)`).
   - **Branch**: `master`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: `Free`

4. **Variáveis de Ambiente (Environment Variables)**:
   Adicione as seguintes variáveis na seção **Environment**:
   - `SALTED_PASS`: Gere uma string randômica ou use o auto-generate do Render.
   - `INTERNAL_SECRET`: Uma chave secreta de autenticação compartilhada (ex: `wd_internal_secret_key_prod_xxxxxx`).
   - `PORT`: `5000` (porta padrão do changedetection.io).

5. **Deploy**:
   - Clique em **"Create Web Service"**.
   - Aguarde o build e a inicialização do container Docker.

6. **Configuração no WatchDocs (Next.js)**:
   - Copie a URL interna/externa fornecida pelo Render (ex: `https://watchdocs-monitor.onrender.com`).
   - No arquivo `.env.local` (ou nas variáveis de ambiente da aplicação Next.js), defina:
     ```env
     CHANGEDETECTION_URL=https://watchdocs-monitor.onrender.com
     CHANGEDETECTION_INTERNAL_SECRET=sua_chave_secreta_aqui
     ```

---

## Comunicação e Segurança

- O serviço é acessado exclusivamente pela API Route `/api/run-monitor` do WatchDocs.
- Toda requisição envia o header `X-Internal-Token: CHANGEDETECTION_INTERNAL_SECRET`.
