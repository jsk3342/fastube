import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 서비스 상태 확인
 *     description: 백엔드 서비스의 상태 정보를 제공합니다.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: 서비스 상태 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: fastube-backend
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-01-01T00:00:00.000Z"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 environment:
 *                   type: string
 *                   example: development
 */
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
