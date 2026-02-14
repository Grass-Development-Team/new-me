import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ level, message, timestamp, ...rest }) => {
      // 处理多参数情况
      const messages = Array.isArray(message) ? message : [message];
      const otherArgs = Object.keys(rest).length ? [JSON.stringify(rest)] : [];
      const allMessages = [...messages, ...otherArgs].join(" ");

      // 给日期和级别添加颜色
      const colorizer = winston.format.colorize();
      const coloredLevel = colorizer.colorize(level, level.toUpperCase());
      const coloredTimestamp = colorizer.colorize(level, `${timestamp}`);

      // 设置格式: [时间戳] [级别] 消息
      return `[${coloredTimestamp}] [${coloredLevel}] ${allMessages}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
