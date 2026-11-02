#!/usr/bin/env node
// Pont orchestrateur -> agents externes (Codex : luna/sol, Antigravity : gemini).
// N'imprime que le compte rendu final de l'agent, pour ne pas remplir le contexte de l'orchestrateur.
//
//   node .claude/scripts/delegate.mjs <agent> <brief.md|-> [--skills a,b] [--diff [base]] [--paths a,b] [--effort niveau] [--dry-run]
//   node .claude/scripts/delegate.mjs quota
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLAUDE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CWD = process.cwd();
// Dans le dépôt de travail : Gemini ne lit que son espace de travail, même si le kit est installé ailleurs.
const STATE_DIR = path.join(CWD, '.claude', 'state');
const isWin = process.platform === 'win32';

function die(msg) {
  console.error(msg);
  process.exit(2);
}

// Les CLI desktop ne sont pas toujours dans le PATH ; le dossier de Codex change à chaque mise à jour.
function codexBin() {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  const base = path.join(process.env.LOCALAPPDATA ?? '', 'OpenAI', 'Codex', 'bin');
  if (fs.existsSync(base)) {
    const found = fs.readdirSync(base)
      .map((d) => path.join(base, d, 'codex.exe'))
      .filter((f) => fs.existsSync(f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (found.length) return found[0];
  }
  // Linux : le binaire livré avec l'app ChatGPT desktop.
  const linuxApp = '/usr/lib/chatgpt/resources/codex';
  return fs.existsSync(linuxApp) ? linuxApp : 'codex';
}

function agyBin() {
  if (process.env.AGY_BIN) return process.env.AGY_BIN;
  const local = path.join(process.env.LOCALAPPDATA ?? '', 'agy', 'bin', 'agy.exe');
  return fs.existsSync(local) ? local : 'agy';
}

function run(bin, args, { input, timeoutMin = 30, shell = isWin && !path.isAbsolute(bin) } = {}) {
  // Un CLI résolu via le PATH peut être un shim .cmd sous Windows : il faut alors un shell et des guillemets.
  const quoted = shell ? args.map((a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : args;
  return spawnSync(bin, quoted, {
    cwd: CWD,
    input,
    shell,
    encoding: 'utf8',
    maxBuffer: 256 << 20,
    timeout: timeoutMin * 60_000,
    windowsHide: true,
  });
}

function skillText(name) {
  const file = path.join(CLAUDE_DIR, 'skills', name, 'SKILL.md');
  if (!fs.existsSync(file)) die(`Skill inconnu : ${name}`);
  return fs.readFileSync(file, 'utf8').replace(/^---[\s\S]*?---\s*/, '').trim();
}

function git(args) {
  const r = run('git', args, { shell: false });
  return r.status === 0 ? r.stdout.trim() : null;
}

function gitDiff(base, paths, maxDiffKB) {
  let args = ['diff', base ?? 'HEAD'];
  const pathspec = ['--', ...paths];
  let diff = git([...args, ...pathspec]);
  if (diff === null && !base) {
    args = ['diff'];
    diff = git([...args, ...pathspec]);
  }
  if (diff === null) return '(git diff indisponible)';
  const stat = git([...args, '--stat', ...pathspec]);
  const untracked = git(['ls-files', '--others', '--exclude-standard', ...pathspec]);
  const diffKB = Buffer.byteLength(diff, 'utf8') / 1024;
  let out = '## Stat des fichiers modifiés\n```text\n' + (stat === null ? '(git diff --stat indisponible)' : stat || '(aucune modification suivie)') + '\n```\n\n';
  out += diffKB > maxDiffKB
    ? `## Diff omis\nDiff trop volumineux (${Math.ceil(diffKB)} Ko) : lis avec ta lecture de fichiers uniquement les fichiers listés utiles au brief.`
    : '## Diff inclus\n```diff\n' + (diff || '(aucune modification suivie)') + '\n```';
  if (untracked) out += '\n\nNouveaux fichiers non suivis (à lire directement) :\n' + untracked.split('\n').map((f) => `- ${f}`).join('\n');
  return out;
}

function fmtK(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n ?? 0);
}

function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function failure(name, r) {
  const reason = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.includes('auto-denied')
    ? 'commande refusée par agy (mode sans interface)'
    : r.error?.code === 'ETIMEDOUT' ? 'délai dépassé' : r.status === 0 ? 'aucune sortie' : (r.error?.message ?? `code ${r.status}`);
  const tail = (r.stderr || r.stdout || '').trim().split('\n').slice(-15).join('\n');
  console.log(`[${name} · ÉCHEC : ${reason}]\n${tail}`);
  process.exit(1);
}

function runCodex(name, agent, prompt, effort) {
  const outFile = path.join(os.tmpdir(), `delegate-${name}-${process.pid}.md`);
  const args = ['exec', '--json', '--skip-git-repo-check', '-s', agent.sandbox ?? 'workspace-write',
    '-m', agent.model, '-c', `model_reasoning_effort=${effort}`, '-o', outFile, '-'];
  const started = Date.now();
  const r = run(codexBin(), args, { input: prompt, timeoutMin: agent.timeoutMin });
  if (r.status !== 0 || !fs.existsSync(outFile)) failure(name, r);

  const usage = (r.stdout ?? '').split('\n')
    .filter((l) => l.includes('"turn.completed"'))
    .map((l) => JSON.parse(l).usage)
    .reduce((acc, u) => ({
      input: acc.input + (u.input_tokens ?? 0),
      cached: acc.cached + (u.cached_input_tokens ?? 0),
      output: acc.output + (u.output_tokens ?? 0),
    }), { input: 0, cached: 0, output: 0 });
  const text = fs.readFileSync(outFile, 'utf8').trim();
  fs.rmSync(outFile, { force: true });
  console.log(`[${name} · ${agent.model}/${effort} · ${fmtDuration(Date.now() - started)} · in ${fmtK(usage.input)} (cache ${fmtK(usage.cached)}) / out ${fmtK(usage.output)}]`);
  console.log(text);
}

function runAgy(name, agent, prompt, effort) {
  // agy -p ne transmet pas stdin au modèle : le prompt passe par un fichier qu'il lit lui-même.
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const briefFile = path.join(STATE_DIR, `${name}-brief.md`);
  fs.writeFileSync(briefFile, prompt);
  const rel = path.relative(CWD, briefFile).replaceAll('\\', '/');
  // Effort encodé dans le nom du modèle ({effort}) ou passé à part avec --effort.
  const inName = agent.model.includes('{effort}');
  const model = agent.model.replace('{effort}', effort);
  const args = ['-p', `Lis le fichier ${rel} et suis exactement ses instructions. Ne modifie aucun fichier.`,
    '--model', model, ...(inName || !effort ? [] : ['--effort', effort]), '--print-timeout', `${agent.timeoutMin ?? 20}m`];
  const started = Date.now();
  const r = run(agyBin(), args, { timeoutMin: (agent.timeoutMin ?? 20) + 1 });
  if (r.status !== 0 || !r.stdout.trim()) failure(name, r);
  console.log(`[${name} · ${model}${inName ? "" : `/${effort}`} · ${fmtDuration(Date.now() - started)}]`);
  console.log(r.stdout.trim());
}

function delegate(argv) {
  const [name, briefArg, ...rest] = argv;
  const agents = JSON.parse(fs.readFileSync(path.join(CLAUDE_DIR, 'workflow', 'agents.json'), 'utf8'));
  const agent = agents[name];
  if (!agent || !briefArg) die(`Usage : delegate.mjs <${Object.keys(agents).join('|')}> <brief.md|-> [--skills a,b] [--diff [base]] [--paths a,b] [--effort niveau] [--dry-run]`);

  let skills = [...agent.skills];
  let effort = agent.effort;
  let diff = false;
  let diffBase;
  let paths = [];
  let dryRun = false;
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === '--skills') {
      if (!rest[i + 1] || rest[i + 1].startsWith('--')) die('Valeur requise pour --skills : a,b');
      skills.push(...rest[++i].split(',').map((s) => s.trim()).filter(Boolean));
    }
    else if (flag === '--effort') {
      if (!rest[i + 1] || rest[i + 1].startsWith('--')) die('Valeur requise pour --effort : niveau');
      effort = rest[++i];
    }
    else if (flag === '--paths') {
      if (!rest[i + 1] || rest[i + 1].startsWith('--')) die('Valeur requise pour --paths : a,b');
      diff = true;
      paths = rest[++i].split(',').map((s) => s.trim()).filter(Boolean);
    }
    else if (flag === '--dry-run') dryRun = true;
    else if (flag === '--diff') {
      diff = true;
      if (rest[i + 1] && !rest[i + 1].startsWith('--')) diffBase = rest[++i];
    } else die(`Option inconnue : ${flag}`);
  }
  skills = [...new Set(skills)];

  const brief = briefArg === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(briefArg, 'utf8');
  const parts = [
    `# Rôle\n${agent.role}\nTu fais partie d'un système multi-agents piloté par un orchestrateur. Travaille dans le répertoire courant.`
      + (agent.cli === 'codex' && isWin ? '\nBash n’est pas disponible dans ton sandbox Windows : ne l’essaie pas ; liste dans RESTE les vérifications bash à faire, l’orchestrateur les lancera.' : ''),
    ...skills.map((s) => `# Skill : ${s}\n${skillText(s)}`),
    `# Brief\n${brief.trim()}`,
  ];
  if (diff) parts.push(`# Diff\n${gitDiff(diffBase, paths, agent.maxDiffKB ?? 150)}`);
  const prompt = parts.join('\n\n') + '\n';

  if (dryRun) {
    console.log(`Taille du prompt : ${(Buffer.byteLength(prompt, 'utf8') / 1024).toFixed(1)} Ko`);
    console.log(prompt.split('\n').slice(0, 40).join('\n'));
    console.log(`Sections présentes : ${(prompt.match(/^#{1,2} .+$/gm) ?? []).join(' | ')}`);
    return;
  }

  if (agent.cli === 'codex') runCodex(name, agent, prompt, effort);
  else if (agent.cli === 'agy') runAgy(name, agent, prompt, effort);
  else die(`CLI inconnue pour ${name} : ${agent.cli}`);
}

function findKey(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const found = findKey(v, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function until(epochSec) {
  const min = Math.round((epochSec * 1000 - Date.now()) / 60_000);
  if (min <= 0) return 'réinitialisé depuis';
  const h = Math.floor(min / 60);
  return h >= 24 ? `reset dans ${Math.floor(h / 24)}j${h % 24}h` : `reset dans ${h}h${String(min % 60).padStart(2, '0')}`;
}

// Codex n'expose pas ses limites en ligne de commande, mais chaque session enregistrée les note.
function codexQuota() {
  const dir = path.join(os.homedir(), '.codex', 'sessions');
  if (!fs.existsSync(dir)) return 'inconnu (aucune session Codex)';
  const files = fs.readdirSync(dir, { recursive: true })
    .filter((f) => String(f).endsWith('.jsonl'))
    .sort()
    .reverse()
    .slice(0, 20);
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('"rate_limits"')) continue;
      const entry = JSON.parse(lines[i]);
      const limits = findKey(entry, 'rate_limits');
      if (!limits?.primary) continue;
      const win = (w) => {
        const label = w.window_minutes >= 1440 ? `${Math.round(w.window_minutes / 1440)}j` : `${Math.round(w.window_minutes / 60)}h`;
        const reset = w.resets_at * 1000 <= Date.now();
        return `${label} ${reset ? 100 : Math.round(100 - w.used_percent)}% restant (${until(w.resets_at)})`;
      };
      const age = entry.timestamp ? ` [relevé il y a ${fmtDuration(Date.now() - Date.parse(entry.timestamp))}]` : '';
      return [limits.primary, limits.secondary].filter(Boolean).map(win).join(' · ') + age;
    }
  }
  return 'inconnu (aucune limite enregistrée récemment)';
}

function geminiQuota() {
  const r = run(agyBin(), ['-p', '/usage', '--print-timeout', '60s'], { timeoutMin: 2 });
  if (r.status !== 0) return `inconnu (${(r.stderr || '').trim().split('\n').pop()})`;
  const rows = r.stdout.split('\n').map((l) => l.split('\t')).filter((c) => c[0]?.startsWith('Gemini') && c.length >= 3);
  if (!rows.length) return 'inconnu';
  return rows.map(([, label, pct, reset]) => {
    const win = /five hour/i.test(label) ? '5h' : /week/i.test(label) ? '7j' : label;
    return `${win} ${pct} restant` + (reset ? ` (${until(Date.parse(reset) / 1000)})` : '');
  }).join(' · ');
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'quota') {
  console.log(`codex  : ${codexQuota()}`);
  console.log(`gemini : ${geminiQuota()}`);
  console.log('claude : outil get_usage (app desktop) ou /usage');
} else {
  delegate([cmd, ...args]);
}
