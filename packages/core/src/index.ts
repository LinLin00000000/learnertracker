import { Context, Logger, Schema } from "koishi";

export const name = "learnertracker";
export const inject = ["database"];
export const usage =
  "跟踪管理学习群各个用户的目标、计划，并就打卡内容对接 chatgpt api 进行总结和鼓励";

export const Config = Schema.object({
  apiHost: Schema.string().default("https://api.openai.com/v1/chat/completions"),
  apiKey: Schema.string().required(),
  model: Schema.string().default("gpt-3.5-turbo"),
});

type Config = Schemastery.TypeT<typeof Config>;
const logger = new Logger(name);

const DBTableName = "learner";

declare module "koishi" {
  interface Tables {
    [DBTableName]: Learner;
  }
}

export interface Learner {
  id: string;
  shortTermGoal: string;
  shortTermGoalSetTime: Date;
  longTermGoal: string;
  longTermGoalSetTime: Date;
  style: string;
  lastCheckinContent: string;
  lastCheckinTime: Date;
  learningPoints: number;
  language: string;
  isSuggestionEnabled: boolean;
}

export function apply(ctx: Context, config: Config) {
  ctx.model.extend(DBTableName, {
    id: "string",
    shortTermGoal: "text",
    shortTermGoalSetTime: "timestamp",
    longTermGoal: "text",
    longTermGoalSetTime: "timestamp",
    style: "string",
    lastCheckinContent: "text",
    lastCheckinTime: "timestamp",
    learningPoints: "integer",
    language: "string",
    isSuggestionEnabled: "boolean",
  });

  const defaultSuggestionEnabled = false;

  const settings = [
    "语言风格",
    "语言",
    "短期目标",
    "长期目标",
    "启用建议",
    "禁用建议",
  ];
  const setRegexPattern = `\\s*(${settings.join("|")})(?:\\s+(.*))?`;
  const setRegex = new RegExp(setRegexPattern, "s");
  ctx
    .command(commandName("set <content:text>"))
    .action(async ({ session }, content) => {
      const match = content?.match(setRegex);
      if (match) {
        session.send(JSON.stringify(match));
        const setContent = match[2]?.trim();
        switch (match[1]) {
          case "语言":
            if (!setContent) {
              return `设置失败，请指定语言`;
            } else {
              await ctx.database.upsert(DBTableName, [
                { id: session.userId, language: setContent },
              ]);
              return `设置成功，当前你的语言为：${setContent}`;
            }
          case "语言风格":
            if (!setContent) {
              return `设置失败，请指定语言风格`;
            } else {
              await ctx.database.upsert(DBTableName, [
                { id: session.userId, style: setContent },
              ]);
              return `设置成功，当前你的语言风格为：${setContent}`;
            }
          case "短期目标":
            if (!setContent) {
              return `设置失败，请指定短期目标`;
            } else {
              await ctx.database.upsert(DBTableName, [
                {
                  id: session.userId,
                  shortTermGoal: setContent,
                  shortTermGoalSetTime: new Date(session.timestamp),
                },
              ]);
              return `设置成功，当前你的短期目标为：${setContent}`;
            }
          case "长期目标":
            if (!setContent) {
              return `设置失败，请指定长期目标`;
            } else {
              await ctx.database.upsert(DBTableName, [
                {
                  id: session.userId,
                  longTermGoal: setContent,
                  longTermGoalSetTime: new Date(session.timestamp),
                },
              ]);
              return `设置成功，当前你的长期目标为：${setContent}`;
            }
          case "启用建议":
            await ctx.database.upsert(DBTableName, [
              { id: session.userId, isSuggestionEnabled: true },
            ]);
            return `设置成功，已启用建议`;
          case "禁用建议":
            await ctx.database.upsert(DBTableName, [
              { id: session.userId, isSuggestionEnabled: false },
            ]);
            return `设置成功，已禁用建议`;
          default:
            return `设置失败，未知选项：${match[1]}`;
        }
      } else {
        return `请使用以下选项(以空白间隔开)：
${settings.map((s) => "\t" + s).join("\n")}
并以空白间隔附上内容`;
      }
    });

  ctx
    .command(commandName("reset <content:text>"))
    .action(async ({ session }, content) => {
      const match = content?.match(setRegex);
      if (match) {
        session.send(JSON.stringify(match));
        switch (match[1]) {
          case "语言":
            await ctx.database.upsert(DBTableName, [
              { id: session.userId, language: null },
            ]);
            return `重置成功，当前你的语言已重置`;

          case "语言风格":
            await ctx.database.upsert(DBTableName, [
              { id: session.userId, style: null },
            ]);
            return `重置成功，当前你的语言风格已重置`;
          case "短期目标":
            await ctx.database.upsert(DBTableName, [
              {
                id: session.userId,
                shortTermGoal: null,
                shortTermGoalSetTime: null,
              },
            ]);
            return `重置成功，当前你的短期目标已重置`;
          case "长期目标":
            await ctx.database.upsert(DBTableName, [
              {
                id: session.userId,
                longTermGoal: null,
                longTermGoalSetTime: null,
              },
            ]);
            return `重置成功，当前你的长期目标已重置`;
          case "启用建议":
            await ctx.database.upsert(DBTableName, [
              {
                id: session.userId,
                isSuggestionEnabled: defaultSuggestionEnabled,
              },
            ]);
            return `重置成功，默认为禁用建议`;
          case "禁用建议":
            await ctx.database.upsert(DBTableName, [
              {
                id: session.userId,
                isSuggestionEnabled: defaultSuggestionEnabled,
              },
            ]);
            return `重置成功，默认为禁用建议`;
          default:
            return `重置失败，未知选项：${match[1]}`;
        }
      } else {
        return `请使用以下选项(以空白间隔开)：
${settings.map((s) => "\t" + s).join("\n")}`;
      }
    });

  ctx.command(commandName("get_all_settings")).action(async ({ session }) => {
    const result = (await ctx.database.get(DBTableName, session.userId))[0];
    return JSON.stringify(result, null, 2);
  });

  ctx
    .command(commandName("checkout <content:text>"))
    .action(async ({ session, options }, content) => {
      logger.debug(JSON.stringify({ options, content }, null, 2));

      if (!content || content.trim().length === 0) {
        const msg = "虽然沉默是金，但你的故事才是我们的宝藏！写点什么吧。";
        return msg;
      }

      const settings = (await ctx.database.get(DBTableName, session.userId))[0];

      const prompts = [];
      if (settings?.longTermGoal) {
        prompts.push(
          `用户于 ${settings.longTermGoalSetTime.toString()} 设置了长期目标:\n${
            settings.longTermGoal
          }\n`
        );
      }
      if (settings?.shortTermGoal) {
        prompts.push(
          `用户于 ${settings.shortTermGoalSetTime.toString()} 设置了短期目标:\n${
            settings.shortTermGoal
          }\n`
        );
      }
      if (settings?.longTermGoal || settings?.shortTermGoal) {
        prompts.push(`现在的时间是 ${new Date(session.timestamp)}`);
      }
      prompts.push(
        `请基于以上信息和用户提供的活动描述，生成一段总结性和鼓励性质的文字${
          settings?.isSuggestionEnabled ? "，并给出后续的建议和指导" : ""
        }。`
      );
      prompts.push('请使用纯文本生成回答，不要使用 markdown 格式。请注意排版。')
      if (settings?.style) {
        prompts.push(`使用 **${settings.style}** 的风格生成回答。`);
      }
      if (settings?.language) {
        prompts.push(`使用 **${settings.language}** 生成回答。`);
      }
      logger.debug(prompts.join("\n"));

      const res = await gpt(content, prompts.join("\n"));
      return res;
    });

  async function gpt(content: string, system = "") {
    const headers = {
      Authorization: "Bearer " + config.apiKey,
      "Content-Type": "application/json",
    };

    const MAX_RETRIES = 3; // 最大重试次数
    let retries = 0; // 当前重试计数

    while (retries < MAX_RETRIES) {
      try {
        const response = await fetch(config.apiHost, {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: [
              { role: "user", content },
              { role: "system", content: system },
            ],
            model: config.model,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const res = await response.json();
        return res.choices[0].message.content;
      } catch (error) {
        logger.warn(`Attempt ${retries + 1} failed: ${error.message}`);
        retries += 1;

        if (retries >= MAX_RETRIES) {
          throw new Error("Max retries reached. Aborting.");
        }

        // 简单的重试延迟逻辑，例如等待 1 秒
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}

function commandName(command: string) {
  return `${name}.${command}`;
}
