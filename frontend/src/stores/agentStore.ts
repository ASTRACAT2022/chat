import { create } from 'zustand';

export interface AgentFile { path: string; content?: string; }

export interface AgentSubTask {
  id: string; title: string; status: 'pending' | 'running' | 'done' | 'error'; content?: string;
}

export interface AgentSession {
  id: string; task: string; status: string; projectName?: string; summary?: string;
  files?: { path: string; type: string; description: string }[];
  createdAt: string; updatedAt: string;
}

export type AgentPhase = 'idle' | 'brainstorming' | 'planning' | 'generating' | 'reviewing' | 'fixing' | 'summarizing' | 'done' | 'error';

interface AgentState {
  sessions: AgentSession[];
  activeSession: AgentSession | null;
  jobId: string | null;
  dbId: string | null;
  generating: boolean;
  phase: AgentPhase;
  phaseText: string;
  subTasks: AgentSubTask[];
  files: AgentFile[];
  summary: string | null;
  projectName: string | null;
  error: string | null;
  previewPath: string | null;
  previewContent: string | null;
  improving: boolean;

  setSessions: (s: AgentSession[]) => void;
  setActiveSession: (s: AgentSession | null) => void;
  setJobId: (id: string | null) => void;
  setDbId: (id: string | null) => void;
  setGenerating: (g: boolean) => void;
  setPhase: (p: AgentPhase) => void;
  setPhaseText: (t: string) => void;
  addSubTask: (st: AgentSubTask) => void;
  updateSubTask: (id: string, updates: Partial<AgentSubTask>) => void;
  setSubTasks: (st: AgentSubTask[]) => void;
  addFile: (f: AgentFile) => void;
  setFiles: (f: AgentFile[]) => void;
  setFileList: (files: { path: string; content: string }[]) => void;
  setSummary: (s: string | null) => void;
  setProjectName: (n: string | null) => void;
  setError: (e: string | null) => void;
  setPreview: (path: string | null, content: string | null) => void;
  setImproving: (i: boolean) => void;
  reset: () => void;
}

const initial = {
  sessions: [],
  activeSession: null,
  jobId: null,
  dbId: null,
  generating: false,
  phase: 'idle' as AgentPhase,
  phaseText: '',
  subTasks: [],
  files: [],
  summary: null,
  projectName: null,
  error: null,
  previewPath: null,
  previewContent: null,
  improving: false,
};

export const useAgentStore = create<AgentState>((set) => ({
  ...initial,

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (session) => set({ activeSession: session }),
  setJobId: (jobId) => set({ jobId }),
  setDbId: (dbId) => set({ dbId }),
  setGenerating: (generating) => set({ generating }),
  setPhase: (phase) => set({ phase }),
  setPhaseText: (phaseText) => set({ phaseText }),
  addSubTask: (st) => set((s) => ({ subTasks: s.subTasks.find((x) => x.id === st.id) ? s.subTasks.map((x) => x.id === st.id ? st : x) : [...s.subTasks, st] })),
  updateSubTask: (id, updates) => set((s) => ({ subTasks: s.subTasks.map((x) => x.id === id ? { ...x, ...updates } : x) })),
  setSubTasks: (subTasks) => set({ subTasks }),
  addFile: (f) => set((s) => ({ files: s.files.find((x) => x.path === f.path) ? s.files : [...s.files, f] })),
  setFiles: (files) => set({ files }),
  setFileList: (list) => set({ files: list.map((f) => ({ path: f.path, content: f.content })) }),
  setSummary: (summary) => set({ summary }),
  setProjectName: (name) => set({ projectName: name }),
  setError: (error) => set({ error }),
  setPreview: (path, content) => set({ previewPath: path, previewContent: content }),
  setImproving: (improving) => set({ improving }),
  reset: () => set(initial),
}));
