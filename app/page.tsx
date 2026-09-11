'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Globe, 
  FileText, 
  UploadCloud, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  LogOut, 
  Lock, 
  Mail, 
  Key, 
  ExternalLink,
  Zap,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

export default function HomePage() {
  const { user, loading: authLoading, fingerprintHash, signUp, signIn, signOut } = useAuth();

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'monitor' | 'ocr'>('monitor');

  // Monitor URL State
  const [monitorUrl, setMonitorUrl] = useState('');
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorResult, setMonitorResult] = useState<{
    success?: boolean;
    snapshot?: string;
    watchId?: string;
    message?: string;
    url?: string;
    checkedAt?: string;
  } | null>(null);
  const [monitorTrialUsed, setMonitorTrialUsed] = useState(false);
  const [monitorError, setMonitorError] = useState('');

  // Scan Document State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    success?: boolean;
    text?: string;
    confidence?: number;
    pages?: number;
  } | null>(null);
  const [ocrTrialUsed, setOcrTrialUsed] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    setAuthSubmitting(true);

    try {
      if (authMode === 'signup') {
        await signUp(authEmail, authPassword);
        setAuthSuccessMsg('Account created! Please check your email inbox to verify your account before signing in.');
        setAuthEmail('');
        setAuthPassword('');
      } else {
        await signIn(authEmail, authPassword);
        setAuthModalOpen(false);
        setAuthEmail('');
        setAuthPassword('');
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const openAuthModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setAuthError('');
    setAuthSuccessMsg('');
    setAuthModalOpen(true);
  };

  // Monitor URL Handler
  const handleRunMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) {
      setMonitorError('Please sign in with a verified account first.');
      return;
    }
    if (!monitorUrl.trim()) return;

    setMonitorLoading(true);
    setMonitorError('');
    setMonitorResult(null);
    setMonitorTrialUsed(false);

    try {
      const response = await fetch('/api/run-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          fingerprintHash,
          url: monitorUrl.trim(),
        }),
      });

      const data = await response.json();

      if (response.status === 403 || data.reason === 'trial_used') {
        setMonitorTrialUsed(true);
      } else if (!response.ok) {
        setMonitorError(data.error || 'Failed to initialize page monitoring.');
      } else {
        setMonitorResult(data);
      }
    } catch (err: any) {
      setMonitorError('Network error connecting to monitoring service.');
    } finally {
      setMonitorLoading(false);
    }
  };

  // File Upload Helper
  const processFile = (file: File) => {
    setOcrError('');
    setOcrResult(null);
    setOcrTrialUsed(false);

    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimes.includes(file.type)) {
      setOcrError('Unsupported format. Please upload JPEG, PNG, or PDF files.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setOcrError('File exceeds maximum size of 5MB.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setFileBase64(b64);
    };
    reader.onerror = () => {
      setOcrError('Failed to read file from disk.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // OCR Handler
  const handleRunOcr = async () => {
    if (!user || !user.emailVerified) {
      setOcrError('Please sign in with a verified account first.');
      return;
    }
    if (!fileBase64 || !selectedFile) {
      setOcrError('Please select a file to extract.');
      return;
    }

    setOcrLoading(true);
    setOcrError('');
    setOcrResult(null);
    setOcrTrialUsed(false);

    try {
      const response = await fetch('/api/run-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          fingerprintHash,
          fileBase64,
          mimeType: selectedFile.type,
        }),
      });

      const data = await response.json();

      if (response.status === 403 || data.reason === 'trial_used') {
        setOcrTrialUsed(true);
      } else if (!response.ok) {
        setOcrError(data.error || 'Failed to extract text from document.');
      } else {
        setOcrResult(data);
      }
    } catch (err: any) {
      setOcrError('Network error connecting to OCR service.');
    } finally {
      setOcrLoading(false);
    }
  };

  const isAuthenticatedAndVerified = user && user.emailVerified;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* SEÇÃO 1: HEADER */}
      <header className="border-b border-slate-800 bg-[#0f172a]/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Watch<span className="text-indigo-400">Docs</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {authLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : isAuthenticatedAndVerified ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-slate-400 block">Signed in as</span>
                  <span className="text-sm font-medium text-slate-200">{user?.email}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => openAuthModal('signin')}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuthModal('signup')}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-center">
        {/* SEÇÃO 2: HERO (Apenas se não logado ou email não verificado) */}
        {!isAuthenticatedAndVerified && (
          <div className="py-12 sm:py-20 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Free Instant Trial • Multi-Layer Protected</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight mb-6">
              Monitor any webpage.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                Extract text from any document.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              One free trial. No credit card. Enterprise accuracy powered by automated change detection & OCR engines.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => openAuthModal('signup')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-base bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started Free
              </button>
              <button
                onClick={() => openAuthModal('signin')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-base bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all"
              >
                Sign In to Account
              </button>
            </div>

            {/* Feature Cards Grid Preview */}
            <div className="grid sm:grid-cols-2 gap-6 mt-16 text-left">
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
                <div className="h-10 w-10 rounded-xl bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                  <Globe className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Webpage Change Monitoring</h3>
                <p className="text-sm text-slate-400">
                  Track URL modifications, price shifts, and DOM changes with instant baseline text snapshots.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
                <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Document OCR Extraction</h3>
                <p className="text-sm text-slate-400">
                  Upload images or PDFs to extract structured, searchable text with deep learning precision.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 3: APP (Aparece se logado E email verificado) */}
        {isAuthenticatedAndVerified && (
          <div className="w-full max-w-4xl mx-auto">
            {/* Tabs Selector */}
            <div className="flex border-b border-slate-800 mb-8">
              <button
                onClick={() => setActiveTab('monitor')}
                className={`flex items-center space-x-2 py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'monitor'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>Monitor URL</span>
              </button>

              <button
                onClick={() => setActiveTab('ocr')}
                className={`flex items-center space-x-2 py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'ocr'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Scan Document</span>
              </button>
            </div>

            {/* ABA 1: MONITOR URL */}
            {activeTab === 'monitor' && (
              <div className="space-y-6">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
                  <h2 className="text-xl font-bold text-white mb-2">Monitor Webpage for Changes</h2>
                  <p className="text-sm text-slate-400 mb-6">
                    Enter any public URL to capture an initial baseline snapshot and start change tracking.
                  </p>

                  <form onSubmit={handleRunMonitor} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Target Webpage URL
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={monitorUrl}
                          onChange={(e) => setMonitorUrl(e.target.value)}
                          placeholder="https://competitor.com/pricing"
                          disabled={monitorLoading}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={monitorLoading || !monitorUrl.trim()}
                          className="px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {monitorLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Monitoring...</span>
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4" />
                              <span>Monitor this page</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  {monitorError && (
                    <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-sm flex items-center space-x-2.5">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
                      <span>{monitorError}</span>
                    </div>
                  )}
                </div>

                {/* SKELETON LOADING STATE */}
                {monitorLoading && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 animate-pulse space-y-3">
                    <div className="h-4 bg-slate-800 rounded w-1/4"></div>
                    <div className="h-3 bg-slate-800 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                    <div className="h-20 bg-slate-950 rounded-xl mt-4"></div>
                  </div>
                )}

                {/* UPGRADE CARD (Se trial usado) */}
                {monitorTrialUsed && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
                    <div className="h-12 w-12 rounded-2xl bg-amber-950/60 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white">You've used your free monitor trial</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                      Upgrade to unlock unlimited URL monitoring, automated hourly checks, and instant webhooks.
                    </p>
                    <div>
                      <a
                        href="mailto:upgrade@watchdocs.io?subject=Upgrade Request"
                        className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
                      >
                        <span>Upgrade — $19/mo</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )}

                {/* RESULT AREA */}
                {monitorResult && (monitorResult.snapshot || monitorResult.message || monitorResult.watchId) && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <h3 className="font-semibold text-white text-base">Monitoring Active</h3>
                      </div>
                      <span className="text-xs text-slate-500">
                        {monitorResult.checkedAt ? new Date(monitorResult.checkedAt).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                    {monitorResult.message && (
                      <p className="text-sm text-emerald-400 font-medium">
                        {monitorResult.message}
                      </p>
                    )}
                    {monitorResult.watchId && (
                      <p className="text-xs text-slate-400 font-mono">
                        Watch ID: <span className="text-slate-300">{monitorResult.watchId}</span>
                      </p>
                    )}
                    {monitorResult.snapshot && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Extracted Page Content
                        </label>
                        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-96">
                          {monitorResult.snapshot}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: SCAN DOCUMENT (OCR) */}
            {activeTab === 'ocr' && (
              <div className="space-y-6">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
                  <h2 className="text-xl font-bold text-white mb-2">Scan & Extract Document Text</h2>
                  <p className="text-sm text-slate-400 mb-6">
                    Upload an invoice, receipt, or scanned PDF to extract text with deep learning OCR.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processFile(e.target.files[0]);
                      }
                    }}
                  />

                  {/* Drag and Drop Area */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : selectedFile
                        ? 'border-emerald-500/50 bg-emerald-950/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-950/60'
                    }`}
                  >
                    <UploadCloud className={`h-10 w-10 mx-auto mb-3 ${selectedFile ? 'text-emerald-400' : 'text-slate-400'}`} />
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-semibold text-emerald-300 mb-1">{selectedFile.name}</p>
                        <p className="text-xs text-slate-400">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace file
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-slate-200 mb-1">
                          Drag and drop your document here, or <span className="text-indigo-400 font-semibold">browse</span>
                        </p>
                        <p className="text-xs text-slate-500">Supported formats: JPEG, PNG, PDF (Max 5MB)</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleRunOcr}
                      disabled={ocrLoading || !selectedFile}
                      className="px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {ocrLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Extracting Text...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          <span>Extract Text</span>
                        </>
                      )}
                    </button>
                  </div>

                  {ocrError && (
                    <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-sm flex items-center space-x-2.5">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
                      <span>{ocrError}</span>
                    </div>
                  )}
                </div>

                {/* SKELETON LOADING STATE */}
                {ocrLoading && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 animate-pulse space-y-3">
                    <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-800 rounded w-full"></div>
                    <div className="h-3 bg-slate-800 rounded w-5/6"></div>
                    <div className="h-24 bg-slate-950 rounded-xl mt-4"></div>
                  </div>
                )}

                {/* UPGRADE CARD (Se trial OCR usado) */}
                {ocrTrialUsed && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
                    <div className="h-12 w-12 rounded-2xl bg-amber-950/60 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white">You've used your free OCR trial</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                      Upgrade to unlock unlimited high-throughput document OCR, multi-page PDFs, and batch API access.
                    </p>
                    <div>
                      <a
                        href="mailto:upgrade@watchdocs.io?subject=Upgrade Request"
                        className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
                      >
                        <span>Upgrade — $19/mo</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )}

                {/* RESULT AREA */}
                {ocrResult && ocrResult.text && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <h3 className="font-semibold text-white text-base">Extracted Document Text</h3>
                      </div>
                      {ocrResult.confidence && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                          {Math.round(ocrResult.confidence * 100)}% Confidence
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Result
                      </label>
                      <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap max-h-96">
                        {ocrResult.text}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* SEÇÃO 4: AUTH MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/30">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {authMode === 'signin' ? 'Sign in to WatchDocs' : 'Create your free account'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {authMode === 'signin'
                  ? 'Access your monitoring and OCR tools'
                  : 'Get 1 free trial for URL monitoring and Document OCR'}
              </p>
            </div>

            {/* Auth Mode Toggle */}
            <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                  setAuthSuccessMsg('');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  authMode === 'signin'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                  setAuthSuccessMsg('');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  authMode === 'signup'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Key className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400 mt-0.5" />
                  <span>{authSuccessMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 disabled:opacity-50 transition-all"
              >
                {authSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950/40 py-6 text-center text-xs text-slate-500">
        <p>© 2026 WatchDocs SaaS. High-integrity change detection & document extraction.</p>
      </footer>
    </div>
  );
}
