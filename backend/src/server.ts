import app from "./app";
import { Logger } from "./utils/logger";

const logger = new Logger("Server");
const PORT = process.env.PORT || 4000;

// 서버 시작
const server = app.listen(PORT, () => {
  logger.info(`Fastube 서버가 포트 ${PORT}에서 실행 중입니다.`);
  logger.info(`환경: ${process.env.NODE_ENV || "development"}`);
});

// 예상치 못한 오류 처리
process.on("uncaughtException", (error) => {
  logger.error("예상치 못한 예외 발생:", error);
  // 안전한 종료를 위해 서버 중지
  server.close(() => {
    logger.info("서버가 안전하게 종료되었습니다.");
    process.exit(1);
  });

  // 10초 안에 종료되지 않으면 강제 종료
  setTimeout(() => {
    logger.error("강제 종료 중...");
    process.exit(1);
  }, 10000);
});

// SIGTERM 시그널 처리 (Docker, Kubernetes 환경 등)
process.on("SIGTERM", () => {
  logger.info("SIGTERM 신호 감지, 서버 종료 중...");
  server.close(() => {
    logger.info("서버가 안전하게 종료되었습니다.");
    process.exit(0);
  });
});

export default server;
