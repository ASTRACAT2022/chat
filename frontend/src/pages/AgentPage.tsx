import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Send, File, FolderOpen, Loader2, CheckCircle2, XCircle, Clock, AlertCircle,
  Bot, History, Trash2, Download, Sparkles, RefreshCw, Eye, Code, Maximize2, Minimize2, Layers,
  Globe, Brain,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useAgentStore, AgentPhase } from '../stores/agentStore';
import { api } from '../lib/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

const phaseMeta: Record<AgentPhase, { label: string; color: string }> = {
  idle: { label: '', color: '' },
  brainstorming: { label: 'Brainstorming', color: 'text-blue-400' },
  planning: { label: 'Planning', color: 'text-purple-400' },
  generating: { label: 'Generating', color: 'text-accent-light' },
  reviewing: { label: 'Reviewing', color: 'text-yellow-400' },
  fixing: { label: 'Fixing', color: 'text-orange-400' },
  summarizing: { label: 'Summarizing', color: 'text-green-400' },
  done: { label: 'Complete', color: 'text-green-400' },
  error: { label: 'Error', color: 'text-red-400' },
};

export default function AgentPage() {
  const socketRef = useRef<Socket | null>(null);
  const userId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token);
  const [input, setInput] = useState('');
  const [reasoning, setReasoning] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [improveInput, setImproveInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 1024);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);

  const store = useAgentStore();
  const {
    sessions, activeSession, jobId, generating, phase, phaseText, subTasks, files,
    summary, projectName, error, improving,
    previewPath, previewContent,
  } = store;

  const loadSessions = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('agent:list');
  }, []);

  useEffect(() => {
    if (!userId || !token) return;
    const socket = io(SOCKET_URL, { query: { userId }, auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => { socket.emit('agent:list'); });
    socket.on('connect_error', (err) => store.setError(`Socket error: ${err.message}`));

    socket.on('agent:started', (data: { jobId: string; dbId: string }) => {
      store.setJobId(data.jobId);
      store.setDbId(data.dbId);
      store.setGenerating(true);
      store.setPhase('brainstorming');
      store.setPhaseText('');
      store.setSubTasks([]);
      store.setFiles([]);
      store.setSummary(null);
      store.setError(null);
    });

    socket.on('agent:progress', (data: { jobId: string; subTaskId: string; status: string; content?: string }) => {
      if (data.subTaskId === 'brainstorm') {
        if (data.status === 'running') store.setPhase('brainstorming');
        else if (data.status === 'done') store.setPhase('planning');
        if (data.content) store.setPhaseText(data.content);
        return;
      }
      if (data.subTaskId === 'plan') {
        if (data.status === 'running') store.setPhase('planning');
        else if (data.status === 'done') store.setPhase('generating');
        if (data.content) store.setPhaseText(data.content);
        return;
      }
      if (data.subTaskId === '') {
        if (data.status === 'done') {
          store.setPhase('done');
          store.setPhaseText(data.content || '');
          store.setGenerating(false);
          setTimeout(() => socket.emit('agent:list'), 500);
        } else if (data.status === 'error') {
          store.setPhase('error');
          store.setError(data.content || 'Generation failed');
          store.setGenerating(false);
        } else if (data.status === 'running') {
          if (data.content?.includes('Reviewing')) store.setPhase('reviewing');
          else if (data.content?.includes('fix')) store.setPhase('fixing');
          else if (data.content?.includes('Summar') || data.content?.includes('documentation')) store.setPhase('summarizing');
          else store.setPhase('generating');
          if (data.content) store.setPhaseText(data.content);
        }
        return;
      }
      store.addSubTask({ id: data.subTaskId, title: data.subTaskId, status: data.status as any, content: data.content });
    });

    socket.on('agent:file', (data: { jobId: string; filePath: string; content: string }) => {
      store.addFile({ path: data.filePath, content: data.content });
    });

    socket.on('agent:list', (sessions: any[]) => {
      store.setSessions(sessions);
    });

    socket.on('agent:error', (data: { error: string }) => {
      store.setError(data.error);
      store.setImproving(false);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [userId, token]);

  const handleGenerate = () => {
    let trimmed = input.trim();
    if (!trimmed || generating || !socketRef.current) return;
    if (webSearch) trimmed = `[Search web for] ${trimmed}`;
    if (reasoning) trimmed = `[Think step by step] ${trimmed}`;
    store.reset();
    store.setGenerating(true);
    store.setPhase('brainstorming');
    socketRef.current.emit('agent:generate', { task: trimmed });
    setWebSearch(false);
    setReasoning(false);
  };

  const handleImprove = () => {
    const trimmed = improveInput.trim();
    if (!trimmed || improving || !jobId || !socketRef.current) return;
    store.setImproving(true);
    store.setPhase('generating');
    store.setPhaseText(`Applying: ${trimmed}`);
    socketRef.current.emit('agent:improve', { jobId, instruction: trimmed });
    setImproveInput('');
    setTimeout(() => store.setImproving(false), 1000);
  };

  const handleDownload = async (sessionId: string) => {
    const a = document.createElement('a');
    a.href = `/api/agent/sessions/${sessionId}/download`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePreviewHtml = (content: string) => {
    setHtmlPreview(content);
  };

  const handleViewSession = async (session: any) => {
    store.reset();
    store.setActiveSession(session);
    try {
      const data = await api.agent.getSessionFiles(session.id);
      store.setFileList(data);
      store.setProjectName(session.projectName);
      store.setSummary(session.summary);
      store.setPhase('done');
    } catch {}
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.agent.deleteSession(id);
      store.setSessions(sessions.filter((s) => s.id !== id));
      if (activeSession?.id === id) store.setActiveSession(null);
    } catch {}
  };

  const dirs = files.reduce((acc: string[], f) => {
    const parts = f.path.split('/');
    if (parts.length > 1) {
      parts.pop();
      const dir = parts.join('/');
      if (!acc.includes(dir)) acc.push(dir);
    }
    return acc;
  }, []);

  const isImage = (path: string) => /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(path);
  const isHtml = (path: string) => /\.(html|htm)$/i.test(path);

  const phaseIcon = (p: AgentPhase) => {
    if (p === 'idle' || p === 'done') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (p === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
    return <Loader2 className="w-4 h-4 text-accent-light animate-spin" />;
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-3.5 h-3.5 text-gray-600" />;
      case 'running': return <Loader2 className="w-3.5 h-3.5 text-accent-light animate-spin" />;
      case 'done': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'error': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-gray-600" />;
    }
  };

  const phaseSteps: AgentPhase[] = ['brainstorming', 'planning', 'generating', 'reviewing', 'fixing', 'summarizing'];
  const currentPhaseIdx = phaseSteps.indexOf(phase);

  return (
    <div className="flex-1 flex bg-black min-h-0">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-56' : 'w-0'} transition-all duration-300 border-r border-white/[0.04] bg-black/60 backdrop-blur-2xl flex flex-col overflow-hidden shrink-0`}>
        <div className="p-3 border-b border-white/[0.04]">
          <button
            onClick={() => { store.reset(); setInput(''); setImproveInput(''); setHtmlPreview(null); store.setActiveSession(null); }}
            className="w-full flex items-center gap-2 justify-center text-sm py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/[0.06] transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            New Task
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <History className="w-3 h-3 text-gray-600" />
          <span className="text-[9px] font-medium text-gray-600 uppercase tracking-widest">History</span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {sessions.length === 0 && (
            <div className="text-center py-8 text-[10px] text-gray-700 font-mono px-2">No agent tasks yet</div>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleViewSession(s)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-all group ${
                activeSession?.id === s.id ? 'bg-white/[0.06] text-gray-200' : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]'
              }`}
            >
              <Bot className="w-3 h-3 shrink-0" />
              <div className="truncate flex-1 min-w-0">
                <div className="truncate text-[11px]">{s.projectName || s.task.slice(0, 24)}</div>
                <div className="text-[8px] text-gray-700 font-mono">
                  {s.status} · {new Date(s.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span
                onClick={(e) => handleDeleteSession(s.id, e)}
                className="opacity-60 lg:opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04]">
          <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-500">
            <Bot className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/30 to-purple-500/30 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-accent-light" />
          </div>
          <div className="flex-1">
            <h1 className="text-xs font-bold text-gray-400 tracking-wider">
              {projectName || 'GENERATIVE AGENT'}
            </h1>
            <p className="text-[9px] text-gray-700 font-mono">
              {generating ? phaseMeta[phase]?.label || phase : activeSession ? activeSession.task.slice(0, 50) : 'MULTI-MODEL PROJECT GENERATION'}
            </p>
          </div>
          {activeSession && (
            <button
              onClick={() => handleDownload(activeSession.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] border border-white/[0.06] text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] transition-all"
            >
              <Download className="w-3 h-3" />
              Download ZIP
            </button>
          )}
        </div>

        {/* Phase progress bar */}
        {(generating || phase === 'done' || phase === 'error') && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.04] bg-white/[0.01]">
            {phaseSteps.map((step, i) => {
              const meta = phaseMeta[step];
              const done = i < currentPhaseIdx || phase === 'done';
              const active = i === currentPhaseIdx && generating;
              return (
                <div key={step} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    done ? 'bg-green-500' : active ? 'bg-accent-light animate-pulse' : 'bg-white/[0.06]'
                  }`} />
                  <span className={`text-[8px] font-mono truncate ${done ? 'text-gray-500' : active ? 'text-accent-light' : 'text-gray-800'}`}>
                    {meta.label}
                  </span>
                  {i < phaseSteps.length - 1 && <div className="flex-1 h-[1px] bg-white/[0.04] mx-1" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            {/* Idle / empty state */}
            {phase === 'idle' && !activeSession && (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/10 to-purple-500/10 flex items-center justify-center mx-auto mb-5 border border-white/[0.06]">
                  <Bot className="w-7 h-7 text-gray-500" />
                </div>
                <h2 className="text-sm font-bold text-gray-400 tracking-wider mb-1">AI Project Generator</h2>
                <p className="text-[11px] text-gray-700 font-mono mb-4 max-w-md mx-auto leading-relaxed">
                  Describe any project — 3 AI models brainstorm, generate, review, fix, and summarize. All with free models.
                </p>
                <div className="flex items-center justify-center gap-4 text-[10px] text-gray-700 font-mono">
                  <span>🧠 Brainstorm</span>
                  <span>→</span>
                  <span>⚡ Generate</span>
                  <span>→</span>
                  <span>🔍 Review</span>
                  <span>→</span>
                  <span>🛠️ Fix</span>
                  <span>→</span>
                  <span>📝 Summary</span>
                </div>
              </div>
            )}

            {/* Active generation / session view */}
            {(phase !== 'idle' || activeSession) && (
              <div className="space-y-4">
                {/* Phase message */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  {phaseIcon(phase)}
                  <span className={`text-xs ${phaseMeta[phase]?.color || 'text-gray-400'}`}>
                    {phaseMeta[phase]?.label || (activeSession ? 'Complete' : '')}
                  </span>
                  {phaseText && <span className="text-[10px] text-gray-600 ml-auto truncate max-w-[50%]">{phaseText}</span>}
                </div>

                {/* Summary card */}
                {summary && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/[0.04] flex items-center gap-2">
                      <File className="w-3 h-3 text-accent-light" />
                      <span className="text-[10px] text-gray-400 font-medium">README.md</span>
                    </div>
                    <div className="p-4">
                      <pre className="text-[11px] text-gray-500 font-mono whitespace-pre-wrap leading-relaxed">{summary}</pre>
                    </div>
                  </div>
                )}

                {/* Sub-tasks */}
                {subTasks.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-medium text-gray-700 uppercase tracking-widest px-1">Tasks</span>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto">
                      {subTasks.map((st) => (
                        <div key={st.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.01] border border-white/[0.03]">
                          {statusIcon(st.status)}
                          <span className="text-[11px] text-gray-500 truncate">{st.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-medium text-gray-700 uppercase tracking-widest px-1">
                      Files ({files.length})
                    </span>
                    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                      {dirs.map((dir) => (
                        <div key={dir}>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.03]">
                            <FolderOpen className="w-3 h-3 text-accent-light/60" />
                            <span className="text-[10px] text-gray-600 font-mono">{dir}/</span>
                          </div>
                          {files.filter((f) => f.path.startsWith(dir + '/')).map((f) => (
                            <FileRow key={f.path} file={f} isImage={isImage} isHtml={isHtml}
                              onPreview={() => store.setPreview(f.path, f.content || '')}
                              onPreviewHtml={() => handlePreviewHtml(f.content || '')} />
                          ))}
                        </div>
                      ))}
                      {files.filter((f) => !f.path.includes('/')).map((f) => (
                        <FileRow key={f.path} file={f} isImage={isImage} isHtml={isHtml}
                          onPreview={() => store.setPreview(f.path, f.content || '')}
                          onPreviewHtml={() => handlePreviewHtml(f.content || '')} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                {previewPath && previewContent !== null && !htmlPreview && (
                  <PreviewPanel
                    path={previewPath}
                    content={previewContent}
                    onClose={() => store.setPreview(null, null)}
                    onHtmlPreview={() => handlePreviewHtml(previewContent)}
                    isHtml={isHtml(previewPath)}
                  />
                )}

                {/* HTML preview */}
                {htmlPreview && (
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/[0.03]">
                      <Eye className="w-3.5 h-3.5 text-accent-light" />
                      <span className="text-[10px] text-gray-400 font-mono">Live Preview</span>
                      <button onClick={() => setHtmlPreview(null)} className="ml-auto text-[10px] text-gray-700 hover:text-gray-400 transition-colors">Close</button>
                    </div>
                    <div className="bg-white w-full h-[500px]">
                      <iframe
                        srcDoc={htmlPreview}
                        className="w-full h-full border-0"
                        title="Project Preview"
                        sandbox="allow-scripts"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: input area */}
        <div className="border-t border-white/[0.04] p-3">
          <div className="max-w-4xl mx-auto">
            {error && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-[11px] text-red-400 flex-1">{error}</span>
                <button onClick={() => store.setError(null)} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
              </div>
            )}

            {generating || phase === 'done' ? (
              /* Improve input when project exists */
              <div className="flex gap-2">
                <input
                  type="text"
                  value={improveInput}
                  onChange={(e) => setImproveInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleImprove(); }}
                  placeholder="Improve the project: add dark mode, fix responsive, add animations..."
                  disabled={improving}
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
                />
                <button
                  onClick={handleImprove}
                  disabled={!improveInput.trim() || improving || !jobId}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 text-sm border border-white/[0.06] transition-all shrink-0"
                >
                  {improving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Improve
                </button>
              </div>
            ) : (
              /* Generate input */
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setWebSearch(!webSearch)}
                    className={(webSearch ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]' : 'text-gray-600 hover:text-gray-400 border border-white/[0.04] hover:border-white/10') + ' flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-[10px] font-medium transition-all'}
                  >
                    <Globe className="w-3 h-3" />
                    Search
                  </button>
                  <button
                    onClick={() => setReasoning(!reasoning)}
                    className={(reasoning ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]' : 'text-gray-600 hover:text-gray-400 border border-white/[0.04] hover:border-white/10') + ' flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-[10px] font-medium transition-all'}
                  >
                    <Brain className="w-3 h-3" />
                    Reason
                  </button>
                </div>
                <div className="flex gap-2">
                  <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                  placeholder="Describe the project to generate..."
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all resize-none min-h-[40px] max-h-[100px]"
                  rows={1}
                />
                <button
                  onClick={handleGenerate}
                  disabled={!input.trim() || generating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 text-sm border border-white/[0.06] transition-all shrink-0"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Generate
                </button>
              </div>
            </div>
          )}
            <p className="text-[10px] text-gray-800 mt-1 px-1">{/Mobi|Android/i.test(navigator.userAgent) ? 'Tap Send to generate' : 'Cmd+Enter to send'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileRow({ file, isImage, isHtml, onPreview, onPreviewHtml }: {
  file: { path: string; content?: string };
  isImage: (p: string) => boolean;
  isHtml: (p: string) => boolean;
  onPreview: () => void;
  onPreviewHtml: () => void;
}) {
  const ext = file.path.split('.').pop()?.toLowerCase();
  const icon = ext === 'html' || ext === 'htm' ? '🌐' : ext === 'css' ? '🎨'
    : ext === 'js' || ext === 'ts' || ext === 'tsx' || ext === 'jsx' ? '📦'
    : isImage(file.path) ? '🖼️' : ext === 'md' || ext === 'txt' ? '📄' : ext === 'json' ? '📋' : '📄';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0 transition-colors group">
      <span className="text-[11px]">{icon}</span>
      <span className="text-[11px] text-gray-500 font-mono flex-1 truncate">{file.path.split('/').pop()}</span>
      {isHtml(file.path) && (
        <button onClick={onPreviewHtml} className="text-[9px] text-gray-700 hover:text-accent-light opacity-60 lg:opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
          <Eye className="w-2.5 h-2.5" /> Preview
        </button>
      )}
      <button onClick={onPreview} className="text-[9px] text-gray-700 hover:text-gray-400 opacity-60 lg:opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
        <Code className="w-2.5 h-2.5" /> Code
      </button>
    </div>
  );
}

function PreviewPanel({ path, content, onClose, onHtmlPreview, isHtml }: {
  path: string; content: string; onClose: () => void; onHtmlPreview: () => void; isHtml: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/[0.03]">
        <File className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-[11px] text-gray-400 font-mono flex-1">{path}</span>
        {isHtml && (
          <button onClick={onHtmlPreview} className="flex items-center gap-1 text-[10px] text-accent-light hover:text-accent transition-all">
            <Eye className="w-3 h-3" /> Live
          </button>
        )}
        <button onClick={onClose} className="text-[10px] text-gray-700 hover:text-gray-400 transition-all">Close</button>
      </div>
      <div className="max-h-96 overflow-auto">
        <pre className="text-[10px] text-gray-500 font-mono p-3 whitespace-pre-wrap break-all leading-relaxed">{content}</pre>
      </div>
    </div>
  );
}
