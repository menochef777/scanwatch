# WatchDocs SaaS — Production Deployment Guide

Follow these steps in exact sequential order to deploy WatchDocs to production.

---

## Step 1 — Firebase Setup

1. **Create Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
   - Name your project (e.g. `watchdocs-prod`) and complete the creation (Google Analytics optional).

2. **Enable Authentication**:
   - Navigate to **Build > Authentication** and click **Get Started**.
   - Under the **Sign-in method** tab, enable **Email/Password** (keep "Email link (passwordless sign-in)" disabled).

3. **Enable Cloud Firestore**:
   - Navigate to **Build > Firestore Database** and click **Create Database**.
   - Select **Production mode**.
   - Choose location (recommended: `us-east1` or closest to your users).

4. **Generate Service Account Key**:
   - Go to **Project Settings (Gear Icon) > Service accounts**.
   - Click **Generate new private key** and download the JSON file.
   - Extract `private_key` and `client_email` for your production environment variables.

5. **Publish Firestore Security Rules**:
   - Navigate to **Firestore Database > Rules** tab.
   - Paste the contents of [firestore.rules](firestore.rules) and click **Publish**.

---

## Step 2 — Render.com: changedetection.io

1. **Create Web Service**:
   - Log in to [Render Dashboard](https://dashboard.render.com/) and click **New + > Web Service**.
   - Connect the public repository: `https://github.com/dgtlmoon/changedetection.io`.

2. **Configure Settings**:
   - **Name**: `watchdocs-monitor`
   - **Runtime**: `Docker`
   - **DockerfilePath**: `./Dockerfile`
   - **Plan**: `Free`

3. **Set Environment Variables**:
   - `INTERNAL_SECRET`: Generate a secure random string (e.g. `wd_sec_xxxxxxxxxxxx`).
   - `SALTED_PASS`: Set any strong random passphrase.

4. **Save URL**:
   - Click **Create Web Service** and copy the resulting URL (e.g. `https://watchdocs-monitor.onrender.com`).

---

## Step 3 — Render.com: PaddleOCR

1. **Create Web Service**:
   - In Render Dashboard, click **New + > Web Service**.
   - Connect your WatchDocs repository and specify the subfolder `render/paddleocr` as the root directory.

2. **Configure Settings**:
   - **Name**: `watchdocs-ocr`
   - **Runtime**: `Docker`
   - **DockerfilePath**: `Dockerfile`
   - **Plan**: `Free`

3. **Set Environment Variables**:
   - `INTERNAL_SECRET`: Paste the **exact same** secret string generated in Step 2.
   - `PORT`: `8000`

4. **Save URL**:
   - Click **Create Web Service** and copy the resulting URL (e.g. `https://watchdocs-ocr.onrender.com`).

---

## Step 4 — Vercel Deploy

1. **Import Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New > Project**.
   - Import your GitHub repository (`scanwatch`).
   - Framework Preset: `Next.js`.

2. **Configure Environment Variables**:
   Add the variables listed in `.env.example`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase Web API Key.
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: `your-project.firebaseapp.com`.
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: `your-firebase-project-id`.
   - `FIREBASE_ADMIN_PRIVATE_KEY`: Your extracted private key string (with `\n` line breaks).
   - `FIREBASE_ADMIN_CLIENT_EMAIL`: Your service account email.
   - `CHANGEDETECTION_URL`: URL from Step 2.
   - `CHANGEDETECTION_INTERNAL_TOKEN`: Shared secret from Step 2.
   - `PADDLEOCR_URL`: URL from Step 3.
   - `PADDLEOCR_INTERNAL_TOKEN`: Shared secret from Step 2/3.
   - `NEXT_PUBLIC_FINGERPRINT_API_KEY`: Optional public token or default.

3. **Deploy**:
   - Click **Deploy**. Vercel will build and deploy the Next.js App Router project to production.

---

## Step 5 — Smoke Test

1. **Access Live App**: Open your live Vercel production URL in a browser.
2. **Account Creation**: Click **Sign Up** and register with a real email address (e.g. `yourname@gmail.com`). Verify that disposable emails are immediately rejected.
3. **Email Verification**: Open your inbox, click the Firebase verification link, and then **Sign In**.
4. **Test Monitor URL**: In the "Monitor URL" tab, enter `https://example.com` and click **Monitor this page**. Verify that the initial text snapshot appears.
5. **Test Document OCR**: In the "Scan Document" tab, upload a sample PNG image or PDF and click **Extract Text**. Verify that the text is extracted.
6. **Test Anti-Bypass Protection**: Attempt to run a second monitor or OCR request. Verify that the **Upgrade — $19/mo** card appears immediately and blocks further trial consumption.
