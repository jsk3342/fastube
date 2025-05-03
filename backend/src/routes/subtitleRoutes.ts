import { Router } from "express";
import { SubtitleController } from "../controllers/subtitleController";

const router = Router();
const subtitleController = new SubtitleController();

/**
 * @swagger
 * /api/subtitles:
 *   post:
 *     summary: 유튜브 영상의 자막 추출
 *     description: 유튜브 URL과 언어 코드를 받아 영상의 자막과 메타데이터를 반환합니다.
 *     tags:
 *       - Subtitles
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: 유튜브 영상 URL
 *                 example: https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *               language:
 *                 type: string
 *                 description: 언어 코드 (기본값은 'ko')
 *                 example: ko
 *     responses:
 *       200:
 *         description: 자막 추출 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubtitleResponse'
 *       400:
 *         description: 잘못된 요청 (유효하지 않은 URL 등)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 자막을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/subtitles", subtitleController.getSubtitles);

// 비디오 정보 엔드포인트 (임시로 비활성화하고 SubtitleController에서 처리)
// router.get("/video/info", videoInfoController.getVideoInfo);

export default router;
