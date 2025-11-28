// --- 应用配置 ---
// 请在这里配置您的应用。
// 警告：请勿将含有敏感信息（如 API 密钥）的此文件提交到公共代码库！
// --------------------

// 1. Google Gemini API 密钥
// 从 https://aistudio.google.com/app/apikey 获取您的 API 密钥
// 并将其粘贴到下方的引号之间。
export const API_KEY = "YOUR_API_KEY_HERE"; // <-- 在这里粘贴您的密钥

// 2. 后端 API 配置
// 将此项设置为 `true` 可使用模拟的离线数据进行开发（无需后端）。
// 将此项设置为 `false` 可连接到下面 `API_BASE_URL` 指定的真实后端 API。
export const USE_MOCK_API = true; 

// 你的后端 API 的基础 URL。
// 仅在 USE_MOCK_API 设置为 `false` 时使用。
export const API_BASE_URL = 'http://localhost:8080/api/v1';

// 3. 开发设置
// 注意：这些设置仅在 `USE_MOCK_API` 为 `true` 时生效。
export const DEV_AUTO_LOGIN = true; 
export const DEV_DEFAULT_USER = 'me';