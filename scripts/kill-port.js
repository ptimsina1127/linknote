const { execSync } = require('child_process');

const port = parseInt(process.env.PORT || '3000', 10);

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function listeningPids() {
  const out = run('netstat -ano');
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    const m = line.trim().match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s*$/);
    if (!m) continue;
    if (m[2].endsWith(':' + port)) pids.add(m[5]);
  }
  return [...pids];
}

function allProcesses() {
  try {
    const out = run(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress)"'
    );
    return JSON.parse(out);
  } catch (e) {
    return [];
  }
}

function findChainRoot(pid) {
  const procs = allProcesses();
  const byId = new Map(procs.map((p) => [String(p.ProcessId), p]));
  const chainRe = /node|npm|server\.js|--watch/i;
  let cur = byId.get(String(pid));
  let root = cur;
  let guard = 0;
  while (cur && guard++ < 20) {
    root = cur;
    const parent = byId.get(String(cur.ParentProcessId));
    if (!parent) break;
    const cmd = (parent.CommandLine || '') + ' ' + parent.Name;
    if (!chainRe.test(cmd)) break;
    cur = parent;
  }
  return root;
}

function killTree(pid) {
  try {
    run(`taskkill /PID ${pid} /T /F`);
    return true;
  } catch (e) {
    return false;
  }
}

const pids = listeningPids();
if (pids.length === 0) {
  console.log(`Port ${port} is free — nothing to kill.`);
  process.exit(0);
}

const roots = [...new Set(pids.map((p) => {
  const r = findChainRoot(p);
  return r ? String(r.ProcessId) : p;
}))];

for (const root of roots) {
  if (killTree(root)) console.log(`Killed process tree ${root} (port ${port})`);
}

const left = listeningPids();
if (left.length === 0) {
  console.log(`Port ${port} is free now.`);
} else {
  console.error(`Port ${port} still in use by PID(s): ${left.join(', ')}`);
  process.exit(1);
}
