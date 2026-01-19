const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
const endpoint = 'https://api.cloudflare.com/client/v4/graphql';

async function fetchData() {
  // 1. 检查环境变量
  if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('❌ 错误: 环境变量丢失。请检查 GitHub Secrets 中的 CF_ACCOUNT_ID 和 CF_API_TOKEN');
    process.exitCode = 1;
    return;
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
            sum { requests errors cpuTime }
            dimensions { datetime scriptName }
          }
        }
      }
    }
  `;

  try {
    console.log(`📡 正在连接 Cloudflare API... (Account ID: ${ACCOUNT_ID.slice(0, 4)}***)`);

    const response = await axios.post(
      endpoint,
      { query },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 设置10秒超时，防止挂起
      }
    );

    // 2. 检查 GraphQL 错误（最常见的问题点）
    if (response.data.errors && response.data.errors.length > 0) {
      console.error('❌ Cloudflare API 返回业务错误:');
      console.error(JSON.stringify(response.data.errors, null, 2));
      process.exitCode = 1;
      return;
    }

    // 3. 检查数据结构是否存在
    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      console.error('❌ 数据错误: 找不到该 Account ID 的数据。请检查 CF_ACCOUNT_ID 是否正确。');
      console.error('API 返回结构:', JSON.stringify(response.data, null, 2));
      process.exitCode = 1;
      return;
    }

    const data = accounts[0].workersInvocationsAdaptive;
    
    // 4. 保存文件
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
    fs.writeFileSync(path.join(publicDir, 'data.json'), JSON.stringify(data, null, 2));
    
    console.log('✅ 数据抓取成功！');

  } catch (error) {
    console.error('❌ 请求发生异常:');
    if (error.response) {
      // 请求已发出，服务器返回状态码不在 2xx 范围内
      console.error(`状态码: ${error.response.status}`);
      console.error('响应体:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('无响应: 请求已发出但未收到响应');
