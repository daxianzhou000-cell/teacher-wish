const fs = require("fs");

const settings = JSON.parse(fs.readFileSync("data/model-settings.json", "utf8"));
const config = settings.primary;
const base = (config.baseUrl || "").replace(/\/+$/, "");
const apiKey = config.apiKey;
const model = config.model;
const url = (/\/v\d+$/.test(base) ? base : `${base}/v1`) + "/chat/completions";

const schema = {
  name: "lesson_package",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "overview",
      "keyPoints",
      "difficulties",
      "examples",
      "classExercises",
      "homework",
      "answerAnalysis",
      "improvementTips",
      "quickQuiz",
    ],
    properties: {
      overview: { type: "string" },
      keyPoints: { type: "array", items: { type: "string" } },
      difficulties: { type: "array", items: { type: "string" } },
      examples: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "question",
            "thinkingBreakpoint",
            "process",
            "perfectAnswer",
          ],
          properties: {
            title: { type: "string" },
            question: { type: "string" },
            thinkingBreakpoint: { type: "string" },
            process: { type: "string" },
            perfectAnswer: { type: "string" },
          },
        },
      },
      classExercises: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
          },
        },
      },
      homework: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
          },
        },
      },
      answerAnalysis: { type: "array", items: { type: "string" } },
      improvementTips: { type: "array", items: { type: "string" } },
      quickQuiz: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
          },
        },
      },
    },
  },
};

const body = {
  model,
  messages: [
    { role: "system", content: "你是一位拥有丰富一线经验的小初补课教研专家。" },
    { role: "user", content: "请只输出一个 JSON 对象，主题：一元一次方程。" },
  ],
  response_format: {
    type: "json_schema",
    json_schema: schema,
  },
};

(async () => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  console.log(
    JSON.stringify(
      {
        url,
        status: response.status,
        body: text.slice(0, 8000),
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
