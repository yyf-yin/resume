const fs = require('node:fs');
const path = require('node:path');
const { dir, root, read, save, hash } = require('./prompt-eval.cjs');
const fixtures = read(path.join(dir, 'cases.json'));
const versions = ['baseline', 'optimized'];
const generationDirectory = version => version === 'optimized' ? 'optimized-final' : 'baseline';
const round1 = value => Math.round(value * 10) / 10;
const signed = value => (value > 0 ? '+' : '') + value.toFixed(1);
const md = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const baseline = read(path.join(dir, 'baseline/manifest.json'));
const optimized = read(path.join(dir, 'optimized-final/manifest.json'));
for (const [file, expected] of Object.entries(optimized.files)) {
  if (hash(fs.readFileSync(path.join(root, file))) !== expected) throw new Error('Current source differs from evaluated source: ' + file);
  if (hash(fs.readFileSync(path.join(dir, 'optimized-final', file + '.snapshot'))) !== expected) throw new Error('Frozen source mismatch: ' + file);
}
if (baseline.files['src/lib/ai/score-policy.ts'] !== optimized.files['src/lib/ai/score-policy.ts']) throw new Error('Score floor changed unexpectedly');
function callsFor(version, id) { const p = path.join(dir, 'runs', generationDirectory(version), id, 'calls'); return fs.readdirSync(p).map(name => read(path.join(p, name))); }
function validate(result, calls, version, fixture) {
  const failures = [];
  const entries = [...result.finalResume.workExperience, ...result.finalResume.projectExperience, ...result.finalResume.campusExperience];
  const retained = result.experienceAssessments.filter(x => ['work', 'internship', 'project', 'campus'].includes(x.experienceType) && x.userDecision !== 'remove');
  for (const item of retained) if (!entries.some(x => x.sourceExperienceId === item.experienceId)) failures.push('经历ID未完整保留：' + item.experienceTitle);
  if (result.interviewPrep.likelyQuestions.length !== 10) failures.push('面试问题数量为' + result.interviewPrep.likelyQuestions.length + '，要求10');
  if (!Number.isInteger(result.rawFinalResumeScore) || result.rawFinalResumeScore < 0 || result.rawFinalResumeScore > 100) failures.push('模型评分无效：' + JSON.stringify(result.rawFinalResumeScore) + '；展示分由现有兜底产生');
  const groups = new Map();
  for (const q of result.originalQuestions) groups.set(q.experienceId, (groups.get(q.experienceId) || 0) + 1);
  if ([...groups.values()].some(n => n > 3)) failures.push('单段经历追问超过3条');
  if (fixture.answerMode === 'skip' && result.followUpQuestions.some(q => q.userAnswer || q.generatedBullet)) failures.push('跳过追问样例被添加了回答');
  if (fixture.id === '04-campus' && (result.finalResume.projectExperience.length !== 5 || result.finalResume.campusExperience.length !== 1 || result.finalResume.workExperience.length !== 0)) failures.push('校招五项目、一校园、零实习的边界不符');
  if (version === 'optimized') {
    for (const q of result.followUpQuestions.filter(q => q.userAnswer)) {
      const scoreRequest = calls.findLast(call => call.stage === 'final-score' && call.request.messages[0].content !== '你是 JSON 修复器。将输入修复为合法 JSON，只输出 JSON，不要任何解释。');
      if (!scoreRequest?.request.messages[1].content.includes(q.userAnswer)) failures.push('评分请求缺少一条真实追问回答');
    }
    const escaped = JSON.stringify(result.jdAnalysis.idealCandidate).slice(1, -1);
    for (const stage of ['diagnosis-match', 'experience-inventory', 'follow-ups', 'optimized-items', 'final-resume', 'interview']) {
      const found = calls.some(call => call.stage === stage && call.httpStatus === 200 && call.request.messages[1].content.includes(escaped));
      if (!found) failures.push('真实请求中未找到统一岗位画像：' + stage);
    }
  }
  return failures;
}
function resumeText(resume) {
  const lines = ['**' + resume.personalInfo.name + '**', '', '求职意向：' + resume.jobIntent];
  if (resume.summary) lines.push('', resume.summary);
  lines.push('', '能力：' + resume.coreSkills.join('；'));
  for (const [title, entries] of [['工作／实习经历', resume.workExperience], ['项目经历', resume.projectExperience], ['校园经历', resume.campusExperience]]) {
    if (!entries.length) continue;
    lines.push('', '### ' + title, '');
    for (const entry of entries) lines.push('**' + (entry.company || entry.name || entry.organization) + '｜' + entry.role + '｜' + entry.period + '**', '', ...entry.bullets.map(text => '- ' + text), '');
  }
  lines.push('技能工具：' + resume.skillsAndTools.join('；'), '', '教育：' + [resume.education.school, resume.education.degree, resume.education.period].join('｜'));
  return lines.join('\n');
}
const rows = [];
for (const fixture of fixtures) {
  const results = Object.fromEntries(versions.map(version => [version, read(path.join(dir, 'runs', generationDirectory(version), fixture.id, 'result.json'))]));
  const judgments = [1, 2].map(round => read(path.join(dir, 'judgments-final', fixture.id, 'round-' + round, 'result.json')));
  const scores = Object.fromEntries(versions.map(version => [version, round1(judgments.reduce((sum, item) => sum + item.scores[version], 0) / judgments.length)]));
  const validation = Object.fromEntries(versions.map(version => [version, validate(results[version], callsFor(version, fixture.id), version, fixture)]));
  rows.push({ id: fixture.id, name: fixture.name, scores, delta: round1(scores.optimized - scores.baseline), rounds: judgments.map(x => x.scores), productScores: Object.fromEntries(versions.map(v => [v, { original: results[v].diagnosis.overallScore, raw: results[v].rawFinalResumeScore, displayed: results[v].finalResumeScore }])), counts: Object.fromEntries(versions.map(v => [v, { followUps: results[v].originalQuestions.length, interviews: results[v].interviewPrep.likelyQuestions.length, projects: results[v].finalResume.projectExperience.length }])), validation });
  const details = ['# ' + fixture.name, '', '所有人物、公司、岗位及数据均为模拟测试材料。', '', '## 输入 JD', '', fixture.input.jobDescription, '', '## 原始简历', '', fixture.input.originalResume, '', '## 初始补充信息', '', fixture.input.additionalInfo, '', '## 固定追问回答事实库', '', fixture.answerMode === 'skip' ? '本例完全跳过追问，无新增回答。' : fixture.answerBank.map(x => '- ' + x.answer).join('\n'), '', '## 两版最终简历'];
  for (const version of versions) {
    details.push('', '## ' + (version === 'baseline' ? '旧版' : '新版'), '', resumeText(results[version].finalResume), '', '### 面试问题与参考回答', '');
    for (const item of results[version].interviewPrep.likelyQuestions) details.push('**' + item.question + '**', '', item.suggestedAnswer, '', '需准备：' + item.evidenceNeeded.join('；'), '');
    details.push('### 生成追问', '', ...results[version].originalQuestions.map(q => '- ' + q.question + '（' + q.purpose + '）'));
  }
  details.push('', '## 两轮盲评原始意见', '');
  for (const [i, judgment] of judgments.entries()) {
    details.push('### 第' + (i + 1) + '轮', '', judgment.judgment.comparison, '');
    for (const label of ['A', 'B']) details.push('**' + judgment.order[label] + '：' + judgment.scores[judgment.order[label]] + '**', '', ...judgment.judgment[label].weaknesses.map(x => '- ' + x), '');
  }
  const file = path.join(dir, 'case-reports', fixture.id + '.md'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, details.join('\n') + '\n');
}
const averages = Object.fromEntries(versions.map(v => [v, round1(rows.reduce((sum, row) => sum + row.scores[v], 0) / rows.length)]));
const stats = Object.fromEntries(versions.map(version => {
  const calls = fixtures.flatMap(f => callsFor(version, f.id));
  return [version, { requests: calls.length, httpSuccess: calls.filter(c => c.httpStatus === 200).length, networkErrors: calls.filter(c => c.error).length, jsonRepairCalls: calls.filter(c => c.request.messages[0].content.includes('你是 JSON 修复器')).length, promptTokens: calls.reduce((n,c) => n + (c.response?.usage?.prompt_tokens || 0), 0), completionTokens: calls.reduce((n,c) => n + (c.response?.usage?.completion_tokens || 0), 0), elapsedMs: calls.reduce((n,c) => n + c.elapsedMs, 0) }];
}));
save(path.join(dir, 'summary.json'), { comparedVersions: { baseline: 'baseline', optimized: 'optimized-final' }, averages, rows, stats, scoringFloorUnchanged: true });
const report = ['# Part 2 提示词优化：真实模型五组对照测试', '', '模型：deepseek-v4-flash（项目现有 DeepSeek 接口）。测试日期：2026-09-14（Asia/Shanghai）。全部生成与评审均调用真实模型，没有使用 Mock。', '', '## 变更与回滚', '', '- 保留评分函数及原有兜底逻辑，SHA-256 与基线完全一致。', '- 强化硬门槛／优先项区分、需求方推断依据和理想候选人的行为证据。', '- 将 JD 画像和匹配证据经页面、请求、服务端传入诊断、经历盘点、追问、改写、最终简历和面试准备；旧请求缺少字段仍可兼容。', '- 加入迁移依据、逐条改写目的、事实边界、已有强证据与面试亮点关联。', '- 明确保留决定高于篇幅目标，项目数量改为详写数量建议；无必要时允许不改写。', '- 基线提交：`' + baseline.commit + '`；修改前与测试版各保存64个源文件的逐字节快照。', '', '在项目根目录执行：', '', '```powershell', 'node scripts/prompt-eval.cjs rollback-check', 'node scripts/prompt-eval.cjs rollback', '```', '', '回滚仅恢复本次变更的10个源文件；若文件在测试之后又被修改，脚本会拒绝覆盖。评测材料、快照、日志保留。回滚后需重新构建或重启应用。', '', '## 测试方法', '', '每个样例、每个版本生成一套完整的8阶段结果：JD、诊断匹配、经历盘点、追问、优化项、最终简历、原有评分、面试准备。前两例跳过追问，后三例按固定事实库回答；没有使用模型编造用户答案。两版复用同一事实库，实际交付答案在各自 answered-analysis.json 中保留。未点击可选的单条 Bullet 生成功能。', '', '使用真实服务函数与各版本完整源码快照，模型参数与项目保持一致。每阶段保存检查点，失败仅续跑未完成阶段；不择优挑选多个成功输出。此评测覆盖服务函数，未执行浏览器端交互测试。', '', '盲评隐藏版本名称和产品分数，使用同一模型的新请求，交换A/B顺序评审两次。固定权重：真实性30%、需求识别20%、证据表达15%、聚焦与可读性15%、面试准备10%、追问质量10%。各维度0–100，总分由代码计算。下表是输出质量分，不是候选人资历匹配分，也不受产品兜底影响。', '', '评审协议v2明确区分追问生成与后续回答的时间，并向评审提供实际交付答案；早期3组v1评审保留在 judgments/，全部排除于正式统计。', '', '## 质量评分（两轮均值）', '', '| 样例 | 旧版 | 新版 | 差值 |', '|---|---:|---:|---:|', ...rows.map(r => '| [' + md(r.name) + '](case-reports/' + r.id + '.md) | ' + r.scores.baseline.toFixed(1) + ' | ' + r.scores.optimized.toFixed(1) + ' | ' + signed(r.delta) + ' |'), '| 平均 | ' + averages.baseline.toFixed(1) + ' | ' + averages.optimized.toFixed(1) + ' | ' + signed(round1(averages.optimized - averages.baseline)) + ' |', '', '## 评分波动：保留两次原始评审分', '', '| 样例 | 旧版第一／第二轮 | 新版第一／第二轮 |', '|---|---:|---:|', ...rows.map(r => '| ' + md(r.name) + ' | ' + r.rounds.map(x => x.baseline).join(' / ') + ' | ' + r.rounds.map(x => x.optimized).join(' / ') + ' |'), '', '仅5组、每组每版1次成功生成，同源模型评审且存在位置偏好和判断波动；两轮平均不能证明统计显著性，不能据此推断面试率提升。盲评意见也可能误判，需结合案例原文复核。', '', '## 产品评分：原始诊断 → 模型最终原始分 → 兜底展示分', '', '| 样例 | 旧版 | 新版 |', '|---|---|---|', ...rows.map(r => '| ' + md(r.name) + ' | ' + [r.productScores.baseline.original, r.productScores.baseline.raw, r.productScores.baseline.displayed].join(' → ') + ' | ' + [r.productScores.optimized.original, r.productScores.optimized.raw, r.productScores.optimized.displayed].join(' → ') + ' |'), '', '两版诊断也由模型各自生成，前后分数不是同一固定候选人分数基准；质量结论应主要结合上面的盲评与具体内容，不能将产品分数差全部归因于改写。', '', '## 结构与信息流检查', '', '| 样例 | 旧版追问／面试题 | 新版追问／面试题 | 检查发现 |', '|---|---:|---:|---|', ...rows.map(r => '| ' + md(r.name) + ' | ' + r.counts.baseline.followUps + ' / ' + r.counts.baseline.interviews + ' | ' + r.counts.optimized.followUps + ' / ' + r.counts.optimized.interviews + ' | ' + md([...r.validation.baseline.map(x => '旧版：' + x), ...r.validation.optimized.map(x => '新版：' + x)].join('；') || '检查通过') + ' |'), '', '检查包括每段最多3问、跳过追问不新增回答、经历ID保留、校招五项目一校园零实习、10道面试题，以及新版六个相关阶段的真实请求是否包含同一JD画像。结构通过不等于所有语义均正确。', '', '## 执行记录与限制', '', '- `npm run typecheck`：通过。', '- `npm run lint`：0错误，3处原有未使用 schema 常量警告。', '- `npm run build`：通过。', '- 首次受限网络访问失败，基线保留15条 fetch failed 记录；允许网络后成功运行，未改用Mock。', '- 新版第5组诊断首次输出多余的JSON结束括号，自动修复仍失败；保留原响应，从诊断阶段续跑。该问题属于真实模型输出可靠性问题，本次未更改解析器。', '', '| 生成版本 | 请求数（含失败／修复） | HTTP 200 | 网络错误 | JSON修复调用 | 输入Token | 输出Token |', '|---|---:|---:|---:|---:|---:|---:|', ...versions.map(v => '| ' + v + ' | ' + [stats[v].requests, stats[v].httpSuccess, stats[v].networkErrors, stats[v].jsonRepairCalls, stats[v].promptTokens, stats[v].completionTokens].join(' | ') + ' |'), '', '上述Token仅统计生成流程，包含推理Token（由provider usage报告），不含独立盲评。全部请求正文、原始响应、usage、状态与耗时见 runs/ 与 judgments-v2/；未保存API Key或Authorization请求头。', '', '## 文件与复跑', '', '- `cases.json`：五组固定输入与回答事实库。', '- `baseline/`、`optimized/`：源文件快照与哈希清单。', '- `runs/{baseline,optimized}/{case}/result.json`：两版完整结果。', '- `case-reports/`：每组输入、两版最终简历、面试准备、追问与评审意见。', '- `judgments-v2/`：正式双顺序盲评。', '- `summary.json`：机器可读评分、结构检查和请求统计。', '', '生成脚本默认复用已完成检查点，不会重复付费生成；如需新一轮独立实验，应使用新的评测目录，保留本轮结果。', ''];
let reportText = report.join('\n')
  .replace('模型：deepseek-v4-flash（项目现有 DeepSeek 接口）。', '请求模型：deepseek-v4-flash（项目现有 DeepSeek 接口）；接口响应的模型标识为 deepseek-flash，原始响应已保存。')
  .replaceAll('judgments-v2/', 'judgments-final/')
  .replaceAll('`baseline/`、`optimized/`', '`baseline/`、`optimized-final/`')
  .replaceAll('runs/{baseline,optimized}', 'runs/{baseline,optimized-final}')
  .replace('全部生成与评审均调用真实模型，没有使用 Mock。', '全部生成与评审均调用真实模型，没有使用 Mock。正式比较采用 baseline 与 optimized-final，初版 optimized 及其评审完整保留。')
  .replace('保留评分函数及原有兜底逻辑', '保留评分兜底函数及评分维度权重')
  .replace('- 加入迁移依据、逐条改写目的、事实边界、已有强证据与面试亮点关联。', '- 加入迁移依据、逐条改写目的、事实边界、已有强证据与面试亮点关联。\n- 评分阶段补传真实追问回答，评分公式与兜底不变；面试题超量时仅保留优先排列的前10条，不编造不足的题目。\n- 排除纯学历记录误入经历清单，限制无依据的贡献程度修饰，减少同一成果跨栏目重复。')
  .replace('评审协议v2明确区分追问生成与后续回答的时间，并向评审提供实际交付答案；早期3组v1评审保留在 judgments/，全部排除于正式统计。', '正式评审沿用修正后的统一协议：区分追问生成与后续回答的时间，向评审提供实际交付答案。初版5组生成与双顺序评审保留在 runs/optimized/、judgments-v2/；更早的3组评审保留在 judgments/。它们全部排除于正式均值，不选择其中更高的分数。')
  .replace('仅5组、每组每版1次成功生成', '这五组同时用于发现问题、调优和复测，并非独立留出测试集。仅5组、每组每版1次成功生成')
  .replace('新版第5组诊断首次输出多余的JSON结束括号，自动修复仍失败；保留原响应，从诊断阶段续跑。该问题属于真实模型输出可靠性问题，本次未更改解析器。', '初版第5组诊断输出多余的JSON结束括号，自动修复仍失败，随后从诊断阶段续跑。初版校招评分还出现推理耗尽4500 Token、从推理占位符修复出字符串 X 的问题；既有兜底显示68分。上述初版原响应全部保留，本次未修改解析器和评分兜底。最终版另行生成，其实际检查结果见上表。')
  .replace('检查包括每段最多3问', '检查包括评分请求包含真实补充答案、每段最多3问')
  .replace('- `npm run build`：通过。', '- `npm run build`：最终版通过。\n- 本地边界断言：面试题最多10条、不修改输入、不为不足题数补造、评分转发真实答案、旧请求无画像兼容，全部通过。');
reportText = reportText.replace('| optimized |', '| optimized-final |');
const baselineTotal = stats.baseline.promptTokens + stats.baseline.completionTokens;
const optimizedTotal = stats.optimized.promptTokens + stats.optimized.completionTokens;
const findings = ['## 内容复核与实际取舍', '', '- 出海样例：最终版保留“完成访谈／完成A/B测试”和“数据待确认”，减少旧版的“独立／主导／提升自助效率”等无依据强化；纯学历不再重复进入校园栏目。', '- 校招样例：五项目一校园完整保留，追问从15条降至12条，避免为统一项目数量丢失材料。', '- 技术转产品样例：保留后端工程师职称、每秒200次请求的内部压测范围和Demo只检查输出格式的边界，没有写成产品经理任职或商业AI上线。', '- 成熟样例：最终版保留“同一测试集、结果仅代表测试集”的限定，且没有额外追问。', '- 传统转行样例的质量均分只相差0.1，视为基本持平；各组交换顺序后评分也会波动，不能解释成稳定改善。', '', '**仍有语义风险，不能把结构通过理解成无幻觉。** 人工复核发现成熟样例把原文“本人不负责模型训练”扩成“模型训练由算法工程师负责”，来源并未说明其他人的职责，后半句不应直接采用。传统转行样例还加入了一段标注“个人结论、未验证”的技术边界判断，仍需本人确认是否确实形成过该判断。这些原始模型输出保留于案例报告，未手工美化后再送评审。', '', '最终版生成流程总Token为' + optimizedTotal + '，基线为' + baselineTotal + '，本轮约增加' + ((optimizedTotal / baselineTotal - 1) * 100).toFixed(1) + '%；主要增加在共享岗位画像的输入上下文。单轮Token差受推理长度影响，不能据此推断稳定价格或耗时变化。', ''];
reportText = reportText.replace('## 产品评分：', findings.join('\n') + '\n## 产品评分：');
fs.writeFileSync(path.join(dir, 'REPORT.md'), reportText);
console.log(JSON.stringify({ averages, rows: rows.map(r => ({ id: r.id, scores: r.scores, delta: r.delta, validation: r.validation })), stats }, null, 2));
