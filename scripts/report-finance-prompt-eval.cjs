const fs = require('node:fs');
const path = require('node:path');
const { dir, root, read, save, hash } = require('./prompt-eval.cjs');
const versions = ['baseline', 'optimized-final'];
const labels = { baseline: '旧版', 'optimized-final': '优化版' };
const judgeKey = version => version === 'baseline' ? 'baseline' : 'optimized';
const round1 = value => Math.round((value + Number.EPSILON) * 10) / 10;
const cell = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
function callFiles(directory) {
  return fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => name.endsWith('.json')).map(name => read(path.join(directory, name))) : [];
}
function inspect(result, calls, version, fixture) {
  const problems = [];
  const final = result.finalResume;
  const entries = [...final.workExperience, ...final.projectExperience, ...final.campusExperience];
  for (const exp of result.experienceAssessments.filter(x => ['work','internship','project','campus'].includes(x.experienceType) && x.userDecision !== 'remove')) {
    if (!entries.some(x => x.sourceExperienceId === exp.experienceId)) problems.push('缺少经历ID：' + exp.experienceTitle);
  }
  if (!Number.isInteger(result.rawFinalResumeScore) || result.rawFinalResumeScore < 0 || result.rawFinalResumeScore > 100) problems.push('原始模型评分无效：' + JSON.stringify(result.rawFinalResumeScore));
  if (result.interviewPrep.likelyQuestions.length !== 10) problems.push('面试题数量：' + result.interviewPrep.likelyQuestions.length + '，要求10');
  const groups = new Map();
  for (const q of result.originalQuestions) groups.set(q.experienceId, (groups.get(q.experienceId) || 0) + 1);
  if ([...groups.values()].some(x => x > 3)) problems.push('同一经历追问超过3条');
  if (fixture.answerMode === 'skip' && result.followUpQuestions.some(q => q.userAnswer || q.generatedBullet)) problems.push('跳过追问却新增答案');
  if (version === 'optimized-final') {
    const expected = JSON.stringify(result.jdAnalysis.idealCandidate).slice(1, -1);
    for (const stage of ['diagnosis-match','experience-inventory','follow-ups','optimized-items','final-resume','interview']) {
      if (!calls.some(x => x.stage === stage && x.httpStatus === 200 && x.request.messages[1].content.includes(expected))) problems.push('请求未复用岗位画像：' + stage);
    }
    for (const q of result.followUpQuestions.filter(q => q.userAnswer)) {
      if (!calls.some(x => x.stage === 'final-score' && x.request.messages[1].content.includes(q.userAnswer))) problems.push('评分未收到回答：' + q.id);
    }
  }
  return problems;
}
function resumeText(r) {
  const lines = ['**' + r.personalInfo.name + '**', '', '求职意向：' + r.jobIntent, '', r.summary || '', '', '能力：' + r.coreSkills.join('；'), ''];
  for (const [title, entries] of [['工作／实习',r.workExperience],['项目',r.projectExperience],['校园',r.campusExperience]]) {
    if (!entries.length) continue;
    lines.push('### ' + title, '');
    for (const entry of entries) lines.push('**' + [entry.company || entry.name || entry.organization,entry.role,entry.period].join('｜') + '**', '', ...entry.bullets.map(x => '- ' + x), '');
  }
  lines.push('技能工具：' + r.skillsAndTools.join('；'), '', '获奖／证书：' + (r.awardsAndCertificates?.join('；') || '空'), '', '教育：' + Object.values(r.education).join('｜'));
  return lines.join('\n');
}
async function main() {
  const fixtures = read(path.join(dir, 'cases.json'));
  const manifest = read(path.join(dir, 'optimized-final/manifest.json'));
  const previousRoot = path.join(root, 'evals/part2-20260914');
  for (const version of versions) {
    const currentManifest = read(path.join(dir, version, 'manifest.json'));
    const previousManifest = read(path.join(previousRoot, version, 'manifest.json'));
    for (const [file, expected] of Object.entries(currentManifest.files)) {
      if (expected !== previousManifest.files[file] || hash(fs.readFileSync(path.join(dir, version, file + '.snapshot'))) !== expected) throw new Error('Frozen version mismatch: ' + version + '/' + file);
    }
  }
  for (const [file, expected] of Object.entries(manifest.files)) if (hash(fs.readFileSync(path.join(root, file))) !== expected) throw new Error('Application source changed during test: ' + file);
  const rows = [];
  for (const fixture of fixtures) {
    const results = Object.fromEntries(versions.map(v => [v, read(path.join(dir, 'runs', v, fixture.id, 'result.json'))]));
    const rounds = [1,2].map(n => read(path.join(dir, 'judgments-final', fixture.id, 'round-' + n, 'result.json')));
    const quality = Object.fromEntries(versions.map(v => [v, round1(rounds.reduce((s,r) => s + r.scores[judgeKey(v)], 0) / 2)]));
    const checks = Object.fromEntries(versions.map(v => [v, inspect(results[v], callFiles(path.join(dir, 'runs', v, fixture.id, 'calls')), v, fixture)]));
    const scores = Object.fromEntries(versions.map(v => [v, { original: results[v].diagnosis.overallScore, raw: results[v].rawFinalResumeScore, displayed: results[v].finalResumeScore }]));
    rows.push({ id: fixture.id, name: fixture.name, quality, difference: round1(quality['optimized-final']-quality.baseline), scores, rounds: rounds.map(r => r.scores), checks, counts: Object.fromEntries(versions.map(v => [v, { questions:results[v].originalQuestions.length, interviews:results[v].interviewPrep.likelyQuestions.length }])) });
    const detail = ['# ' + fixture.name, '', '所有人物、公司、数据与招聘要求均为虚构评测材料；招聘要求不代表行业通用资质标准。', '', '## 核查重点', '', ...fixture.focus.map(x => '- ' + x), '', '## JD', '', fixture.input.jobDescription, '', '## 原始简历', '', fixture.input.originalResume, '', '## 初始补充', '', fixture.input.additionalInfo, '', '## 固定回答事实库', '', fixture.answerMode === 'skip' ? '完全跳过追问，无新增答案。' : fixture.answerBank.map(x => '- ' + x.answer).join('\n')];
    for (const v of versions) {
      const result = results[v];
      detail.push('', '## ' + labels[v] + '最终简历', '', resumeText(result.finalResume), '', '## ' + labels[v] + '追问与实际回答', '');
      for (const q of result.followUpQuestions) detail.push('**' + q.question + '**', '', '目的：' + q.purpose, '', '实际回答：' + (q.userAnswer || '未回答'), '');
      detail.push('## ' + labels[v] + '面试准备', '');
      for (const q of result.interviewPrep.likelyQuestions) detail.push('**' + q.question + '**', '', q.suggestedAnswer, '', '需准备：' + q.evidenceNeeded.join('；'), '');
      detail.push('自我介绍：' + result.interviewPrep.selfIntroduction, '');
    }
    detail.push('## 双顺序盲评', '');
    rounds.forEach((r,i) => {
      detail.push('### 第' + (i+1) + '轮', '', r.judgment.comparison, '');
      for (const label of ['A','B']) detail.push('**' + r.order[label] + '：' + r.scores[r.order[label]] + '**', '', ...r.judgment[label].weaknesses.map(x => '- ' + x), '', ...r.judgment[label].criticalFabrications.map(x => '- 评审标记的严重问题（需核对）：“' + x.quote + '”；' + x.reason), '');
    });
    const output = path.join(dir, 'case-reports', fixture.id + '.md'); fs.mkdirSync(path.dirname(output), {recursive:true}); fs.writeFileSync(output, detail.join('\n'));
  }
  const averages = Object.fromEntries(versions.map(v => [v, round1(rows.reduce((s,r) => s + r.quality[v], 0)/rows.length)]));
  const stats = Object.fromEntries(versions.map(v => {
    const calls = fixtures.flatMap(f => callFiles(path.join(dir, 'runs', v, f.id, 'calls')));
    return [v, { requests: calls.length, success: calls.filter(x => x.httpStatus === 200).length, repairs: calls.filter(x => x.request.messages[0].content.includes('JSON 修复器')).length, failures: calls.filter(x => x.error || x.httpStatus !== 200).length, promptTokens: calls.reduce((s,x) => s+(x.response?.usage?.prompt_tokens||0),0), completionTokens: calls.reduce((s,x) => s+(x.response?.usage?.completion_tokens||0),0), responseModels: [...new Set(calls.map(x => x.response?.model).filter(Boolean))] }];
  }));
  save(path.join(dir, 'summary.json'), { averages, rows, stats, sourceUnchanged: true, sourceSuite: 'part2-20260914', caseCount: fixtures.length });
  const metadata = read(path.join(dir, 'runs/baseline/metadata.json'));
  const lines = ['# 金融、财会、审计：冻结提示词的真实模型对照测试', '', '请求模型：' + metadata.provider.model + '；响应模型标识：' + stats.baseline.responseModels.join('、') + '。全部生成与盲评均调用项目现有真实接口，没有使用Mock。', '', '## 方法与范围', '', '- 三个方向各1组：金融选取对公信用风险分析，财会选取总账会计，审计选取校招审计助理。不能代表全部金融、财会或审计岗位。', '- 比较上一轮冻结的旧版baseline与优化版optimized-final，64个源文件的快照哈希逐一核对一致。本轮未修改应用源码、提示词、评分规则或兜底，也未根据本轮样例调优后择优重测。', '- 每组每版完成8阶段：JD解析、诊断匹配、经历盘点、追问、优化项、最终简历、产品评分、面试准备。金融例完全跳过追问，财会和审计按预先固定的事实库回答；未点击可选的单条Bullet生成。', '- 同一份事实库用于两版，具体交付的回答随各版追问不同而变化；实际回答与原始请求全部保存，评审按各阶段可见的材料判断。', '- 沿用上轮盲评规则和权重：真实性30%、需求识别20%、证据表达15%、聚焦可读性15%、面试准备10%、追问10%。隐藏版本及产品分数，两次评审交换A/B顺序；每维0–100分，总分由代码计算。', '', '## 输出质量分（两轮均值）', '', '| 方向 | 旧版 | 优化版 | 差值 |', '|---|---:|---:|---:|', ...rows.map(r => '| [' + cell(r.name) + '](case-reports/' + r.id + '.md) | ' + r.quality.baseline.toFixed(1) + ' | ' + r.quality['optimized-final'].toFixed(1) + ' | ' + (r.difference>=0?'+':'') + r.difference.toFixed(1) + ' |'), '| 平均 | ' + averages.baseline.toFixed(1) + ' | ' + averages['optimized-final'].toFixed(1) + ' | ' + (averages['optimized-final']>=averages.baseline?'+':'') + round1(averages['optimized-final']-averages.baseline).toFixed(1) + ' |', '', '质量分衡量输出是否忠于材料并有效表达，不等于候选人匹配分，不受产品评分兜底影响。', '', '## 两轮原始评审分', '', '| 方向 | 旧版第1／第2轮 | 优化版第1／第2轮 |', '|---|---:|---:|', ...rows.map(r => '| '+cell(r.name)+' | '+r.rounds.map(x=>x.baseline).join(' / ')+' | '+r.rounds.map(x=>x.optimized).join(' / ')+' |'), '', '每个方向仅1个样例、每版1次成功生成；同模型盲评仍可能有顺序偏好、评分波动或判断错误。新行业样例在冻结后才构造，有助于观察跨行业表现，但不能据此证明统计显著性或实际面试效果。', '', '## 产品评分：诊断 → 最终模型原始分 → 兜底展示分', '', '| 方向 | 旧版 | 优化版 |', '|---|---|---|', ...rows.map(r => '| '+cell(r.name)+' | '+Object.values(r.scores.baseline).join(' → ')+' | '+Object.values(r.scores['optimized-final']).join(' → ')+' |'), '', '两版初始诊断独立生成，因此兜底基准也可能不同；产品分差不能直接解释为提示词的质量差。', '', '## 结构与信息流检查', '', '| 方向 | 旧版追问／面试 | 优化版追问／面试 | 问题 |', '|---|---:|---:|---|', ...rows.map(r => '| '+cell(r.name)+' | '+r.counts.baseline.questions+' / '+r.counts.baseline.interviews+' | '+r.counts['optimized-final'].questions+' / '+r.counts['optimized-final'].interviews+' | '+cell(versions.flatMap(v=>r.checks[v].map(x=>labels[v]+'：'+x)).join('；')||'检查通过')+' |'), '', '检查包含经历ID保留、每段最多3问、跳过追问无新增答案、10道面试题、有效原始评分、优化版六个阶段复用岗位画像、评分阶段接收真实补充答案。结构检查不是专业事实正确性的保证。', '', '## 执行统计', '', '| 版本 | 请求数 | HTTP 200 | 失败 | JSON修复 | 输入Token | 输出Token |', '|---|---:|---:|---:|---:|---:|---:|', ...versions.map(v=>'| '+labels[v]+' | '+[stats[v].requests,stats[v].success,stats[v].failures,stats[v].repairs,stats[v].promptTokens,stats[v].completionTokens].join(' | ')+' |'), '', '以上仅生成流程，Token含provider报告的推理Token，不含6次双顺序盲评。请求正文、原始响应、usage、状态及耗时均保留；没有保存API Key或Authorization头。', '', '## 文件', '', '- cases.json：固定的模拟简历、JD、回答事实库。', '- case-reports/：各例两版简历、追问答案、面试准备与盲评意见。', '- runs/：各阶段检查点和真实API响应。', '- judgments-final/：双顺序盲评原始结果。', '- summary.json：机器可读汇总。', '- baseline/、optimized-final/：与上轮逐字节一致的源文件快照。', '', '复跑命令（默认复用已完成结果，不重复生成）：', '', '```powershell', 'node scripts/finance-prompt-eval.cjs run baseline', 'node scripts/finance-prompt-eval.cjs run optimized-final', 'node scripts/finance-prompt-eval.cjs judge', 'node scripts/finance-prompt-eval.cjs report', '```', ''];
  const observations = path.join(dir, 'observations.md');
  if (fs.existsSync(observations)) lines.splice(lines.indexOf('## 执行统计'), 0, fs.readFileSync(observations,'utf8'), '');
  fs.writeFileSync(path.join(dir, 'REPORT.md'), lines.join('\n'));
  console.log(JSON.stringify({averages,rows,stats},null,2));
}
module.exports = { main };
