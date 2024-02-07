import { Context, Schema } from "koishi";
export declare const name = "learnertracker";
export declare const inject: string[];
export declare const usage = "\u8DDF\u8E2A\u7BA1\u7406\u5B66\u4E60\u7FA4\u5404\u4E2A\u7528\u6237\u7684\u76EE\u6807\u3001\u8BA1\u5212\uFF0C\u5E76\u5C31\u6253\u5361\u5185\u5BB9\u5BF9\u63A5 chatgpt api \u8FDB\u884C\u603B\u7ED3\u548C\u9F13\u52B1";
export interface Config {
    apiHost: string;
    apiKey: string;
}
export declare const Config: Schema<Config>;
declare module "koishi" {
    interface Tables {
        learner: Learner;
    }
}
export interface Learner {
    id: string;
    shortTermGoal: string;
    shortTermGoalSetTime: Date;
    longTermGoal: string;
    longTermGoalSetTime: Date;
    style: string;
    lastCheckinContent: string | null;
    lastCheckinTime: Date | null;
    learningPoints: number;
    language: string;
}
export declare function apply(ctx: Context, config: Config): void;
