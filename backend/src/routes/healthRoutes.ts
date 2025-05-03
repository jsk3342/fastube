import { Router } from "express";

const router = Router();

router.get("/health", (req, res) => {
  // 서비스 상태 정보 수집
  const status = {
    service: "fastube-backend",
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  };

  return res.status(200).json(status);
});

export default router;
