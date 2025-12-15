# 应用配置 API 文档 (v2.2)

## 1. 简介

本文档详细说明了“家事” (Family Care) 应用后端关于**应用程序元数据 (Application Metadata)** 和 **用户个性化配置 (AppConfig)** 的 API 规范。

文档已更新以反映当前代码的实际行为（v2.2），并仅关注后端接口契约。

-   **基础 URL**: `/api/v1`
-   **身份验证**: Bearer Token (`Authorization: Bearer <token>`)。
-   **数据格式**: JSON。

---

## 2. 数据结构说明

以下描述了 API 请求和响应中使用的主要 JSON 对象结构。

### ConfigData (配置数据)
一个灵活的 JSON 对象 (`Object`)，用于存储任意结构的配置内容。
- **推荐约定**: 若需支持用户级"启用/禁用"，请在 JSON 中包含 `"userSettings": { "enabled": boolean }` 对象。
- **类型**: Object 或 null

### Application (应用元数据)
描述应用程序的基础信息。

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | String | 应用唯一标识 (如 "frontend-dashboard") |
| `name` | String | 应用名称 |
| `description` | String | 应用描述 |
| `defaultConfig` | ConfigData | 默认配置对象 |
| `createdAt` | String | ISO 8601 时间戳 |
| `updatedAt` | String | ISO 8601 时间戳 |

### AppConfig (用户应用配置)
描述用户针对特定应用和环境的个性化配置。

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | String | 配置记录的 UUID |
| `userId` | Number | 所属用户 ID |
| `appId` | String | 关联的应用 ID |
| `environment` | String | 环境标识 (如 "production", "development") |
| `configData` | ConfigData | 用户覆盖的配置数据 |
| `application` | Object | (可选) 嵌套的应用元数据对象 |
| `createdAt` | String | ISO 8601 时间戳 |
| `updatedAt` | String | ISO 8601 时间戳 |

---

## 3. 核心初始化接口

页面加载时最常用的接口。

### `GET /api/v1/applications/user`

获取所有可用的应用，并附带当前用户的个性化配置。

-   **特点**: 
    -   即使没有配置，也会返回应用元数据（`appConfigs` 为空数组）。
    -   **精简响应**: `appConfigs` 列表中的对象**不包含**冗余的 nested `application` 字段。
-   **响应体**: JSON 对象 (Composite Response)
    ```json
    {
      "systemSettings": {
        "GLOBAL_HTTP_PROXY": "http://company-proxy:8888",
        "OPENAI_API_BASE": "https://api.openai-proxy.com/v1"
      },
      "applications": [
        {
          "application": {
            "id": "app-theme-settings",
            "name": "APP主题设置",
            "description": "管理应用外观、主题和UI偏好设置。",
            "defaultConfig": { "userSettings": { "enabled": true }, "initialTheme": "light" },
            "createdAt": "...",
            "updatedAt": "..."
          },
          "appConfigs": [
            {
              "id": "appconf_me_theme_dev",
              "userId": 6117,
              "appId": "app-theme-settings",
              "environment": "development",
              "configData": { "userSettings": { "enabled": true }, "theme": "dark" },
              "createdAt": "...",
              "updatedAt": "..."
              // 注意：此处没有 "application" 字段
            }
          ]
        }
      ]
    }
    ```

---

## 4. 用户配置管理 API (AppConfig)

用于对单一配置项进行增删改查。这些接口通常**会**返回关联的 `application` 详情。

### `GET /api/v1/appconfigs`

列出用户的配置。

-   **查询参数**: `appId` (可选)
-   **响应**: `AppConfig` 对象数组 (包含嵌套的 `application` 对象)
    ```json
    [
      {
        "id": "...",
        "appId": "frontend-dashboard",
        "configData": { ... },
        "application": { 
           "id": "frontend-dashboard",
           "name": "前端管理面板",
           ...
        }
      }
    ]
    ```

### `GET /api/v1/appconfigs/by-app-env`

-   **查询参数**: `appId` (必填), `environment` (必填)
-   **响应**: 单个 `AppConfig` 对象

### `POST /api/v1/appconfigs`

创建配置。

-   **请求体**:
    ```json
    {
      "appId": "frontend-dashboard",
      "environment": "production",
      "configData": { "theme": "dark" }
    }
    ```
-   **响应**: `201 Created` (返回完整对象，包含 `application`)

### `PATCH /api/v1/appconfigs/{id}`

更新配置数据。

-   **请求体**:
    ```json
    {
      "configData": { "newSetting": "value" }
    }
    ```
-   **响应**: `200 OK` (返回完整对象，包含 `application`)

### `DELETE /api/v1/appconfigs/{id}`

-   **响应**: `200 OK`

---

## 5. 应用元数据管理 API (Application)

系统级接口。

### `GET /api/v1/applications`
列出所有应用。

### `GET /api/v1/applications/{id}`
获取单个应用详情。

### `POST /api/v1/applications`
创建新应用。

### `PATCH /api/v1/applications/{id}`
更新应用信息。