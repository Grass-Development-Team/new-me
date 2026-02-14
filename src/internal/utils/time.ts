export function getUTCDate8Time() {
    const now = new Date();

    // 获取 UTC 时间
    const utcMilliseconds = now.getTime() + now.getTimezoneOffset() * 60 * 1000;

    // 转换为 UTC+8 时区的时间（增加 8 小时）
    const utc8Milliseconds = utcMilliseconds + 8 * 60 * 60 * 1000;
    const utc8Date = new Date(utc8Milliseconds);

    // 格式化日期和时间
    const year = utc8Date.getFullYear();
    const month = String(utc8Date.getMonth() + 1).padStart(2, "0"); // 月份从 0 开始
    const day = String(utc8Date.getDate()).padStart(2, "0");
    const hours = String(utc8Date.getHours()).padStart(2, "0");
    const minutes = String(utc8Date.getMinutes()).padStart(2, "0");
    const seconds = String(utc8Date.getSeconds()).padStart(2, "0");

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

export async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calcMessageDelay(text: string) {
    const textLength = text.length;

    // 计算每字所需时间的范围 (毫秒)
    const minMillisPerChar = 60000 / 120;
    const maxMillisPerChar = 60000 / 150;

    // 在范围内随机生成每字所需的时间
    const millisPerChar =
        Math.random() * (maxMillisPerChar - minMillisPerChar) +
        minMillisPerChar;

    // 计算总的延迟时间
    const totalDelay = Math.round(textLength * millisPerChar);

    return totalDelay;
}
