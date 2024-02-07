"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apply = exports.Config = exports.usage = exports.inject = exports.name = void 0;
const koishi_1 = require("koishi");
exports.name = "learnertracker";
exports.inject = ["database"];
exports.usage = '跟踪管理学习群各个用户的目标、计划，并就打卡内容对接 chatgpt api 进行总结和鼓励';
exports.Config = koishi_1.Schema.object({
    apiHost: koishi_1.Schema.string().default("https://api.openai.com"),
    apiKey: koishi_1.Schema.string().required(),
});
function apply(ctx, config) {
    ctx.model.extend("learner", {
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
    });
    // ctx.on("message", async (session) => {
    //   session.send(JSON.stringify(session));
    //   return;
    // });
    const settings = ["语言风格", "语言"];
    const setRegexPattern = `\\s*(${settings.join("|")})\\s+(.*)`;
    const setRegex = new RegExp(setRegexPattern, "s");
    ctx
        .command("set <content:text>")
        .action(async ({ session }, content) => {
        const match = content?.match(setRegex);
        if (match) {
            switch (match[1]) {
                case "语言风格":
                    const style = match[2].trim();
                    if (style.length === 0) {
                        return `风格不能为空，请重新设置`;
                    }
                    else {
                        await ctx.database.upsert("learner", [
                            { id: session.userId, style },
                        ]);
                        return `设置成功，当前你的语言风格为：${style}`;
                    }
                case "语言":
                    const language = match[2].trim();
                    if (language.length === 0) {
                        return `语言不能为空，请重新设置`;
                    }
                    else {
                        await ctx.database.upsert("learner", [
                            { id: session.userId, language },
                        ]);
                        return `设置成功，当前你的语言为：${language}`;
                    }
                    otherwise: return JSON.stringify({
                        match,
                        time: new Date(session.timestamp),
                    });
            }
        }
        else {
            return `设置失败，请使用以下选项：${settings.join("、")}，并以空白间隔附上内容`;
        }
    })
        .alias("设置");
    ctx.command("get_all_settings").action(async ({ session }) => {
        const result = (await ctx.database.get("learner", session.userId))[0];
        return JSON.stringify(result);
    });
    ctx
        .command("checkin <content:text>", "打卡")
        .option("style", "[val:string]")
        .action(async ({ session, options }, content) => {
        if (!content || content.trim().length === 0) {
            const msg = "虽然沉默是金，但你的故事才是我们的宝藏！写点什么吧。";
            return msg;
        }
        const settings = (await ctx.database.get("learner", session.userId))[0];
        const finalStyle = options.style?.trim() || settings?.style || "";
        const finalLanuage = settings?.language || "";
        const res = await gpt(content, `${finalStyle.length !== 0 ? `使用${finalStyle}的风格生成回答。` : ""}
        请基于用户提供的活动描述，生成一段总结性和鼓励性质的文字，并给出后续的建议和指导。
        ${finalLanuage.length !== 0 ? `使用${finalLanuage}进行回答。` : ""}
        `);
        return res;
    })
        .alias("打卡");
    const url = `${config.apiHost}/v1/chat/completions`;
    const headers = {
        Authorization: "Bearer " + config.apiKey,
        "Content-Type": "application/json",
    };
    async function gpt(content, system = "") {
        const res = await (await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                messages: [
                    { role: "user", content },
                    { role: "system", content: system },
                ],
                model: "gpt-4-turbo-preview",
            }),
        })).json();
        return res.choices[0].message.content;
    }
}
exports.apply = apply;
