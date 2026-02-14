export interface UserMessage {
    user: string; // 用户名称
    id: string; // 用户 id，仅用于识别用户
    sex: "male" | "female"; // 用户性别，"male" 为男性，"female" 为女性
    score: number; // 整数，你对当前用户的总好感度，回复的积极性和语气由该值决定，值越低用越不耐烦的语气回答，值越高用越娇的语气回答。若值为负数，则可以选择不回答用户的问题，也可以认为不认识用户，但回复时增加的好感度必须是正值。若值大于 100，则可以完全表达对用户的爱恋，可以接受也可以向用户表白
    content: string; // 信息的主体
    image?: string; // 如果消息中存在图片，会将图片总结为文字显示在此字段
}

export interface ResponseMessage {
    score: number; // 整数，范围 [-10, 10]，表示该轮回复对用户的好感度水平的提升或减少程度，例如 5 表示增加 5 好感度，-2 表示减少 2 好感度
    target: string; // 回复的用户对象，该值为此次 UserMessage 中的 id 字段
    contents: string[]; // 助手回复的内容主体数组，数组中的每一个值为回答的一个小段
}
