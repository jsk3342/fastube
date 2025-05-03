import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Fastube API",
      version: "1.0.0",
      description: "유튜브 자막 추출 및 비디오 정보 API",
      contact: {
        name: "Fastube 개발팀",
      },
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "개발 서버",
      },
    ],
    components: {
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            data: {
              type: "null",
              example: null,
            },
            message: {
              type: "string",
              example: "오류 메시지",
            },
            timestamp: {
              type: "number",
              example: 1627984564000,
            },
          },
        },
        VideoInfo: {
          type: "object",
          properties: {
            title: {
              type: "string",
              example: "영상 제목",
            },
            channelName: {
              type: "string",
              example: "채널명",
            },
            thumbnailUrl: {
              type: "string",
              example: "https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg",
            },
            duration: {
              type: "number",
              example: 300,
            },
            availableLanguages: {
              type: "array",
              items: {
                type: "string",
              },
              example: ["ko", "en", "ja"],
            },
          },
        },
        SubtitleResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  example: "자막 텍스트 내용",
                },
                videoInfo: {
                  $ref: "#/components/schemas/VideoInfo",
                },
              },
            },
            timestamp: {
              type: "number",
              example: 1627984564000,
            },
          },
        },
        VideoInfoResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              $ref: "#/components/schemas/VideoInfo",
            },
            timestamp: {
              type: "number",
              example: 1627984564000,
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
