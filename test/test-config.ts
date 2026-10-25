// 测试配置加载：读取 test/local.config.json（已被 .gitignore 忽略，勿提交密钥）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(dir, 'local.config.json');

export interface TestConfig {
  requestUrl: string;
  apikey: string;
  model: string;
}

export function loadTestConfig(): TestConfig {
  if (!fs.existsSync(file)) {
    throw new Error(
      '缺少 test/local.config.json（该文件被 .gitignore 忽略）。' +
      '请创建它并填入：{"requestUrl": "...", "apikey": "...", "model": "..."}'
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}
