# WatchDocs SaaS — SKILL.md

## O que é este projeto
SaaS em inglês, cobrado em USD, que oferece duas funções:
- Monitorar uma URL e alertar quando mudar
- Digitalizar documento (PDF ou imagem) e extrair texto estruturado

Cada usuário tem direito a 1 trial gratuito por função (1 monitor + 1 OCR),
protegido por três camadas anti-burla: IP hash, device fingerprint e email verificado.
Sem CPF. Sem telefone. Sem página de pagamento nesta fase.

## Stack obrigatória
- Next.js 14 com App Router
- Firebase App Hosting (Antigravity)
- Firebase Auth — somente email/password com verificação obrigatória
- Firestore — regras de segurança no servidor
- Cloud Functions (Node.js 20) — toda lógica de negócio fica aqui
- Cloud Run — changedetection.io e PaddleOCR rodam aqui, sem exposição pública
- FingerprintJS (free tier) — fingerprint no cliente, hash SHA-256 enviado ao servidor
- Tailwind CSS — dark mode por padrão, sem biblioteca de componentes

## Repositórios dos serviços
- changedetection.io: https://github.com/dgtlmoon/changedetection.io
- PaddleOCR: https://github.com/PaddlePaddle/PaddleOCR

Ambos devem ser clonados e implantados como serviços Cloud Run separados.
Nenhum deve ter URL pública — só acessíveis internamente via service account.

## Estrutura de arquivos esperada

/
├── app/ → Next.js App Router
│ ├── page.tsx → página única com duas abas
│ ├── api/
│ │ ├── check-trial/route.ts
│ │ ├── run-monitor/route.ts
│ │ └── run-ocr/route.ts
├── functions/ → Cloud Functions
│ ├── checkTrial.ts
│ ├── runMonitor.ts
│ └── runOcr.ts
├── lib/
│ ├── firebase.ts → init client
│ ├── firebaseAdmin.ts → init server
│ ├── hashIp.ts → SHA-256 do IP
│ └── blockedEmailDomains.ts → lista de domínios descartáveis
├── skills/
│ └── saas-watchdocs/
│ └── SKILL.md → este arquivo
└── firestore.rules


## Estrutura do Firestore

users/{uid}
trialMonitorUsed: boolean (default false)
trialOCRUsed: boolean (default false)
plan: "free" | "basic" | "pro"
createdAt: timestamp

ips/{sha256_do_ip}
uid: string
usedAt: timestamp

fingerprints/{sha256_do_fp}
uid: string
usedAt: timestamp


## Regras de segurança — não negociáveis
1. Toda validação de trial roda em Cloud Function — NUNCA no cliente
2. Firestore Rules: usuário lê/escreve só users/{uid} próprio
3. Coleções ips/ e fingerprints/ são write-only pelo servidor (service account)
4. Cloud Run não tem URL pública
5. IP capturado no servidor via header x-forwarded-for — nunca enviado pelo cliente
6. Fingerprint gerado no cliente via FingerprintJS, enviado como hash SHA-256

## Workflow obrigatório — siga esta ordem sem pular etapas

### Etapa 1 — Fundação (não escreva frontend ainda)
- [ ] Inicializar projeto Next.js 14 com App Router e Tailwind
- [ ] Configurar Firebase Admin SDK
- [ ] Criar lib/hashIp.ts e lib/blockedEmailDomains.ts
- [ ] Criar firestore.rules com as permissões descritas acima
- [ ] Testar regras no emulador antes de continuar

### Etapa 2 — Cloud Function: checkTrial
- [ ] Recebe: { uid, fingerprintHash } via POST autenticado
- [ ] Captura IP do header no servidor
- [ ] Consulta Firestore em paralelo: users/{uid}, ips/{ip_hash}, fingerprints/{fp_hash}
- [ ] Se qualquer um já existir → retorna { allowed: false, reason: "trial_used" }
- [ ] Se nenhum existir → grava os três em transaction atômica → retorna { allowed: true }
- [ ] Testar com três cenários: primeiro uso, IP repetido, fingerprint repetido

### Etapa 3 — Cloud Run: changedetection.io
- [ ] Clonar repositório
- [ ] Criar Dockerfile se não existir
- [ ] Deploy no Cloud Run sem URL pública
- [ ] Criar service account com permissão de invoke
- [ ] Testar chamada interna a partir de Cloud Function

### Etapa 4 — Cloud Function: runMonitor
- [ ] Chama checkTrial antes de qualquer ação
- [ ] Se allowed: false → retorna erro imediatamente
- [ ] Recebe URL do usuário
- [ ] Chama changedetection.io via HTTP interno com service account
- [ ] Retorna snapshot inicial + agenda segundo snapshot em 24h via Cloud Tasks
- [ ] Após sucesso: marca users/{uid}.trialMonitorUsed = true

### Etapa 5 — Cloud Run: PaddleOCR
- [ ] Mesma estrutura do Etapa 3
- [ ] Expõe endpoint POST /ocr que recebe imagem base64 e retorna JSON com texto

### Etapa 6 — Cloud Function: runOCR
- [ ] Mesma estrutura do runMonitor
- [ ] Recebe arquivo via Firebase Storage (usuário faz upload direto, função processa)
- [ ] Chama PaddleOCR via HTTP interno
- [ ] Retorna JSON com texto extraído
- [ ] Após sucesso: marca users/{uid}.trialOCRUsed = true

### Etapa 7 — Auth no frontend
- [ ] Firebase Auth com email/password
- [ ] Verificação de email obrigatória antes de liberar qualquer função
- [ ] Bloquear domínios descartáveis na criação da conta (lib/blockedEmailDomains.ts)
- [ ] FingerprintJS inicializado aqui — hash gerado e armazenado no estado global

### Etapa 8 — Frontend: página única
- [ ] Dark mode por padrão, Tailwind puro
- [ ] Duas abas: "Monitor URL" e "Scan Document"
- [ ] Aba Monitor: campo de URL, botão, área de resultado com diff em texto
- [ ] Aba Scan: upload de arquivo, botão, área de resultado com texto extraído
- [ ] Antes de qualquer ação: chama checkTrial com uid + fingerprintHash
- [ ] Se trial usado: mostra card "Upgrade to continue" com preços ($19/mês, $49/mês)
  e botão que abre mailto: ou formulário de waitlist simples
- [ ] Se trial disponível: executa a ação e mostra resultado

### Etapa 9 — Revisão final
- [ ] Confirmar que nenhuma lógica de trial está no cliente
- [ ] Confirmar que Cloud Run não tem URL pública
- [ ] Confirmar que regras do Firestore estão corretas
- [ ] Rodar emulador completo com os três cenários de trial

## O que NÃO fazer
- Não criar página de preços ou pagamento
- Não pedir CPF ou telefone
- Não colocar validação de trial no frontend
- Não expor Cloud Run publicamente
- Não pular etapas do workflow — cada etapa valida a anterior
- Não usar biblioteca de componentes (shadcn, MUI, etc) — Tailwind puro

## Definição de pronto
O projeto está pronto quando:
1. Um novo usuário consegue usar monitor + OCR uma vez
2. A segunda tentativa do mesmo usuário (mesmo device, IP ou email) é bloqueada
3. Trocar de aba anônima não burla o bloqueio
4. O código de validação não existe no bundle do cliente
