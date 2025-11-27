# 家事 App - API 文档

## 1. 简介

本文档提供了“家事” (Family Care) 应用后端的 API 规范。后端应提供一个 RESTful API 供 Angular 前端使用。

-   **基础 URL**: `/api`
-   **身份验证**: API 应为有状态的，并使用基于会话的身份验证（例如，通过安全 Cookie）。除 `/auth/login` 外，所有端点都应受保护，并需要经过身份验证的用户会话。后端应将数据（如帖子、评论、健康日志）与通过身份验证的用户关联起来。
-   **数据格式**: 所有请求和响应体均为 JSON 格式。

---

## 2. 数据模型

这些是整个 API 中使用的主要数据结构，基于前端的 `src/types.ts` 文件。

### Post
```typescript
interface Post {
  id: number; // 由后端生成
  author: string; // 创建帖子的用户名称
  authorAvatar: string; // 作者的头像 URL
  timestamp: string; // ISO 8601 日期字符串，由后端生成
  type: 'FEELING' | 'DISCOVERY' | 'CHORE' | 'TASK' | 'APPOINTMENT' | 'EVENT' | 'MEDICATION' | 'MEAL_SUGGESTION';
  content: string;
  media?: { type: 'image' | 'video'; url: string; }[];
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority?: 'URGENT' | 'NORMAL' | 'LOW';
  dueDate?: string; // ISO 8601 日期字符串
  assignees: Assignee[];
  reactions: Reaction[];
  comments: Comment[];
  subject?: Assignee; // 帖子相关的家庭成员
}

interface Comment {
  id: number; // 由后端生成
  author: string;
  authorAvatar: string;
  content: string;
  timestamp: string; // ISO 8601 日期字符串，由后端生成
}

interface Assignee {
  name: string;
  avatar: string;
  age?: number;
}
```

### InventoryItem
```typescript
interface InventoryItem {
  id: number; // 由后端生成
  name: string;
  image: string;
  category: '食材' | '清洁用品' | '生活用品';
  brand?: string;
  store?: string;
  notes?: string;
  usageScenario?: string;
  status: 'IN_STOCK' | 'RUNNING_LOW' | 'OUT_OF_STOCK'; // 默认: 'IN_STOCK'
  comments?: InventoryItemComment[];
}
```

### InventoryItemComment
```typescript
interface InventoryItemComment {
  id: number; // 由后端生成
  author: string;
  authorAvatar: string;
  content: string;
  timestamp: string; // ISO 8601 日期字符串，由后端生成
}
```

### HealthLog
```typescript
interface HealthLog {
  id: number; // 由后端生成
  author: string; // 与日志关联的用户
  timestamp: string; // ISO 8601 日期字符串，由后端生成
  content: string;
  mood?: '不错' | '充沛' | '疲惫' | '压力大';
  environmentalContext?: any; // 复杂对象，可作为 JSON blob 存储
}
```

---

## 3. 身份验证 API

处理用户登录和会话管理。

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
    -   `200 OK`: 登录成功。响应体包含用户对象。
        ```json
        {
          "name": "我",
          "avatar": "https://picsum.photos/seed/me/100/100",
          "age": 25
        }
        ```
    -   `401 Unauthorized`: 凭据无效。

### `POST /auth/logout`

终止当前用户会话。

-   **请求体**: 无
-   **响应**:
    -   `204 No Content`: 登出成功。

### `GET /auth/me`

如果会话存在，则检索当前已验证用户的个人信息。

-   **请求体**: 无
-   **响应**:
    -   `200 OK`: 会话有效。响应体包含用户对象。
    -   `401 Unauthorized`: 无有效会话。

---

## 4. 帖子 API

用于管理家庭帖子的端点。

### `GET /posts`

获取家庭的所有帖子列表。帖子应按时间倒序返回（最新的在前）。

-   **请求体**: 无
-   **响应**:
    -   `200 OK`: 返回一个 `Post` 对象数组。
        ```json
        [
          { ...Post object... },
          { ...Post object... }
        ]
        ```

### `POST /posts`

创建一个新帖子。`author`、`authorAvatar`、`id` 和 `timestamp` 应由后端根据已验证用户和当前时间设置。

-   **请求体**: `Omit<Post, 'id' | 'author' | 'authorAvatar' | 'timestamp' | 'reactions' | 'comments' | 'assignees'>`
    ```json
    {
      "type": "TASK",
      "content": "今天下午5点前有人能去取一下干洗的衣服吗？",
      "priority": "URGENT",
      "dueDate": "2023-10-27T17:00:00.000Z"
    }
    ```
-   **响应**:
    -   `201 Created`: 返回完整、新创建的 `Post` 对象。

### `POST /posts/{postId}/reactions`

为当前用户向特定帖子添加一个回应。后端应防止同一用户重复添加相同类型的回应。

-   **路径参数**:
    -   `postId` (number): 要回应的帖子 ID。
-   **请求体**:
    ```json
    {
      "type": "ILL_DO_IT"
    }
    ```
-   **响应**:
    -   `200 OK`: 返回完整更新后的 `Post` 对象。

### `POST /posts/{postId}/comments`

向特定帖子添加一条评论。作者信息应从当前用户的会话中获取。

-   **路径参数**:
    -   `postId` (number): 要评论的帖子 ID。
-   **请求体**:
    ```json
    {
      "content": "太棒了！下次试试。"
    }
    ```
-   **响应**:
    -   `200 OK`: 返回完整更新后的 `Post` 对象。

### `DELETE /posts/{postId}/comments/{commentId}`

删除特定帖子中的一条评论。后端应验证执行此操作的用户是否是该评论的作者。

-   **路径参数**:
    -   `postId` (number): 评论所属帖子的 ID。
    -   `commentId` (number): 要删除的评论 ID。
-   **响应**:
    -   `200 OK`: 返回完整更新后的 `Post` 对象。
    -   `403 Forbidden`: 用户无权删除该评论。
    -   `404 Not Found`: 未找到帖子或评论。

### `PATCH /posts/{postId}`

更新一个特定帖子。目前用于将任务标记为“已完成”。

-   **路径参数**:
    -   `postId` (number): 要更新的帖子 ID。
-   **请求体**:
    ```json
    {
      "status": "DONE"
    }
    ```
-   **响应**:
    -   `200 OK`: 返回完整更新后的 `Post` 对象。

---

## 5. 物资清单 API

用于管理家庭物资清单的端点。

### `GET /inventory`

获取所有物资项目。

-   **请求体**: 无
-   **响应**:
    -   `200 OK`: 返回一个 `InventoryItem` 对象数组。

### `POST /inventory`

向物资清单中添加一个新项目。`id`、`status` 和 `comments` 由后端生成/初始化。

-   **请求体**: `Omit<InventoryItem, 'id' | 'status' | 'comments'>`
    ```json
    {
      "name": "有机全脂牛奶",
      "image": "https://picsum.photos/seed/milk/200/200",
      "category": "食材",
      "brand": "Organic Valley",
      "store": "Costco",
      "notes": "买大包装的，孩子们喜欢喝。",
      "usageScenario": "适合直接饮用、制作拿铁或燕麦粥"
    }
    ```
-   **响应**:
    -   `201 Created`: 返回完整、新创建的 `InventoryItem` 对象。

### `PATCH /inventory/{itemId}`

更新特定物资项目的部分或全部信息（例如状态、名称、备注等）。

-   **路径参数**:
    -   `itemId` (number): 要更新的项目 ID。
-   **请求体**: `Partial<Omit<InventoryItem, 'id' | 'comments'>>`
    ```json
    {
      "status": "RUNNING_LOW",
      "notes": "Costco 的价格更划算。" 
    }
    ```
-   **响应**:
    -   `200 OK`: 返回完整更新后的 `InventoryItem` 对象。

### `DELETE /inventory/{itemId}`

从物资清单中删除一个项目。

-   **路径参数**:
    -   `itemId` (number): 要删除的项目 ID。
-   **响应**:
    -   `204 No Content`: 项目删除成功。
    -   `404 Not Found`: 未找到该项目。

### `POST /inventory/{itemId}/comments`

向特定物资项目添加一条评论。作者信息应从当前用户的会话中获取。

-   **路径参数**:
    -   `itemId` (number): 要评论的项目 ID。
-   **请求体**:
    ```json
    {
      "content": "这个牌子比之前买的好用。"
    }
    ```
-   **响应**:
    -   `200 OK`: 返回完整更新后的 `InventoryItem` 对象。

### `DELETE /inventory/{itemId}/comments/{commentId}`

删除特定物资项目中的一条评论。后端应验证执行此操作的用户是否是该评论的作者。

-   **路径参数**:
    -   `itemId` (number): 评论所属项目的 ID。
    -   `commentId` (number): 要删除的评论 ID。
-   **响应**:
    -   `200 OK`: 返回完整更新后的 `InventoryItem` 对象。
    -   `403 Forbidden`: 用户无权删除该评论。
    -   `404 Not Found`: 未找到项目或评论。

---

## 6. 健康日志 API

用于管理用户个人健康日志的端点。这些应限定在已验证用户的范围内。

### `GET /health-logs`

获取当前登录用户的所有健康日志。

-   **请求体**: 无
-   **响应**:
    -   `200 OK`: 返回一个 `HealthLog` 对象数组。

### `POST /health-logs`

为当前用户创建一个新的健康日志。`id`、`author` 和 `timestamp` 由后端设置。

-   **请求体**: `Omit<HealthLog, 'id' | 'author' | 'timestamp'>`
    ```json
    {
        "content": "晚上有点头痛，可能是没休息好。",
        "mood": "疲惫"
    }
    ```
-   **响应**:
    -   `201 Created`: 返回完整、新创建的 `HealthLog` 对象。