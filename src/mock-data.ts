import { Post, InventoryItem, HealthLog } from './types';
import { FAMILY_MEMBERS } from './auth.service';

const [me, mom, dad, alex] = FAMILY_MEMBERS;

const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
        id: 2,
        author: me.name,
        authorAvatar: me.avatar,
        timestamp: twoHoursAgo,
        type: 'TASK',
        content: '有人能帮忙去超市买点牛奶和鸡蛋吗？家里的快没了。',
        status: 'TODO',
        priority: 'NORMAL',
        assignees: [],
        reactions: [{ author: alex, type: 'ILL_DO_IT' }],
        comments: [
            { id: 101, author: alex.name, authorAvatar: alex.avatar, content: '我下午放学去买吧。', timestamp: oneHourAgo }
        ]
    },
    {
        id: 3,
        author: dad.name,
        authorAvatar: dad.avatar,
        timestamp: eightHoursAgo,
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
        assignees: []
    }
];

export const MOCK_INVENTORY: InventoryItem[] = [
    { id: 101, name: '有机全脂牛奶', image: 'https://picsum.photos/seed/milk/200/200', category: '食材', brand: 'Organic Valley', status: 'RUNNING_LOW' },
    { id: 102, name: '鸡蛋', image: 'https://picsum.photos/seed/eggs/200/200', category: '食材', status: 'RUNNING_LOW' },
    { id: 103, name: '厨房纸巾', image: 'https://picsum.photos/seed/papertowel/200/200', category: '生活用品', brand: 'Bounty', status: 'IN_STOCK' },
    { id: 104, name: '洗洁精', image: 'https://picsum.photos/seed/dishsoap/200/200', category: '清洁用品', brand: 'Dawn', status: 'IN_STOCK' },
    { id: 105, name: '牛油果', image: 'https://picsum.photos/seed/avocado/200/200', category: '食材', status: 'OUT_OF_STOCK', notes: '买熟一点的' },
    { id: 106, name: '垃圾袋', image: 'https://picsum.photos/seed/trashbag/200/200', category: '生活用品', status: 'IN_STOCK' },
    { id: 107, name: '厕纸', image: 'https://picsum.photos/seed/toiletpaper/200/200', category: '生活用品', status: 'OUT_OF_STOCK' },
];

export const MOCK_HEALTH_LOGS: HealthLog[] = [
    { id: 201, author: me.name, timestamp: oneHourAgo, content: '运动了', mood: '充沛' },
    { id: 202, author: me.name, timestamp: eightHoursAgo, content: '感觉有点压力', mood: '压力大' },
    { id: 203, author: mom.name, timestamp: oneDayAgo, content: '吃了降压药', mood: '不错' }
];
