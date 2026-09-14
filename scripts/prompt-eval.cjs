/* Real-provider evaluation. Never imports the mock router; no credentials are saved. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const suite = process.env.PROMPT_EVAL_SUITE || 'part2-20260914';
if (!/^[a-z0-9-]+$/.test(suite)) throw new Error('Invalid evaluation suite');
const dir = path.join(root, 'evals', suite);
const mode = process.argv[2] || 'check';
const variant = process.argv[3] || (mode === 'freeze' ? 'optimized-final' : 'baseline');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function save(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
const baseline = read(path.join(dir, 'baseline/manifest.json'));
function loadSource(sourceRoot, suffix = '') {
  const cache = new Map();
  function load(relative) {
    const filename = path.join(sourceRoot, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename + suffix, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }, fileName: filename }).outputText;
    const module = { exports: {} }; cache.set(filename, module);
    const localRequire = specifier => {
      if (specifier.startsWith('@/') || specifier.startsWith('.')) {
        const requested = specifier.startsWith('@/') ? 'src/' + specifier.slice(2) : path.relative(sourceRoot, path.resolve(path.dirname(filename), specifier));
        const resolved = [requested, requested + '.ts', requested + '.tsx', requested + '/index.ts'].find(p => fs.existsSync(path.join(sourceRoot, p) + suffix));
        if (!resolved) throw new Error('Unresolved source: ' + specifier);
        return load(resolved);
      }
      return createRequire(path.join(root, 'package.json'))(specifier);
    };
    vm.runInThisContext('(function(require,module,exports,__filename,__dirname){' + output + '\n})', { filename })(localRequire, module, module.exports, filename, path.dirname(filename));
    return module.exports;
  }
  return load;
}
const contexts = new AsyncLocalStorage();
let nativeFetch;
function configureProvider() {
  require('@next/env').loadEnvConfig(root);
  if (!process.env.LLM_API_KEY?.trim()) throw new Error('LLM_API_KEY missing; real evaluation cannot run.');
  process.env.USE_MOCK_AI = 'false';
  process.env.AI_RESPONSE_LOG_ENABLED = 'false';
  nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    const context = contexts.getStore();
    const request = JSON.parse(options.body);
    const started = Date.now();
    const id = context ? ++context.calls : 0;
    try {
      const response = await nativeFetch(url, { ...options, signal: AbortSignal.timeout(240000) });
      const raw = await response.text();
      let body; try { body = JSON.parse(raw); } catch { body = { raw }; }
      if (context) save(path.join(context.outputDir, 'calls', String(id).padStart(3, '0') + '.json'), { stage: context.stage, startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started, httpStatus: response.status, request, response: body });
      return new Response(raw, { status: response.status, headers: { 'content-type': 'application/json' } });
    } catch (error) {
      if (context) save(path.join(context.outputDir, 'calls', String(id).padStart(3, '0') + '.json'), { stage: context.stage, startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started, request, error: String(error) });
      throw error;
    }
  };
  const config = loadSource(root)('src/lib/ai/config.ts').getAIConfig();
  console.log(JSON.stringify({ provider: config.provider, model: config.model, mode: config.mode, endpoint: config.baseUrl }));
  return { provider: config.provider, model: config.model, endpoint: config.baseUrl };
}
async function retry(fn, label) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (error) {
      if (attempt >= 3 || !/429|50[0234]|fetch failed|timeout|aborted/i.test(String(error))) throw error;
      console.log(label + ' retry ' + attempt);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}
function verifySnapshot() {
  for (const [file, expected] of Object.entries(baseline.files)) {
    if (hash(fs.readFileSync(path.join(dir, 'baseline', file + '.snapshot'))) !== expected) throw new Error('Baseline hash mismatch: ' + file);
  }
}
async function generateCase(fixture, provider) {
  const outputDir = path.join(dir, 'runs', variant, fixture.id);
  if (fs.existsSync(path.join(outputDir, 'result.json'))) { console.log('Already complete: ' + variant + '/' + fixture.id); return; }
  const sourceRoot = path.join(dir, variant);
  const load = loadSource(sourceRoot, '.snapshot');
  const api = load('src/services/ai/resumeAgent.llm.ts');
  const context = { outputDir, calls: fs.existsSync(path.join(outputDir, 'calls')) ? fs.readdirSync(path.join(outputDir, 'calls')).length : 0, stage: '' };
  await contexts.run(context, async () => {
    const started = Date.now();
    let checkpoint = fs.existsSync(path.join(outputDir, 'analysis.json')) ? read(path.join(outputDir, 'analysis.json')) : {};
    for (const stage of ['jd', 'diagnosis-match', 'experience-inventory', 'follow-ups']) {
      context.stage = stage;
      checkpoint = await retry(() => api.runLLMResumeAnalysisStage(fixture.input, stage, checkpoint), fixture.id + '/' + stage);
      save(path.join(outputDir, 'analysis.json'), checkpoint);
      console.log(variant + '/' + fixture.id + ': ' + stage + ' complete');
    }
    const originalQuestions = structuredClone(checkpoint.followUpQuestions);
    if (fixture.answerMode === 'answer') {
      for (const question of checkpoint.followUpQuestions) {
        const experience = checkpoint.experienceAssessments.find(x => x.experienceId === question.experienceId);
        const label = [question.experienceTitle, question.question, experience?.organization, experience?.originalBullets?.join(' ')].join(' ');
        const evidence = fixture.answerBank.filter(item => new RegExp(item.match, 'i').test(label));
        question.userAnswer = evidence.length ? evidence.map(item => item.answer).join('\n') : '这个细节无法确认，没有额外可验证信息。';
        // The normal UI can submit answers directly without the optional bullet-generation button.
        question.generatedBullet = '';
      }
    }
    const targetingContext = { jdAnalysis: checkpoint.jdAnalysis, matchItems: checkpoint.matchItems };
    save(path.join(outputDir, 'answered-analysis.json'), checkpoint);
    let optimized = fs.existsSync(path.join(outputDir, 'optimization.json')) ? read(path.join(outputDir, 'optimization.json')) : {};
    for (const stage of ['optimized-items', 'final-resume', 'final-score', 'interview']) {
      context.stage = stage;
      optimized = await retry(() => api.runLLMResumeOptimizationStage(fixture.input, 'professional-match', checkpoint.diagnosis, checkpoint.followUpQuestions, checkpoint.experienceAssessments, stage, optimized, targetingContext), fixture.id + '/' + stage);
      save(path.join(outputDir, 'optimization.json'), optimized);
      console.log(variant + '/' + fixture.id + ': ' + stage + ' complete');
    }
    const calls = fs.readdirSync(path.join(outputDir, 'calls')).map(name => read(path.join(outputDir, 'calls', name)));
    const scoreCall = calls.findLast(call => call.stage === 'final-score' && call.response?.choices?.[0]?.message?.content);
    let rawScore = null;
    try { rawScore = JSON.parse(scoreCall.response.choices[0].message.content).overallScore; } catch { /* raw response remains available */ }
    save(path.join(outputDir, 'result.json'), { caseId: fixture.id, variant, provider, elapsedMs: Date.now() - started, originalQuestions, ...checkpoint, ...optimized, rawFinalResumeScore: rawScore });
  });
}
async function pool(items, concurrency, fn) {
  let next = 0; const failures = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try { await fn(item); } catch (error) { failures.push({ id: item.id, error: String(error).replaceAll(process.env.LLM_API_KEY || '\0', '[REDACTED]') }); console.error('FAILED ' + item.id + ': ' + failures.at(-1).error); }
    }
  }));
  if (failures.length) { save(path.join(dir, 'failures-' + mode + '-' + variant + '.json'), failures); process.exitCode = 1; }
}
async function main() {
  verifySnapshot();
  if (mode === 'check') { console.log('Baseline hashes verified; ' + Object.keys(baseline.files).length + ' files.'); return; }
  if (mode === 'freeze') {
    if (!/^optimized(?:-final)?$/.test(variant)) throw new Error('Invalid snapshot name');
    const destination = path.join(dir, variant);
    if (fs.existsSync(destination)) throw new Error('Optimized snapshot already exists.');
    const files = {};
    for (const file of Object.keys(baseline.files)) {
      const data = fs.readFileSync(path.join(root, file)); files[file] = hash(data);
      const output = path.join(destination, file + '.snapshot'); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, data);
    }
    save(path.join(destination, 'manifest.json'), { files });
    console.log('Optimized snapshot frozen.'); return;
  }
  if (mode === 'rollback-check' || mode === 'rollback') {
    const optimized = read(path.join(dir, 'optimized-final/manifest.json'));
    const changed = Object.keys(baseline.files).filter(file => baseline.files[file] !== optimized.files[file]);
    for (const file of changed) {
      if (hash(fs.readFileSync(path.join(root, file))) !== optimized.files[file]) throw new Error('File changed since evaluation; refusing to overwrite: ' + file);
    }
    if (mode === 'rollback') for (const file of changed) fs.copyFileSync(path.join(dir, 'baseline', file + '.snapshot'), path.join(root, file));
    console.log((mode === 'rollback' ? 'Restored ' : 'Safe to restore ') + changed.length + ' files; score-policy unchanged: ' + (baseline.files['src/lib/ai/score-policy.ts'] === optimized.files['src/lib/ai/score-policy.ts'])); return;
  }
  if (mode !== 'run' || !['baseline', 'optimized', 'optimized-final'].includes(variant)) throw new Error('Usage: node scripts/prompt-eval.cjs check|freeze|rollback-check|rollback|run baseline|run optimized-final');
  const provider = configureProvider();
  save(path.join(dir, 'runs', variant, 'metadata.json'), { provider, baselineCommit: baseline.commit, startedAt: new Date().toISOString(), casesHash: hash(fs.readFileSync(path.join(dir, 'cases.json'))), sourceManifest: read(path.join(dir, variant, 'manifest.json')) });
  await pool(read(path.join(dir, 'cases.json')), 3, fixture => generateCase(fixture, provider));
}
if (require.main === module) main().catch(error => { console.error(String(error).replaceAll(process.env.LLM_API_KEY || '\0', '[REDACTED]')); process.exitCode = 1; });
module.exports = { root, dir, loadSource, configureProvider, contexts, save, read, pool, retry, hash, main };
