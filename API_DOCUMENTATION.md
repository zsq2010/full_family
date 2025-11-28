# 家事 App - API 文档 (v2.0)

## 1. 简介

本文档提供了“家事” (Family Care) 应用后端的 API 规范。后端应提供一个 RESTful API 供 Angular 前端使用。

-   **基础 URL**: `/api`
-   **身份验证**: API 应为有状态的，并使用基于会话的身份验证（例如，通过安全 Cookie）。除认证端点外，所有端点都应受保护。
-   **核心概念：数据范围 (Data Scoping)**: 所有核心资源（帖子、物资清单、健康日志）都**必须**通过家庭 ID 进行访问。这确保了严格的数据隔离和安全性。后端应在处理每个请求时，验证当前登录用户是否有权访问路径中指定的 `{familyId}`。
-   **数据格式**: 所有请求和响应体均为 JSON 格式。

---

## 2. 数据模型

这些是整个 API 中使用的主要数据结构，基于前端的 `src/types.ts` 文件。

### Assignee (用户/成员)
```typescript
interface Assignee {
  id: number; // 用户的唯一标识符
  name: string; // 用户在家庭中的称呼
  avatar: string; // 头像 URL
  age?: number;
}
```

### Family (家庭)
```typescript
interface Family {
  id: string; // 家庭的唯一标识符 (例如: "fam_...")
  name: string; // 家庭名称
  members: Assignee[]; // 家庭成员列表
  inviteCode: string; // 用于邀请新成员的唯一代码
}
```

### Post, Comment, InventoryItem 等
其他数据模型（如 `Post`, `Comment`, `InventoryItem`, `HealthLog`）与旧文档或 `src/types.ts` 中的定义保持一致，但所有这些资源现在都与一个特定的 `Family` 关联。

---

## 3. 身份验证 API

处理用户注册、登录和会话管理。

### `POST /auth/register`

创建一个新用户账户。

-   **请求体**:
    ```json
    {
      "username": "newuser",
      "displayName": "新成员",
      "password": "strongpassword123"
    }
    ```
-   **响应**:
    -   `201 Created`: 注册成功并自动登录。响应体包含用户会话信息。
    -   `400 Bad Request`: 输入无效（例如，用户名已存在）。

### `POST /auth/login`

验证用户身份并创建会话。

-   **请求体**:
    ```json
    {
      "username": "me",
      "password": "password123"
    }
    ```
-   **响应**:
    -   `200 OK`: 登录成功。响应体包含用户会话信息。
        ```json
        {
          "user": { "id": 1, "name": "我", "avatar": "...", "age": 25 },
          "families": [
            { "id": "fam_demo", "name": "演示家庭", "members": [...], "inviteCode": "DEMO123" }
          ],
          "activeFamilyId": "fam_demo" // 默认激活第一个家庭
        }
        ```
    -   `401 Unauthorized`: 凭据无效。

### `POST /auth/logout`

终止当前用户会话。

-   **响应**:
    -   `204 No Content`: 登出成功。

### `GET /auth/me`

如果会话存在，则检索当前用户的完整会话信息。

-   **响应**:
    -   `200 OK`: 会话有效。响应体结构与 `/auth/login` 成功时的响应相同。
    -   `401 Unauthorized`: 无有效会话。

---

## 4. 家庭管理 API

管理用户所属的家庭。

### `POST /families`

创建一个新家庭。创建者自动成为该家庭的第一个成员。

-   **请求体**:
    ```json
    {
      "familyName": "快乐一家"
    }
    ```
-   **响应**:
    -   `201 Created`: 返回新创建的完整 `Family` 对象。

### `POST /families/join`

使用邀请码加入一个现有的家庭。

-   **请求体**:
    ```json
    {
      "inviteCode": "DEMO123"
    }
    ```
-   **响应**:
    -   `200 OK`: 成功加入。返回加入的 `Family` 对象。
    -   `400 Bad Request`: 邀请码无效或用户已是该家庭成员。
    -   `404 Not Found`: 找不到使用该邀请码的家庭。

### `POST /families/{familyId}/switch`

在用户的会话中切换当前激活的家庭。

-   **路径参数**:
    -   `familyId` (string): 要激活的家庭 ID。
-   **响应**:
    -   `204 No Content`: 切换成功。
    -   `403 Forbidden`: 用户不是该家庭的成员。
    -   `404 Not Found`: 家庭不存在。

---

## 5. 帖子 API

所有帖子都与一个特定的家庭相关联。

### `GET /families/{familyId}/posts`

获取指定家庭的所有帖子列表，按时间倒序。

-   **路径参数**:
    -   `familyId` (string): 目标家庭的 ID。
-   **响应**:
    -   `200 OK`: 返回一个 `Post` 对象数组。
    -   `403 Forbidden`: 用户无权访问该家庭。

### `POST /families/{familyId}/posts`

在指定家庭中创建一个新帖子。

-   **路径参数**: `familyId` (string)
-   **请求体**: `Omit<Post, 'id' | 'author' | 'authorAvatar' | 'timestamp' | ...>`
-   **响应**:
    -   `201 Created`: 返回完整、新创建的 `Post` 对象。

### `POST /families/{familyId}/posts/{postId}/reactions`

为帖子添加一个回应。

-   **路径参数**: `familyId`, `postId`
-   **请求体**: `{ "type": "ILL_DO_IT" }`
-   **响应**: `200 OK`，返回更新后的 `Post` 对象。

### `POST /families/{familyId}/posts/{postId}/comments`

向帖子添加一条评论。

-   **路径参数**: `familyId`, `postId`
-   **请求体**: `{ "content": "..." }`
-   **响应**: `200 OK`，返回更新后的 `Post` 对象。

### `DELETE /families/{familyId}/posts/{postId}/comments/{commentId}`

删除一条评论。需要验证用户是否为评论作者。

-   **路径参数**: `familyId`, `postId`, `commentId`
-   **响应**: `200 OK` (返回更新后的 `Post` 对象) 或 `204 No Content`。

### `PATCH /families/{familyId}/posts/{postId}`

更新一个帖子（例如，更新状态）。

-   **路径参数**: `familyId`, `postId`
-   **请求体**: `{"status": "DONE"}`
-   **响应**: `200 OK`，返回更新后的 `Post` 对象。

---

## 6. 物资清单 API

所有物资都与一个特定的家庭相关联。

### `GET /families/{familyId}/inventory`

获取指定家庭的所有物资项目。

-   **路径参数**: `familyId` (string)
-   **响应**: `200 OK`，返回 `InventoryItem` 对象数组。

### `POST /families/{familyId}/inventory`

向指定家庭的物资清单中添加一个新项目。

-   **路径参数**: `familyId` (string)
-   **请求体**: `Omit<InventoryItem, 'id' | 'status' | 'comments'>`
-   **响应**: `201 Created`，返回新创建的 `InventoryItem` 对象。

### `PATCH /families/{familyId}/inventory/{itemId}`

更新一个物资项目的信息。

-   **路径参数**: `familyId`, `itemId`
-   **请求体**: `Partial<Omit<InventoryItem, 'id' | 'comments'>>`
-   **响应**: `200 OK`，返回更新后的 `InventoryItem` 对象。

### `DELETE /families/{familyId}/inventory/{itemId}`

删除一个物资项目。

-   **路径参数**: `familyId`, `itemId`
-   **响应**: `204 No Content`。

### `POST /families/{familyId}/inventory/{itemId}/comments`

向物资项目添加一条评论。

-   **路径参数**: `familyId`, `itemId`
-   **请求体**: `{ "content": "..." }`
-   **响应**: `200 OK`，返回更新后的 `InventoryItem` 对象。

### `DELETE /families/{familyId}/inventory/{itemId}/comments/{commentId}`

删除一条物资项目的评论。

-   **路径参数**: `familyId`, `itemId`, `commentId`
-   **响应**: `200 OK` (返回更新后的 `InventoryItem` 对象) 或 `204 No Content`。

---

## 7. 健康日志 API

健康日志与用户个人绑定，但在家庭上下文中查看。

### `GET /families/{familyId}/health-logs`

获取当前登录用户在指定家庭上下文中的所有健康日志。

-   **路径参数**: `familyId` (string)
-   **响应**: `200 OK`，返回 `HealthLog` 对象数组。

### `POST /families/{familyId}/health-logs`

为当前用户在指定家庭上下文中创建一个新的健康日志。

-   **路径参数**: `familyId` (string)
-   **请求体**: `Omit<HealthLog, 'id' | 'author' | 'timestamp'>`
-   **响应**: `201 Created`，返回新创建的 `HealthLog` 对象。
