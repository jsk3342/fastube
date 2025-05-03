import { Router, Request, Response } from "express";

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: 서버 상태 확인
 *     description: 서버가 정상적으로 실행 중인지 확인
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: 서버가 정상적으로 실행 중
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 message:
 *                   type: string
 *                   example: "서버가 정상적으로 실행 중입니다."
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-07-14T12:34:56.789Z"
 *                 uptime:
 *                   type: number
 *                   example: 12345.67
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 memory:
 *                   type: object
 *                   properties:
 *                     rss:
 *                       type: string
 *                       example: "128MB"
 *                     heapTotal:
 *                       type: string
 *                       example: "64MB"
 *                     heapUsed:
 *                       type: string
 *                       example: "32MB"
 */
router.get("/health", (req: Request, res: Response) => {
  const formatMemory = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + "MB";
  };

  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: "ok",
    message: "서버가 정상적으로 실행 중입니다.",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.version,
    memory: {
      rss: formatMemory(memoryUsage.rss),
      heapTotal: formatMemory(memoryUsage.heapTotal),
      heapUsed: formatMemory(memoryUsage.heapUsed),
    },
  });
});

export default router;
