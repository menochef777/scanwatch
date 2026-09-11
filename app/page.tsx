'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ArrowLeft,
  RefreshCw,
  Trash2,
  GitCompare,
  History,
  Eye,
  ChevronRight
} from 'lucide-react';

interface MonitorItem {
  id: string;
  uuid: string;
  url: string;
  title?: string;
  domain?: string;
  status?: 'monitoring' | 'changed' | 'error';
  lastChecked?: string;
  lastChanged?: string | null;
  createdAt?: string;
}

interface MonitorDetails extends MonitorItem {
  historyTimestamps?: string[];
  historyCount?: number;
  lastError?: string | null;
}

interface MonitorDiff {
  hasChanges: boolean;
  message?: string;
  baselineTimestamp?: string;
  latestTimestamp?: string;
  addedLines?: string[];
  removedLines?: string[];
  totalAdded?: number;
  totalRemoved?: number;
}

export default function HomePage() {
  const { user, profile, loading: authLoading, fingerprintHash, signUp, signIn, signOut } = useAuth();

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

  // Monitors List & Selection State
  const [monitors, setMonitors] = useState<MonitorItem[]>([]);
  const [monitorsLoading, setMonitorsLoading] = useState(false);
  const [selectedMonitorUuid, setSelectedMonitorUuid] = useState<string | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorDetails | null>(null);
  const [monitorDetailLoading, setMonitorDetailLoading] = useState(false);
  const [monitorDetailTab, setMonitorDetailTab] = useState<'status' | 'diff' | 'snapshot' | 'history'>('status');

  // Detail Sub-states (Diff & Snapshot)
  const [monitorDiff, setMonitorDiff] = useState<MonitorDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [monitorSnapshot, setMonitorSnapshot] = useState<string>('');
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Monitor Creation Form State
  const [monitorUrl, setMonitorUrl] = useState('');
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorTrialUsed, setMonitorTrialUsed] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [monitorSuccessMsg, setMonitorSuccessMsg] = useState('');

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

  // 1. Fetch user monitors on auth change
  const fetchMonitors = async () => {
    if (!user?.uid) return;
    setMonitorsLoading(true);
    try {
      const res = await fetch(`/api/monitors?uid=${encodeURIComponent(user.uid)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.monitors)) {
        setMonitors(data.monitors);
      }
    } catch (err) {
      console.error('Error fetching monitors:', err);
    } finally {
      setMonitorsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.emailVerified) {
      fetchMonitors();
    } else {
      setMonitors([]);
      setSelectedMonitorUuid(null);
    }
  }, [user]);

  // 2. Fetch selected monitor details
  const fetchMonitorDetails = async (uuid: string) => {
    setMonitorDetailLoading(true);
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(uuid)}?uid=${encodeURIComponent(user?.uid || '')}`);
      const data = await res.json();
      if (data.success) {
        setSelectedMonitor(data);
      }
    } catch (err) {
      console.error('Error fetching monitor detail:', err);
    } finally {
      setMonitorDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMonitorUuid) {
      fetchMonitorDetails(selectedMonitorUuid);
      setMonitorDetailTab('status');
      setMonitorDiff(null);
      setMonitorSnapshot('');
    } else {
      setSelectedMonitor(null);
    }
  }, [selectedMonitorUuid]);

  // 3. Load Diff when tab switched
  const loadDiff = async (uuid: string) => {
    setDiffLoading(true);
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(uuid)}/diff`);
      const data = await res.json();
      if (data.success) {
        setMonitorDiff(data);
      }
    } catch (err) {
      console.error('Error loading diff:', err);
    } finally {
      setDiffLoading(false);
    }
  };

  // 4. Load Snapshot when tab switched
  const loadSnapshot = async (uuid: string) => {
    setSnapshotLoading(true);
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(uuid)}/snapshot`);
      const data = await res.json();
      if (data.success) {
        setMonitorSnapshot(data.content || 'No snapshot content available.');
      }
    } catch (err) {
      console.error('Error loading snapshot:', err);
    } finally {
      setSnapshotLoading(false);
    }
  };

  // 5. Trigger Recheck
  const handleRecheck = async (uuid: string) => {
    setRechecking(true);
    try {
      await fetch(`/api/monitors/${encodeURIComponent(uuid)}/recheck`, { method: 'POST' });
      await fetchMonitorDetails(uuid);
      if (monitorDetailTab === 'diff') loadDiff(uuid);
      if (monitorDetailTab === 'snapshot') loadSnapshot(uuid);
    } catch (err) {
      console.error('Recheck failed:', err);
    } finally {
      setRechecking(false);
    }
  };

  // 6. Delete Monitor
  const handleDeleteMonitor = async (uuid: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this monitor?')) return;

    setDeletingId(uuid);
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(uuid)}?uid=${encodeURIComponent(user?.uid || '')}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMonitors((prev) => prev.filter((m) => m.uuid !== uuid && m.id !== uuid));
        if (selectedMonitorUuid === uuid) {
          setSelectedMonitorUuid(null);
        }
      }
    } catch (err) {
      console.error('Error deleting monitor:', err);
    } finally {
      setDeletingId(null);
    }
  };

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

  // Monitor Creation Handler
  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) {
      setMonitorError('Please sign in with a verified account first.');
      return;
    }
    if (!monitorUrl.trim()) return;

    setMonitorLoading(true);
    setMonitorError('');
    setMonitorSuccessMsg('');
    setMonitorTrialUsed(false);

    try {
      const response = await fetch('/api/monitors', {
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
        setMonitorError(data.error || 'Failed to start monitoring for this URL.');
      } else {
        setMonitorSuccessMsg('Monitoring started! Baseline snapshot captured.');
        setMonitorUrl('');
        await fetchMonitors();
        if (data.watchId) {
          setSelectedMonitorUuid(data.watchId);
        }
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

  // Helper for formatting time
  const formatTimeAgo = (isoStr?: string | null) => {
    if (!isoStr) return 'Never';
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return 'Never';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Never';
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-[#0f172a]/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setSelectedMonitorUuid(null)}>
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              WATCH<span className="text-indigo-400">DOCS</span>
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

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-start">
        {/* HERO (Se não autenticado) */}
        {!isAuthenticatedAndVerified && (
          <div className="py-12 sm:py-20 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-xs font-medium mb-6">
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              <span>URL Monitoring & Document OCR</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight mb-6">
              Monitor any webpage.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                Know the instant it changes.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Automated webpage change tracking, diff comparisons, and deep learning document extraction.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => openAuthModal('signup')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-base bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
              </button>
              <button
                onClick={() => openAuthModal('signin')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-base bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* LOGGED IN APPLICATION */}
        {isAuthenticatedAndVerified && (
          <div className="w-full space-y-8">
            {/* TABS SELECTOR */}
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => {
                  setActiveTab('monitor');
                }}
                className={`flex items-center space-x-2 py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'monitor'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>Monitor</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('ocr');
                }}
                className={`flex items-center space-x-2 py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'ocr'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Scan Document (OCR)</span>
              </button>
            </div>

            {/* TAB 1: MONITOR */}
            {activeTab === 'monitor' && (
              <div className="space-y-8">
                {/* 1. SELEÇÃO DE MONITOR ESPECÍFICO (DETALHES DO MONITOR) */}
                {selectedMonitorUuid ? (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Botão Voltar */}
                    <button
                      onClick={() => setSelectedMonitorUuid(null)}
                      className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors py-1"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>All monitors</span>
                    </button>

                    {/* Header do Monitor */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                              {selectedMonitor?.title || selectedMonitor?.domain || 'Webpage Monitor'}
                            </h2>
                            {selectedMonitor?.status === 'changed' ? (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-500/40 text-amber-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                <span>Change detected</span>
                              </span>
                            ) : selectedMonitor?.status === 'error' ? (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 border border-red-500/40 text-red-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                <span>Error</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                <span>Monitoring</span>
                              </span>
                            )}
                          </div>
                          <a
                            href={selectedMonitor?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-indigo-400 hover:underline flex items-center space-x-1"
                          >
                            <span>{selectedMonitor?.url}</span>
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        </div>

                        {/* Ações Rápidas */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRecheck(selectedMonitorUuid)}
                            disabled={rechecking}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${rechecking ? 'animate-spin' : ''}`} />
                            <span>{rechecking ? 'Rechecking...' : 'Recheck now'}</span>
                          </button>
                          <button
                            onClick={(e) => handleDeleteMonitor(selectedMonitorUuid, e)}
                            className="p-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-colors"
                            title="Delete monitor"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Metadados Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Last checked
                          </span>
                          <span className="text-sm font-medium text-slate-200">
                            {formatTimeAgo(selectedMonitor?.lastChecked)}
                          </span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Last change
                          </span>
                          <span className="text-sm font-medium text-slate-200">
                            {selectedMonitor?.lastChanged ? formatTimeAgo(selectedMonitor.lastChanged) : 'Never'}
                          </span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 col-span-2 sm:col-span-1">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Snapshots captured
                          </span>
                          <span className="text-sm font-medium text-slate-200">
                            {selectedMonitor?.historyCount ?? (selectedMonitor?.historyTimestamps?.length || 1)} snapshots
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SUB-TABS DO DETALHE */}
                    <div className="flex border-b border-slate-800 space-x-1">
                      <button
                        onClick={() => setMonitorDetailTab('status')}
                        className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                          monitorDetailTab === 'status'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Status
                      </button>
                      <button
                        onClick={() => {
                          setMonitorDetailTab('diff');
                          if (!monitorDiff) loadDiff(selectedMonitorUuid);
                        }}
                        className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                          monitorDetailTab === 'diff'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <GitCompare className="h-3.5 w-3.5" />
                        <span>View Difference</span>
                      </button>
                      <button
                        onClick={() => {
                          setMonitorDetailTab('snapshot');
                          if (!monitorSnapshot) loadSnapshot(selectedMonitorUuid);
                        }}
                        className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                          monitorDetailTab === 'snapshot'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Latest Snapshot</span>
                      </button>
                    </div>

                    {/* CONTEÚDO DA SUB-ABA: STATUS */}
                    {monitorDetailTab === 'status' && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                            Current Status
                          </h3>
                          {selectedMonitor?.status === 'changed' ? (
                            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 space-y-2">
                              <div className="flex items-center space-x-2 font-semibold">
                                <AlertCircle className="h-4 w-4 text-amber-400" />
                                <span>Change detected on this page!</span>
                              </div>
                              <p className="text-xs text-amber-300/80">
                                A difference was found compared to your baseline. Click "View Difference" to inspect the added and removed text lines.
                              </p>
                              <div className="pt-2">
                                <button
                                  onClick={() => {
                                    setMonitorDetailTab('diff');
                                    loadDiff(selectedMonitorUuid);
                                  }}
                                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow transition-all"
                                >
                                  View full difference
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-1">
                              <div className="flex items-center space-x-2 font-semibold text-emerald-400 text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>No changes detected</span>
                              </div>
                              <p className="text-xs text-slate-400">
                                Your baseline snapshot was captured on{' '}
                                {selectedMonitor?.createdAt
                                  ? new Date(selectedMonitor.createdAt).toLocaleString()
                                  : 'initial setup'}
                                . Automated checks are running.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* HISTÓRICO REAL */}
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
                            <History className="h-3.5 w-3.5" />
                            <span>History & Snapshots</span>
                          </h3>
                          {selectedMonitor?.historyTimestamps && selectedMonitor.historyTimestamps.length > 0 ? (
                            <div className="space-y-2">
                              {selectedMonitor.historyTimestamps.map((ts, idx) => {
                                const isBaseline = idx === selectedMonitor.historyTimestamps!.length - 1;
                                const isLatest = idx === 0;
                                const dateObj = new Date(Number(ts) * 1000);
                                return (
                                  <div
                                    key={ts}
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
                                  >
                                    <div className="flex items-center space-x-2.5">
                                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                                      <span className="font-mono text-slate-300">
                                        {isNaN(dateObj.getTime()) ? `Snapshot #${ts}` : dateObj.toLocaleString()}
                                      </span>
                                    </div>
                                    <span className="text-slate-500 text-[11px]">
                                      {isBaseline ? 'Baseline captured' : isLatest ? 'Latest check' : 'Checked — verified'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">
                              Initial baseline snapshot recorded. Subsequent automated checks will appear here.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CONTEÚDO DA SUB-ABA: DIFF */}
                    {monitorDetailTab === 'diff' && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Difference Comparison (Baseline vs Latest)
                          </h3>
                          <button
                            onClick={() => loadDiff(selectedMonitorUuid)}
                            disabled={diffLoading}
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                          >
                            <RefreshCw className={`h-3 w-3 ${diffLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh Diff</span>
                          </button>
                        </div>

                        {diffLoading ? (
                          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                            <span>Computing differences...</span>
                          </div>
                        ) : monitorDiff ? (
                          monitorDiff.hasChanges ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
                                  <span className="font-bold block text-sm">+{monitorDiff.totalAdded || 0}</span>
                                  <span>Added lines</span>
                                </div>
                                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-300">
                                  <span className="font-bold block text-sm">-{monitorDiff.totalRemoved || 0}</span>
                                  <span>Removed lines</span>
                                </div>
                              </div>

                              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                {monitorDiff.addedLines?.map((line, i) => (
                                  <div
                                    key={`add-${i}`}
                                    className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 font-mono text-xs text-emerald-200"
                                  >
                                    <span className="font-bold text-emerald-400 mr-2">+</span>
                                    {line}
                                  </div>
                                ))}
                                {monitorDiff.removedLines?.map((line, i) => (
                                  <div
                                    key={`rem-${i}`}
                                    className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 font-mono text-xs text-rose-200 line-through opacity-80"
                                  >
                                    <span className="font-bold text-rose-400 mr-2">-</span>
                                    {line}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="py-8 text-center text-slate-400 space-y-2">
                              <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto" />
                              <p className="text-sm font-medium text-slate-200">No differences detected</p>
                              <p className="text-xs text-slate-500">
                                {monitorDiff.message || 'The page content is identical to the baseline snapshot.'}
                              </p>
                            </div>
                          )
                        ) : null}
                      </div>
                    )}

                    {/* CONTEÚDO DA SUB-ABA: SNAPSHOT */}
                    {monitorDetailTab === 'snapshot' && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Real Captured Snapshot Content
                          </h3>
                          <button
                            onClick={() => loadSnapshot(selectedMonitorUuid)}
                            disabled={snapshotLoading}
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                          >
                            <RefreshCw className={`h-3 w-3 ${snapshotLoading ? 'animate-spin' : ''}`} />
                            <span>Reload</span>
                          </button>
                        </div>

                        {snapshotLoading ? (
                          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                            <span>Loading snapshot text...</span>
                          </div>
                        ) : (
                          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-96">
                            {monitorSnapshot || 'No content found in snapshot.'}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 2. VISÃO PRINCIPAL DO MONITOR (CRIAÇÃO + LISTA DOS MONITORES DO USUÁRIO) */
                  <div className="space-y-8">
                    {/* CARD: WHAT DO YOU WANT TO WATCH? */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-4">
                      <div className="space-y-1">
                        <h2 className="text-xl font-bold text-white tracking-tight">What do you want to watch?</h2>
                        <p className="text-xs text-slate-400">
                          Enter any website, product, or pricing URL to capture an immediate baseline and track changes.
                        </p>
                      </div>

                      <form onSubmit={handleCreateMonitor} className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="text"
                            value={monitorUrl}
                            onChange={(e) => setMonitorUrl(e.target.value)}
                            placeholder="https://www.site-example.com/"
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
                                <span>Starting...</span>
                              </>
                            ) : (
                              <>
                                <Globe className="h-4 w-4" />
                                <span>Start monitoring</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>

                      {monitorError && (
                        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2.5">
                          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                          <span>{monitorError}</span>
                        </div>
                      )}

                      {monitorSuccessMsg && (
                        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2.5">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                          <span>{monitorSuccessMsg}</span>
                        </div>
                      )}
                    </div>

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

                    {/* SEÇÃO: YOUR MONITORS */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Your Monitors ({monitors.length})
                        </h3>
                        <button
                          onClick={fetchMonitors}
                          disabled={monitorsLoading}
                          className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition-colors"
                        >
                          <RefreshCw className={`h-3 w-3 ${monitorsLoading ? 'animate-spin' : ''}`} />
                          <span>Refresh list</span>
                        </button>
                      </div>

                      {monitorsLoading && monitors.length === 0 ? (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
                          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                          <span>Loading your monitors...</span>
                        </div>
                      ) : monitors.length === 0 ? (
                        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
                          <Globe className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                          <h4 className="text-sm font-semibold text-slate-300">No active monitors yet</h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            Enter any URL above (like <code className="text-indigo-400">https://www.site-example.com/</code>) to start tracking.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {monitors.map((m) => {
                            const isChanged = m.status === 'changed';
                            const isError = m.status === 'error';
                            const uuid = m.uuid || m.id;
                            return (
                              <div
                                key={uuid}
                                onClick={() => setSelectedMonitorUuid(uuid)}
                                className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2.5">
                                    <span
                                      className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                                        isChanged
                                          ? 'bg-amber-400 animate-pulse'
                                          : isError
                                          ? 'bg-red-400'
                                          : 'bg-emerald-400'
                                      }`}
                                    />
                                    <h4 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                                      {m.title || m.domain || m.url}
                                    </h4>
                                  </div>
                                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                                    <span className="truncate max-w-xs sm:max-w-md font-mono">{m.url}</span>
                                    <span>•</span>
                                    <span>{isChanged ? 'Changes detected' : 'No changes detected'}</span>
                                    <span>•</span>
                                    <span>Checked {formatTimeAgo(m.lastChecked)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 sm:self-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setSelectedMonitorUuid(uuid)}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all flex items-center space-x-1"
                                  >
                                    <span>View changes</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteMonitor(uuid, e)}
                                    disabled={deletingId === uuid}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                    title="Delete monitor"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SCAN DOCUMENT (OCR) */}
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

      {/* AUTH MODAL */}
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
        <p>© 2026 WatchDocs SaaS. High-integrity webpage change monitoring & document extraction.</p>
      </footer>
    </div>
  );
}
