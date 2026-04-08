const stageTestQuestionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "prompt"],
  properties: {
    type: {
      type: "string",
      enum: ["选择题", "填空题", "解答题"],
    },
    prompt: {
      type: "string",
    },
  },
} as const;

const stageTestAnswerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questionIndex", "answer", "analysis"],
  properties: {
    questionIndex: {
      type: "integer",
      minimum: 1,
    },
    answer: {
      type: "string",
    },
    analysis: {
      type: "string",
    },
  },
} as const;

export const lessonPackageJsonSchema = {
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
      overview: {
        type: "string",
        description:
          "模块1【知识讲义】。对数学等理科主题，必须包含概念定义、核心规则或本质解释、标准方法或固定步骤、易错点提醒，不得只写导语式说明。",
      },
      keyPoints: {
        type: "array",
        minItems: 2,
        items: {
          type: "string",
        },
      },
      difficulties: {
        type: "array",
        minItems: 2,
        items: {
          type: "string",
        },
      },
      examples: {
        type: "array",
        minItems: 1,
        description:
          "模块3【例题示范】。必须独立稳定输出，不能并入讲义、难点或答案解析。每个例题至少包含题目、思考断点、讲解过程、满分范式。",
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
            title: {
              type: "string",
            },
            question: {
              type: "string",
            },
            thinkingBreakpoint: {
              type: "string",
            },
            process: {
              type: "string",
            },
            perfectAnswer: {
              type: "string",
            },
          },
        },
      },
      classExercises: {
        type: "array",
        minItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: {
              type: "string",
            },
            answer: {
              type: "string",
            },
          },
        },
      },
      homework: {
        type: "array",
        minItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: {
              type: "string",
            },
            answer: {
              type: "string",
            },
          },
        },
      },
      answerAnalysis: {
        type: "array",
        minItems: 3,
        description:
          "模块6【答案解析】。只能解析本资料包中已出现的课堂练习、课后练习和小测收尾。例题示范已经独立包含完整讲解，因此这里不得再次完整解析例题示范，不得再次输出讲义、难点提醒、提分建议，也不得重写整块练习题面。",
        items: {
          type: "string",
        },
      },
      improvementTips: {
        type: "array",
        minItems: 2,
        items: {
          type: "string",
        },
      },
      quickQuiz: {
        type: "array",
        minItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: {
              type: "string",
            },
            answer: {
              type: "string",
            },
          },
        },
      },
    },
  },
} as const;

export const stageTestJsonSchema = {
  name: "stage_test",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "topicsCovered", "testDirections", "questions", "answerAnalysis"],
    properties: {
      title: {
        type: "string",
      },
      topicsCovered: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "string",
        },
      },
      testDirections: {
        type: "array",
        minItems: 2,
        items: {
          type: "string",
        },
      },
      questions: {
        type: "array",
        minItems: 12,
        maxItems: 15,
        items: stageTestQuestionSchema,
      },
      answerAnalysis: {
        type: "array",
        minItems: 12,
        maxItems: 15,
        items: stageTestAnswerSchema,
      },
    },
  },
} as const;

export function getJsonSchemaByMode(mode: "single" | "follow_up" | "stage_test") {
  return mode === "stage_test" ? stageTestJsonSchema : lessonPackageJsonSchema;
}

export function getRequiredKeysByMode(mode: "single" | "follow_up" | "stage_test") {
  return mode === "stage_test"
    ? (["title", "topicsCovered", "testDirections", "questions", "answerAnalysis"] as const)
    : ([
        "overview",
        "keyPoints",
        "difficulties",
        "examples",
        "classExercises",
        "homework",
        "answerAnalysis",
        "improvementTips",
        "quickQuiz",
      ] as const);
}
