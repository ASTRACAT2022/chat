import { Injectable } from '@nestjs/common';
import { ProvidersService } from '../providers/providers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatMessage } from '../../common/interfaces/ai-provider.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver: (format: string, options?: any) => any = require('archiver');

interface SubTask {
  id: string;
  title: string;
  model: string;
  prompt: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: string;
}

interface FileInfo {
  path: string;
  type: string;
  description: string;
}

export interface AgentJob {
  id: string;
  userId: string;
  task: string;
  outputDir: string;
  subTasks: SubTask[];
  files: FileInfo[];
  status: 'planning' | 'brainstorming' | 'generating' | 'reviewing' | 'fixing' | 'summarizing' | 'done' | 'error';
  projectName?: string;
  summary?: string;
  createdAt: Date;
  dbId?: string;
}

@Injectable()
export class AgentService {
  private jobs = new Map<string, AgentJob>();
  private outputBase = path.join(process.cwd(), 'generated-projects');

  private topModels: string[] = [];
  private modelsLoaded = false;

  constructor(
    private providersService: ProvidersService,
    private prisma: PrismaService,
  ) {
    fs.mkdir(this.outputBase, { recursive: true }).catch(() => {});
  }

  async startGeneration(
    userId: string,
    task: string,
    onProgress: (jobId: string, subTaskId: string, status: string, content?: string) => void,
    onFile: (jobId: string, filePath: string, content: string) => void,
  ): Promise<AgentJob> {
    const jobId = crypto.randomUUID();
    const projectSlug = task.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const outputDir = path.join(this.outputBase, `${projectSlug}-${jobId.slice(0, 8)}`);

    const dbSession = await this.prisma.agentSession.create({
      data: { userId, task, status: 'planning', outputDir },
    });

    const job: AgentJob = {
      id: jobId,
      userId, task, outputDir,
      subTasks: [], files: [],
      status: 'planning',
      createdAt: new Date(),
      dbId: dbSession.id,
    };
    this.jobs.set(jobId, job);
    await fs.mkdir(outputDir, { recursive: true });

    this.fullPipeline(job, onProgress, onFile).catch((err) => {
      job.status = 'error';
      onProgress(jobId, '', 'error', err.message);
      this.prisma.agentSession.update({ where: { id: job.dbId }, data: { status: 'error' } }).catch(() => {});
    });

    return job;
  }

  private async ensureModels(userId: string, count = 4) {
    if (this.modelsLoaded && this.topModels.length >= count) return;
    try {
      const top = await this.providersService.getTopFreeModels(userId, count);
      this.topModels = top.map((m) => m.id);
      while (this.topModels.length < count) this.topModels.push('openrouter/auto');
      this.modelsLoaded = true;
    } catch {
      this.topModels = ['openrouter/auto', 'openrouter/auto', 'openrouter/auto', 'openrouter/auto'];
      this.modelsLoaded = true;
    }
  }

  private async fullPipeline(
    job: AgentJob,
    onProgress: (jobId: string, subTaskId: string, status: string, content?: string) => void,
    onFile: (jobId: string, filePath: string, content: string) => void,
  ) {
    await this.ensureModels(job.userId);
    const apiKey = await this.providersService.getUserApiKey(job.userId, 'openrouter');
    const { task } = job;

    const updateDb = (data: any) => {
      if (job.dbId) this.prisma.agentSession.update({ where: { id: job.dbId }, data }).catch(() => {});
    };

    // ── Phase 1: Brainstorm ──────────────────────────────────
    job.status = 'brainstorming';
    updateDb({ status: 'brainstorming' });
    onProgress(job.id, 'brainstorm', 'running', '3 AI models brainstorming architecture...');

    const brainstormPromises = this.topModels.slice(1, 4).map((model, i) =>
      this.callModel(model, [
        { role: 'system', content: 'You are a senior software architect. Analyze this project task and propose: 1) Architecture 2) Tech stack 3) File structure 4) Key features. Be detailed and specific.' },
        { role: 'user', content: task },
      ], apiKey || undefined),
    );

    const brainstormResults = await Promise.allSettled(brainstormPromises);
    const brainstormTexts = brainstormResults
      .map((r, i) => `## Architect ${i + 1} (${this.topModels[i + 1]}):\n${r.status === 'fulfilled' ? r.value : 'N/A'}`)
      .join('\n\n');

    onProgress(job.id, 'brainstorm', 'done', 'Brainstorm complete');

    // ── Phase 2: Consolidate into plan ────────────────────────
    onProgress(job.id, 'plan', 'running', 'Consolidating ideas into project plan...');
    const plan = await this.callModel(this.topModels[0], [
      { role: 'system', content: `You are a senior project manager. Review these architectural proposals and create a unified project plan.

Return JSON:
{
  "projectName": "short project name",
  "files": [{ "path": "relative/file/path", "type": "file format (e.g. html, css, js, py, md, txt, json, docx, etc.)", "description": "what this file does" }],
  "summary": "brief project description"
}
Generate files appropriate for the task — web projects get html/css/js, documents get md/txt, scripts get py/js, etc. Up to 10 files.` },
      { role: 'user', content: `Task: ${task}\n\nBrainstorm results:\n${brainstormTexts}` },
    ], apiKey || undefined);

    onProgress(job.id, 'plan', 'done', plan);

    let projectPlan: any;
    try {
      const cleaned = plan.replace(/```json|```/g, '').trim();
      projectPlan = JSON.parse(cleaned);
    } catch {
      const isWebTask = /html|css|site|app|web|page|interface|ui|dashboard/i.test(task);
      projectPlan = {
        projectName: task.slice(0, 30),
        files: isWebTask
          ? [
              { path: 'index.html', description: 'Main page', type: 'html' },
              { path: 'style.css', description: 'Styles', type: 'css' },
              { path: 'script.js', description: 'Logic', type: 'js' },
              { path: 'README.md', description: 'Documentation', type: 'md' },
            ]
          : [
              { path: 'README.md', description: 'Documentation', type: 'md' },
              { path: 'output.md', description: 'Generated content', type: 'md' },
            ],
        summary: task,
      };
    }

    job.projectName = projectPlan.projectName || task.slice(0, 30);
    job.files = projectPlan.files || [];
    updateDb({ projectName: job.projectName, files: job.files });

    // ── Phase 3: Generate files (parallel) ────────────────────
    job.status = 'generating';
    updateDb({ status: 'generating' });
    onProgress(job.id, '', 'running', 'Generating project files...');

    for (const file of projectPlan.files || []) {
      job.subTasks.push({
        id: `file-${file.path}`,
        title: `Generate ${file.path}`,
        model: this.pickModel(file.type),
        prompt: `Generate the content for file "${file.path}" (${file.type}) for project "${projectPlan.projectName}". Task: ${task}. Return ONLY the file content, no explanations.`,
        status: 'pending',
      });
    }

    const genResults = await Promise.allSettled(
      job.subTasks.map(async (subTask) => {
        subTask.status = 'running';
        onProgress(job.id, subTask.id, 'running');
        const content = await this.callModel(subTask.model, [
          { role: 'system', content: 'You are a world-class developer. Generate complete, production-ready file content. Return ONLY the file content without markdown code blocks or explanations.' },
          { role: 'user', content: subTask.prompt },
        ], apiKey || undefined);

        subTask.result = content;
        subTask.status = 'done';
        onProgress(job.id, subTask.id, 'done', content);

        if (subTask.id.startsWith('file-')) {
          const filePath = subTask.id.replace('file-', '');
          const fullPath = path.join(job.outputDir, filePath);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          const cleanContent = content.replace(/```(?:\w+)?\n([\s\S]*?)```/g, '$1');
          await fs.writeFile(fullPath, cleanContent, 'utf-8');
          onFile(job.id, filePath, cleanContent);
        }
        return subTask;
      }),
    );

    // ── Phase 4: Quality review (3 models) ────────────────────
    job.status = 'reviewing';
    updateDb({ status: 'reviewing' });
    onProgress(job.id, '', 'running', 'Reviewing generated code for quality and bugs...');

    const allCode = job.subTasks
      .filter((st) => st.id.startsWith('file-') && st.result)
      .map((st) => `--- ${st.id.replace('file-', '')} ---\n${st.result}`)
      .join('\n\n');

    const reviewPromises = this.topModels.slice(1, 4).map((model) =>
      this.callModel(model, [
        { role: 'system', content: 'You are a senior code reviewer. Review the generated project files for: bugs, code quality, security issues, missing features, and improvements. Be critical and specific. Return a JSON array of issues: [{ "file": "path", "severity": "critical|major|minor", "description": "issue", "suggestion": "fix" }]' },
        { role: 'user', content: `Task: ${task}\n\nFiles:\n${allCode}` },
      ], apiKey || undefined),
    );

    const reviewResults = await Promise.allSettled(reviewPromises);
    const reviewText = reviewResults
      .map((r, i) => `## Reviewer ${i + 1}:\n${r.status === 'fulfilled' ? r.value : 'N/A'}`)
      .join('\n\n');

    onProgress(job.id, '', 'done', 'Review complete');

    // ── Phase 5: Apply fixes ──────────────────────────────────
    job.status = 'fixing';
    updateDb({ status: 'fixing' });
    onProgress(job.id, '', 'running', 'Applying fixes based on review feedback...');

    const fixResult = await this.callModel(this.topModels[0], [
      { role: 'system', content: 'You are a senior developer. Apply the review feedback to fix the generated project. For each file that needs changes, return the COMPLETE new content. Return JSON: { "fixes": [{ "file": "path", "content": "full new file content" }] }' },
      { role: 'user', content: `Task: ${task}\n\nOriginal files:\n${allCode}\n\nReview feedback:\n${reviewText}` },
    ], apiKey || undefined);

    let fixes: { file: string; content: string }[] = [];
    try {
      const cleaned = fixResult.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      fixes = parsed.fixes || [];
    } catch {}

    for (const fix of fixes) {
      const fullPath = path.join(job.outputDir, fix.file);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, fix.content, 'utf-8');
      onFile(job.id, fix.file, fix.content);

      const st = job.subTasks.find((s) => s.id === `file-${fix.file}`);
      if (st) { st.result = fix.content; st.status = 'done'; }
    }

    // ── Phase 6: Summary & README ─────────────────────────────
    job.status = 'summarizing';
    updateDb({ status: 'summarizing' });
    onProgress(job.id, '', 'running', 'Writing project summary and documentation...');

    const summary = await this.callModel(this.topModels[1], [
      { role: 'system', content: 'Write a comprehensive project summary in Russian and English. Include: project name, what it does, tech stack, how to use it, file structure. Format in markdown.' },
      { role: 'user', content: `Project: ${projectPlan.projectName || task}\nTask: ${task}\n\nFiles:\n${allCode}` },
    ], apiKey || undefined);

    job.summary = summary;
    const readmePath = path.join(job.outputDir, 'README.md');
    await fs.writeFile(readmePath, summary, 'utf-8');
    onFile(job.id, 'README.md', summary);
    updateDb({ summary, status: 'done' });

    // ── Generate overview.html ─────────────────────────────────
    const overviewHtml = await this.callModel(this.topModels[2], [
      { role: 'system', content: 'Generate a beautiful HTML page that serves as a project overview. Include: project name, a summary of what was created, links to all files, tech stack. Use modern CSS with dark theme. Make it look like a professional software project page. Return ONLY the HTML.' },
      { role: 'user', content: `Project: ${projectPlan.projectName || task}\nTask: ${task}\nFiles: ${(projectPlan.files || []).map((f: any) => f.path).join(', ')}\nSummary: ${summary.slice(0, 500)}` },
    ], apiKey || undefined);

    const overviewPath = path.join(job.outputDir, 'project-overview.html');
    const cleanHtml = overviewHtml.replace(/```html|```/g, '');
    await fs.writeFile(overviewPath, cleanHtml, 'utf-8');
    onFile(job.id, 'project-overview.html', cleanHtml);

    job.status = 'done';
    updateDb({ status: 'done' });
    onProgress(job.id, '', 'done', `Project "${job.projectName}" generated successfully!`);
  }

  async listSessions(userId: string) {
    return this.prisma.agentSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, task: true, status: true, projectName: true, summary: true, files: true, createdAt: true, updatedAt: true },
    });
  }

  async getSession(id: string, userId: string) {
    return this.prisma.agentSession.findFirst({ where: { id, userId } });
  }

  async deleteSession(id: string, userId: string) {
    const session = await this.prisma.agentSession.findFirst({ where: { id, userId } });
    if (!session) throw new Error('Not found');
    if (session.outputDir) {
      await fs.rm(session.outputDir, { recursive: true, force: true }).catch(() => {});
    }
    await this.prisma.agentSession.delete({ where: { id } });
  }

  async downloadSession(id: string, userId: string, res: any) {
    const session = await this.prisma.agentSession.findFirst({ where: { id, userId } });
    if (!session || !session.outputDir) throw new Error('Not found');

    const outputDir = session.outputDir;
    const exists = await fs.stat(outputDir).then(() => true).catch(() => false);
    if (!exists) throw new Error('Files not found on disk');

    const zipName = `${(session.projectName || 'project').replace(/[^a-z0-9]/gi, '-')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    return new Promise<void>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', reject);
      archive.pipe(res);
      archive.directory(outputDir, false);
      archive.finalize().then(resolve).catch(reject);
    });
  }

  async improveProject(
    jobId: string,
    instruction: string,
    onProgress: (jobId: string, subTaskId: string, status: string, content?: string) => void,
    onFile: (jobId: string, filePath: string, content: string) => void,
  ) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found. Only active sessions can be improved.');
    await this.ensureModels(job.userId);
    const apiKey = await this.providersService.getUserApiKey(job.userId, 'openrouter');

    // Re-read all files on disk
    const allFiles: { path: string; content: string }[] = [];
    for (const st of job.subTasks) {
      if (st.id.startsWith('file-') && st.result) {
        allFiles.push({ path: st.id.replace('file-', ''), content: st.result });
      }
    }

    const existingCode = allFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n');
    onProgress(job.id, '', 'running', `Applying improvements: ${instruction}...`);

    const improveResult = await this.callModel(this.topModels[0], [
      { role: 'system', content: 'You are a senior developer. Modify the project according to the improvement request. Return JSON: { "fixes": [{ "file": "path", "content": "COMPLETE new file content" }], "summary": "what was changed" }' },
      { role: 'user', content: `Improvement request: ${instruction}\n\nExisting files:\n${existingCode}` },
    ], apiKey || undefined);

    let improvements: { fixes: { file: string; content: string }[]; summary: string } = { fixes: [], summary: '' };
    try {
      const cleaned = improveResult.replace(/```json|```/g, '').trim();
      improvements = JSON.parse(cleaned);
    } catch {}

    for (const fix of improvements.fixes || []) {
      const fullPath = path.join(job.outputDir, fix.file);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, fix.content, 'utf-8');
      onFile(job.id, fix.file, fix.content);

      const st = job.subTasks.find((s) => s.id === `file-${fix.file}`);
      if (st) { st.result = fix.content; st.status = 'done'; }
    }

    onProgress(job.id, '', 'done', improvements.summary || 'Improvements applied');
    return improvements;
  }

  async getSessionFiles(sessionId: string, userId: string): Promise<{ path: string; content: string }[]> {
    const session = await this.prisma.agentSession.findFirst({ where: { id: sessionId, userId } });
    if (!session || !session.outputDir) return [];
    const dir = session.outputDir;
    const exists = await fs.stat(dir).then(() => true).catch(() => false);
    if (!exists) return [];

    const results: { path: string; content: string }[] = [];
    const readDir = async (dirPath: string, basePath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        const rel = path.join(basePath, entry.name);
        if (entry.isDirectory()) await readDir(full, rel);
        else if (entry.isFile()) {
          const content = await fs.readFile(full, 'utf-8').catch(() => '');
          results.push({ path: rel, content });
        }
      }
    };
    await readDir(dir, '');
    return results;
  }

  getJob(jobId: string): AgentJob | undefined {
    return this.jobs.get(jobId);
  }

  private pickModel(type: string): string {
    if (type === 'image' || type === 'research') return this.topModels[1];
    return this.topModels[0];
  }

  private async callModel(model: string, messages: ChatMessage[], apiKey?: string): Promise<string> {
    const provider = this.providersService.getProvider('openrouter');
    if (!provider) return 'No provider available';

    const modelPool = [...new Set([model, ...this.topModels])];
    const maxRetries = 6;
    let lastError = '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const currentModel = modelPool[attempt % modelPool.length];
      try {
        const result = await provider.chatCompletion({ messages, model: currentModel, stream: false }, apiKey);
        return result.content;
      } catch (err: any) {
        lastError = err.message || 'Unknown error';

        const retryAfter = this.parseRetrySeconds(lastError);
        if (retryAfter) {
          const delay = Math.min(retryAfter + 5, 120);
          await new Promise(r => setTimeout(r, delay * 1000));
          continue;
        }

        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
      }
    }

    return `Error generating content: ${lastError}`;
  }

  private parseRetrySeconds(error: string): number | null {
    const match = error.match(/retry_after_seconds["':]+\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
    if (error.includes('404')) return 5;
    if (error.includes('429')) return 30;
    return null;
  }
}
