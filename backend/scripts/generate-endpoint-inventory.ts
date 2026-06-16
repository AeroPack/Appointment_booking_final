import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { zodToJsonSchema } from 'zod-to-json-schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT = path.resolve(BACKEND_ROOT, '../frontend/src');

const INVENTORY_DIR = path.join(BACKEND_ROOT, 'inventory');
const GENERATED_TYPES_DIR = path.join(FRONTEND_ROOT, 'types/generated');

interface Endpoint {
  method: string;
  path: string;
  middlewares: string[];
  handler: string;
  schemas: string[];
  roles: string[];
}

interface ModuleInfo {
  name: string;
  basePath: string;
  endpoints: Endpoint[];
}

interface DriftEntry {
  module: string;
  missing: string[];
}

// Router variable name -> module name (derived from imports in app.ts)
const routerToModule: Record<string, string> = {};
const modules: Record<string, ModuleInfo> = {};
const zodSchemasByModule: Record<string, Record<string, object>> = {};
const typesByModule: Record<string, string> = {};
const driftReports: DriftEntry[] = [];

const MODULE_TO_FEATURE: Record<string, { api?: string; types?: string }> = {
  auth:         { api: 'features/auth/authApi.ts',         types: 'features/auth/types.ts' },
  users:        { api: 'features/users/usersApi.ts',       types: 'features/users/types.ts' },
  doctors:      { api: 'features/doctors/doctorsApi.ts',   types: 'features/doctors/types.ts' },
  settings:     { api: 'features/settings/settingsApi.ts', types: 'features/settings/types.ts' },
  appointments: { api: 'features/appointments/appointmentsApi.ts', types: 'features/appointments/types.ts' },
  tags:         { api: 'features/tags/tagsApi.ts',         types: 'features/tags/types.ts' },
  messages:     {},
};

const KNOWN_MIDDLEWARE = new Set([
  'authGuard', 'requireRole', 'validate', 'rateLimit',
  'errorHandler', 'clinicScope',
]);

// ── Step 1: Parse app.ts ────────────────────────────────────────────

function parseApp(): void {
  const appTsPath = path.join(BACKEND_ROOT, 'src/app.ts');
  if (!fs.existsSync(appTsPath)) {
    console.warn('⚠ app.ts not found');
    return;
  }

  const content = fs.readFileSync(appTsPath, 'utf8');

  // e.g. import authRoutes from './modules/auth/auth.routes.js'
  const importRe = /import\s+(\w+Routes)\s+from\s+['"]\.\/modules\/(\w+)\/\2\.routes\.js['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    routerToModule[m[1]] = m[2];
  }

  // e.g. app.use('/api/auth', authRoutes)
  const mountRe = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+Routes)\s*\)/g;
  while ((m = mountRe.exec(content)) !== null) {
    const rvar = m[2];
    const base = m[1].replace(/\/+$/, '');
    const mod = routerToModule[rvar];
    if (mod && !modules[mod]) {
      modules[mod] = { name: mod, basePath: base, endpoints: [] };
    }
  }
}

// ── Step 2: Parse route file ────────────────────────────────────────

function parseRouteFile(mod: string): void {
  const rp = path.join(BACKEND_ROOT, 'src/modules', mod, `${mod}.routes.ts`);
  if (!fs.existsSync(rp)) return;

  const content = fs.readFileSync(rp, 'utf8');
  const routeRe = /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^;]+?)\)\s*;/g;

  let match: RegExpExecArray | null;
  while ((match = routeRe.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const args = splitArgs(match[3]);

    const ep: Endpoint = {
      method,
      path: normalizePath(`${modules[mod].basePath}/${routePath}`),
      middlewares: [],
      handler: '',
      schemas: [],
      roles: [],
    };

    for (const raw of args) {
      const a = raw.trim();

      if (a.startsWith('validate(')) {
        ep.middlewares.push('validate');
        const s = a.match(/validate\((\w+Schema)/);
        if (s) ep.schemas.push(s[1]);
      } else if (a === 'authGuard') {
        ep.middlewares.push('authGuard');
      } else if (a.startsWith('requireRole(')) {
        ep.middlewares.push('requireRole');
        const r = a.match(/requireRole\(([^)]+)\)/);
        if (r) {
          ep.roles.push(...r[1].split(',').map(x => x.trim().replace(/['"]/g, '')));
        }
      } else if (a.startsWith('rateLimit(')) {
        ep.middlewares.push('rateLimit');
      } else if (KNOWN_MIDDLEWARE.has(a)) {
        ep.middlewares.push(a);
      } else if (/^[a-zA-Z]\w*$/.test(a) && !KNOWN_MIDDLEWARE.has(a)) {
        ep.handler = a;
      }
    }

    modules[mod].endpoints.push(ep);
  }
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function normalizePath(p: string): string {
  return '/' + p.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

// ── Step 3: Extract inline Zod schemas via temp module ──────────────

async function extractZodSchemas(mod: string): Promise<void> {
  const rp = path.join(BACKEND_ROOT, 'src/modules', mod, `${mod}.routes.ts`);
  if (!fs.existsSync(rp)) return;

  const content = fs.readFileSync(rp, 'utf8');

  // Collect schema declarations + auxiliary variables (regex, etc.)
  const auxVars: { name: string; line: string }[] = [];
  const schemaDecls: { name: string; source: string }[] = [];

  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const schemaMatch = line.match(/const\s+(\w+Schema)\s*=\s*z\./);
    if (schemaMatch) {
      let braceDepth = countChar(line, '{') - countChar(line, '}');
      let src = line.trim();
      i++;
      while (i < lines.length && braceDepth > 0) {
        const cl = lines[i];
        src += '\n' + cl;
        braceDepth += countChar(cl, '{') - countChar(cl, '}');
        i++;
      }
      schemaDecls.push({ name: schemaMatch[1], source: src });
      continue;
    }

    // Capture regex/const variables used by schemas
    // We need to check if any schema references this variable
    const auxMatch = line.match(/^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(.+)$/);
    if (auxMatch && !auxMatch[1].endsWith('Schema')) {
      auxVars.push({ name: auxMatch[1], line: line });
    }

    i++;
  }

  if (schemaDecls.length === 0) return;

  // Filter aux vars that are actually referenced by any schema
  const allSchemaSource = schemaDecls.map(d => d.source).join('\n');
  const neededAux = auxVars.filter(av => allSchemaSource.includes(av.name));

  // Write temp module
  const tempDir = path.join(BACKEND_ROOT, '.temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, `${mod}-schemas.ts`);

  let temp = `import { z } from 'zod';\n\n`;
  for (const aux of neededAux) temp += aux.line + '\n';
  temp += '\n';
  for (const d of schemaDecls) temp += `export ${d.source}\n\n`;

  fs.writeFileSync(tempFile, temp);

  try {
    const modExports = await import(`file://${tempFile}`);
    zodSchemasByModule[mod] = {};

    for (const d of schemaDecls) {
      const val = modExports[d.name];
      if (val && typeof val === 'object' && '_def' in val) {
        try {
          const js = zodToJsonSchema(val);
          zodSchemasByModule[mod][d.name] = js;
        } catch {
          // If refine/effect causes issues, skip
        }
      }
    }
  } catch (e: any) {
    console.warn(`  ⚠ Schema extraction failed for ${mod}: ${e.message}`);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

// ── Step 4: Extract backend types ───────────────────────────────────

function extractBackendTypes(mod: string): void {
  const base = path.join(BACKEND_ROOT, 'src/modules', mod);
  const candidates = [
    path.join(base, `${mod}.types.ts`),
    path.join(base, `types.ts`),
  ];

  for (const fp of candidates) {
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf8');

    const decls: string[] = [];
    const lines = content.split('\n');
    let j = 0;
    while (j < lines.length) {
      const l = lines[j];
      if (/^\s*export\s+(interface|type|const\s*enum)\s/.test(l)) {
        const block: string[] = [l];
        let depth = countChar(l, '{') - countChar(l, '}');
        j++;
        while (j < lines.length) {
          const cl = lines[j];
          block.push(cl);
          depth += countChar(cl, '{') - countChar(cl, '}');
          if (depth <= 0) break;
          j++;
        }
        decls.push(block.join('\n'));
      }
      j++;
    }

    if (decls.length > 0) {
      typesByModule[mod] = decls.join('\n\n');
      return;
    }
  }
}

// ── Step 5: Drift detection ─────────────────────────────────────────

function detectDrift(): void {
  for (const [mod, expected] of Object.entries(MODULE_TO_FEATURE)) {
    const missing: string[] = [];

    if (expected.api) {
      const fp = path.join(FRONTEND_ROOT, expected.api);
      if (!fs.existsSync(fp)) {
        missing.push(`${expected.api} (missing)`);
      } else if (fs.readFileSync(fp, 'utf8').trim().length === 0) {
        missing.push(`${expected.api} (empty)`);
      }
    }

    if (expected.types) {
      const fp = path.join(FRONTEND_ROOT, expected.types);
      if (!fs.existsSync(fp)) {
        missing.push(`${expected.types} (missing)`);
      } else if (fs.readFileSync(fp, 'utf8').trim().length === 0) {
        missing.push(`${expected.types} (empty)`);
      }
    }

    if (missing.length > 0) {
      driftReports.push({ module: mod, missing });
    }
  }
}

// ── Step 6: Write outputs ───────────────────────────────────────────

function writeOutputs(): void {
  if (!fs.existsSync(INVENTORY_DIR)) fs.mkdirSync(INVENTORY_DIR, { recursive: true });
  if (!fs.existsSync(GENERATED_TYPES_DIR)) fs.mkdirSync(GENERATED_TYPES_DIR, { recursive: true });

  const totalEps = Object.values(modules).reduce((s, m) => s + m.endpoints.length, 0);

  // ─ Markdown ─
  let md = `# API Endpoint Inventory\n\n`;
  md += `**Generated:** ${new Date().toISOString()}  |  **Total:** ${totalEps} endpoints\n\n`;

  if (driftReports.length > 0) {
    md += `## Drift Report — Missing Frontend Coverage\n\n`;
    md += `| Module | Missing |\n|---|---|\n`;
    for (const d of driftReports) {
      md += `| ${d.module} | ${d.missing.join('<br>')} |\n`;
    }
    md += '\n';
  }

  for (const [name, mod] of Object.entries(modules)) {
    if (mod.endpoints.length === 0) continue;
    md += `## ${name} (\`${mod.basePath}\`)\n\n`;
    md += `| Method | Path | Auth | Roles | Middleware | Handler | Schemas |\n`;
    md += `|---|---|---|---|---|---|---|\n`;
    for (const ep of mod.endpoints) {
      const auth = ep.middlewares.includes('authGuard') ? '✓' : '—';
      const roles = ep.roles.length > 0 ? ep.roles.join(', ') : '—';
      const mw = ep.middlewares.filter(x => x !== 'authGuard' && x !== 'validate').join(', ') || '—';
      const schemas = ep.schemas.length > 0 ? ep.schemas.join(', ') : '—';
      md += `| ${ep.method} | \`${ep.path}\` | ${auth} | ${roles} | ${mw} | ${ep.handler} | ${schemas} |\n`;
    }
    md += '\n';
  }

  fs.writeFileSync(path.join(INVENTORY_DIR, 'endpoint-inventory.md'), md);

  // ─ JSON ─
  const jsonPayload: any = {
    generatedAt: new Date().toISOString(),
    totalEndpoints: totalEps,
    modules: {},
  };
  for (const [name, mod] of Object.entries(modules)) {
    jsonPayload.modules[name] = {
      basePath: mod.basePath,
      endpoints: mod.endpoints,
    };
  }
  fs.writeFileSync(path.join(INVENTORY_DIR, 'endpoint-inventory.json'), JSON.stringify(jsonPayload, null, 2));

  // ─ Schemas JSON ─
  for (const [mod, schemas] of Object.entries(zodSchemasByModule)) {
    const jsonPath = path.join(GENERATED_TYPES_DIR, `${mod}-schemas.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(schemas, null, 2));
  }

  // ─ Frontend types from backend .types.ts ─
  const indexExports: string[] = [];
  for (const [mod, decl] of Object.entries(typesByModule)) {
    const fp = path.join(GENERATED_TYPES_DIR, `${mod}.ts`);
    const header = `// Auto-generated from backend \`${mod}.types.ts\`\n// Do not edit — run \`npm run inventory\` in backend to regenerate.\n\n`;
    fs.writeFileSync(fp, header + decl + '\n');
    indexExports.push(`export * from './${mod}';`);
  }

  if (indexExports.length > 0) {
    fs.writeFileSync(path.join(GENERATED_TYPES_DIR, 'index.ts'), indexExports.join('\n') + '\n');
  } else if (!fs.existsSync(path.join(GENERATED_TYPES_DIR, 'index.ts'))) {
    fs.writeFileSync(path.join(GENERATED_TYPES_DIR, 'index.ts'), '// No generated types yet\n');
  }

  // ─ Drift JSON ─
  if (driftReports.length > 0) {
    fs.writeFileSync(path.join(INVENTORY_DIR, 'drift-report.json'), JSON.stringify(driftReports, null, 2));
  }

  // Console summary
  console.log(`\n📦 Output files:`);
  console.log(`   ${INVENTORY_DIR}/endpoint-inventory.md`);
  console.log(`   ${INVENTORY_DIR}/endpoint-inventory.json`);
  if (driftReports.length > 0) console.log(`   ${INVENTORY_DIR}/drift-report.json`);
  const schemaMods = Object.keys(zodSchemasByModule);
  if (schemaMods.length > 0) console.log(`   ${GENERATED_TYPES_DIR}/*-schemas.json (${schemaMods.length} modules)`);
  const typeMods = Object.keys(typesByModule);
  if (typeMods.length > 0) console.log(`   ${GENERATED_TYPES_DIR}/*.ts (${typeMods.length} type files)`);
  if (driftReports.length > 0) {
    console.log(`\n⚠ Drift: ${driftReports.length} module(s) have missing/empty frontend files`);
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Generating endpoint inventory...\n');

  parseApp();
  const modNames = Object.keys(modules);
  console.log(`📋 Found ${modNames.length} modules: ${modNames.join(', ')}\n`);

  for (const mod of modNames) {
    console.log(`📁 ${mod} (${modules[mod].basePath})`);
    parseRouteFile(mod);
    console.log(`   ${modules[mod].endpoints.length} endpoints`);

    await extractZodSchemas(mod);
    const sc = Object.keys(zodSchemasByModule[mod] || {}).length;
    if (sc > 0) console.log(`   ${sc} Zod schemas → JSON Schema`);

    extractBackendTypes(mod);
    if (typesByModule[mod]) console.log(`   Types extracted`);
  }

  detectDrift();
  writeOutputs();
  console.log('\n✅ Done.');
}

main().catch(err => {
  console.error('❌', err);
  process.exit(1);
});
