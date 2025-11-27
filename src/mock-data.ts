import { Post, InventoryItem, HealthLog } from './types';
import { FAMILY_MEMBERS } from './auth.service';

const [me, mom, dad, alex] = FAMILY_MEMBERS;

const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

export const MOCK_POSTS: Post[] = [
    {
        id: 1,
        author: mom.name,
        authorAvatar: mom.avatar,
        timestamp: oneHourAgo,
        type: 'FEELING',
        content: '今天头有点晕，可能是血压有点高。需要休息一下。',
        subject: mom,
        reactions: [{ author: dad, type: 'GOT_IT' }],
        comments: [],
        assignees: []
    },
    {
        id: 7,
        author: dad.name,
        authorAvatar: dad.avatar,
        timestamp: twoHoursAgo,
        type: 'MEDICATION',
        content: '提醒自己，记得饭后服用每日的维生素D和鱼油。',
        subject: dad,
        reactions: [{ author: mom, type: 'GOT_IT' }],
        comments: [],
        assignees: []
    },
    {
        id: 2,
        author: me.name,
        authorAvatar: me.avatar,
        timestamp: eightHoursAgo,
        type: 'TASK',
        content: '有人能帮忙去超市买点牛奶和鸡蛋吗？家里的快没了。',
        status: 'DONE',
        priority: 'NORMAL',
        assignees: [],
        reactions: [{ author: alex, type: 'ILL_DO_IT' }],
        comments: [
            { id: 101, author: alex.name, authorAvatar: alex.avatar, content: '我下午放学去买吧。', timestamp: oneHourAgo }
        ]
    },
    {
        id: 4,
        author: me.name,
        authorAvatar: me.avatar,
        timestamp: oneDayAgo,
        type: 'APPOINTMENT',
        content: '提醒一下大家，明天下午 3 点要带狗狗去看兽医做年度检查。',
        status: 'TODO',
        priority: 'URGENT',
        dueDate: inTwoHours,
        assignees: [dad],
        reactions: [{ author: dad, type: 'ILL_DO_IT' }],
        comments: []
    },
    {
        id: 6,
        author: dad.name,
        authorAvatar: dad.avatar,
        timestamp: oneDayAgo,
        type: 'CHORE',
        content: '家庭任务：请记得在周二和周五晚上倒垃圾。',
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
        assignees: [me, alex],
        reactions: [],
        comments: [],
    },
    {
        id: 3,
        author: dad.name,
        authorAvatar: dad.avatar,
        timestamp: twoDaysAgo,
        type: 'DISCOVERY',
        content: '我发现了一个关于“延迟满足”的有趣研究。简单来说，能够为了更大的长期回报而抵制即时诱惑的能力，是未来成功的关键预测因素。这也许可以解释为什么存钱和健康饮食这么难！',
        reactions: [
            { author: me, type: 'GOT_IT' },
            { author: mom, type: 'GOT_IT' },
        ],
        comments: [],
        assignees: []
    },
    {
        id: 5,
        author: alex.name,
        authorAvatar: alex.avatar,
        timestamp: threeDaysAgo,
        type: 'MEAL_SUGGESTION',
        content: '我们这周末可以吃墨西哥玉米卷吗？好久没吃了！',
        reactions: [
            { author: me, type: 'ILL_JOIN' },
            { author: mom, type: 'ILL_JOIN' },
        ],
        comments: [
            { id: 102, author: mom.name, authorAvatar: mom.avatar, content: '好主意，我看看家里还缺什么配料。', timestamp: oneDayAgo }
        ],
        assignees: [],
        aiSuggestions: [
            {
                id: 201,
                content: `
                    <h4>🌮 家庭墨西哥卷饼之夜！</h4>
                    <p>听起来是个好主意！考虑到大家的口味和我们现有的食材，我们可以这样做：</p>
                    <ul>
                        <li><strong>蛋白质:</strong> 我们可以用冰箱里的鸡胸肉做成<strong>香辣鸡肉丝</strong>。</li>
                        <li><strong>配料:</strong> 牛油果可以做成<strong>牛油果酱</strong>，再切点番茄丁和生菜丝。</li>
                        <li><strong>购物清单:</strong> 我们需要买一些玉米饼皮和墨西哥辣酱。</li>
                    </ul>
                    <p>这样既利用了现有食材，又能满足大家想吃墨西哥菜的愿望。妈妈觉得怎么样？</p>
                `
            }
        ],
        activeAiSuggestionIndex: 0,
    }
];

export const MOCK_INVENTORY: InventoryItem[] = [
    { id: 101, name: '有机全脂牛奶', image: 'https://picsum.photos/seed/milk/200/200', category: '食材', brand: 'Organic Valley', status: 'RUNNING_LOW', usageScenario: '适合直接饮用、制作拿铁或燕麦粥', comments: [] },
    { id: 102, name: '鸡蛋', image: 'https://picsum.photos/seed/eggs/200/200', category: '食材', status: 'RUNNING_LOW', usageScenario: '适用于烘焙、早餐煎蛋或水煮', comments: [
        { id: 301, author: mom.name, authorAvatar: mom.avatar, content: '这个牌子的鸡蛋蛋黄颜色很深，味道不错。', timestamp: oneDayAgo }
    ] },
    { id: 103, name: '厨房纸巾', image: 'https://picsum.photos/seed/papertowel/200/200', category: '生活用品', brand: 'Bounty', status: 'IN_STOCK', usageScenario: '用于厨房清洁和吸干食物水分', comments: [] },
    { id: 104, name: '洗洁精', image: 'https://picsum.photos/seed/dishsoap/200/200', category: '清洁用品', brand: 'Dawn', status: 'IN_STOCK', usageScenario: '清洗碗碟', comments: [] },
    { id: 105, name: '牛油果', image: 'https://picsum.photos/seed/avocado/200/200', category: '食材', status: 'OUT_OF_STOCK', notes: '买熟一点的', usageScenario: '制作牛油果酱或沙拉', comments: [] },
    { id: 106, name: '垃圾袋', image: 'https://picsum.photos/seed/trashbag/200/200', category: '生活用品', status: 'IN_STOCK', usageScenario: '厨房和卫生间使用', comments: [] },
    { id: 107, name: '厕纸', image: 'https://picsum.photos/seed/toiletpaper/200/200', category: '生活用品', status: 'OUT_OF_STOCK', usageScenario: '卫生间必需品', comments: [] },
];

export const MOCK_HEALTH_LOGS: HealthLog[] = [
    { id: 201, author: me.name, timestamp: oneHourAgo, content: '运动了', mood: '充沛' },
    { id: 202, author: me.name, timestamp: eightHoursAgo, content: '感觉有点压力', mood: '压力大' },
    { id: 203, author: mom.name, timestamp: oneDayAgo, content: '吃了降压药', mood: '不错' }
];