import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
import path from "path";
import subtitleRoutes from "./routes/subtitleRoutes";
import healthRoutes from "./routes/healthRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { Logger } from "./utils/logger";

// 환경 변수 로드
import dotenv from "dotenv";
dotenv.config();

const logger = new Logger("App");

// 앱 초기화
const app = express();

// 기본 미들웨어
app.use(cors());
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 속도 제한 설정
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 기본 15분
  max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10), // 기본 100 요청
  standardHeaders: true,
  message: {
    success: false,
    message: "너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.",
  },
});

// API 라우트에 속도 제한 적용
app.use("/api", limiter);

// 라우트 설정
app.use("/api", subtitleRoutes);
app.use("/api", healthRoutes);

// 정적 파일 제공 (프론트엔드 빌드)
if (process.env.NODE_ENV === "production") {
  const staticPath = path.join(__dirname, "../public");
  app.use(express.static(staticPath));

  // SPA 라우팅을 위한 폴백 설정
  app.get("*", (req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  logger.info(`정적 파일 제공 경로: ${staticPath}`);
}

// 오류 처리 미들웨어 (항상 마지막에 추가)
app.use(errorHandler);

export default app;
