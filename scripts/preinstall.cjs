const fs = require('fs');

const userAgent = process.env.npm_config_user_agent || process.env.NPM_CONFIG_USER_AGENT || '';
const execPath = process.env.npm_execpath || process.env.NPM_EXECPATH || '';
const isPnpm =
  userAgent.toLowerCase().includes('pnpm') ||
  execPath.toLowerCase().includes('pnpm') ||
  Boolean(process.env.PNPM_SCRIPT_SRC) ||
  Boolean(process.env.pnpm_config_user_agent);

if (!isPnpm) {
  console.error(`Use pnpm instead (userAgent: "${userAgent}", execPath: "${execPath}")`);
  process.exit(1);
}

['package-lock.json', 'yarn.lock'].forEach((file) => {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
    } catch (e) {
      // ignore
    }
  }
});
