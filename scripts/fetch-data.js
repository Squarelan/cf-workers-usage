const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 1. 确保读取到了环境变量
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;

// 2. 这里的 endpoint 必须定义，绝对不能删
const endpoint = 'https://api.cloudflare.com/client/v4/graphql';

if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('错误: 缺少环境变量 CF_ACCOUNT_ID 或 CF_API_TOKEN');
    process.exit(1);
}

const query = `
query Viewer {
  viewer {
    accounts(filter: {accountTag: "${ACCOUNT_ID}"}) {
      workersInvocationsAdaptive(
        limit: 100,
        filter: {
          datetime_geq: "${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}",
          datetime_leq: "${new Date().toISOString()}"
        }
      ) {
        sum {
          requests
          errors
          cpuTime
        }
        dimensions {
          datetime
          scriptName
        }
      }
    }
  }
}
`;

async function fetchData() {
  try {
    console.log(`正在向 ${endpoint} 发送请求...`); // 添加日志方便调试
    
    const response = await axios.post(
      endpoint, // 确保这里使用了上面定义的 endpoint
      { query },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // 检查 Cloudflare 是否返回了业务逻辑错误（如权限不足）
    if (response.data.errors && response.data.errors.length > 0) {
        console.error('Cloudflare API 返回错误:', JSON.stringify(response.data.errors, null, 2));
        process.exit(1);
    }

    const data = response.data.data.viewer.accounts[0].workersInvocationsAdaptive;
    
    const outputPath = path.join(__dirname, '../public/data.json');
    // 确保 public 目录存在
    if (!fs.existsSync(path.join(__dirname, '../public'))) {
        fs.mkdirSync(path.join(__dirname, '../public'));
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log('数据抓取成功，已保存至 public/data.json');
    
  } catch (error) {
    // 打印更详细的错误堆栈
    console.error('抓取失败详情:');
    if (error.response) {
        console.error('状态码:', error.response.status);
        console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    } else {
        console.error(error);
    }
    process.exit(1);
  }
}

fetchData();
