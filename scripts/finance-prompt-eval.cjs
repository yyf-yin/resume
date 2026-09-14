// Independent industry evaluation using the prior frozen source versions.
process.env.PROMPT_EVAL_SUITE = 'finance-accounting-audit-20260914';
const mode = process.argv[2];
const run = mode === 'judge'
  ? require('./review-prompt-eval.cjs').main
  : mode === 'report'
    ? require('./report-finance-prompt-eval.cjs').main
    : require('./prompt-eval.cjs').main;
run().catch(error => {
  console.error(String(error).replaceAll(process.env.LLM_API_KEY || '\0', '[REDACTED]'));
  process.exitCode = 1;
});
