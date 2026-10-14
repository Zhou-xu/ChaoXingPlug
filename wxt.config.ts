import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    permissions: ['storage'], // 加上这个
    host_permissions: ['*://*.chaoxing.com/*']//配置可以发送请求的域名
  },
  webExt: {

    binaries: {
      // 手动指定 Edge 路径

      edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    }
  }
});
