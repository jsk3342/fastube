import { Router } from "express";
import { SubtitleController } from "../controllers/subtitleController";
import {
  validateSubtitleRequest,
  validateVideoInfoRequest,
} from "../middleware/validators";

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
router.post(
  "/subtitles",
  validateSubtitleRequest,
  // @ts-ignore
  subtitleController.extractSubtitles
);

/**
 * @swagger
 * /api/video/info:
 *   get:
 *     summary: 유튜브 영상 정보 조회
 *     description: 유튜브 비디오 ID를 받아 영상 정보(제목, 채널명, 썸네일 URL 등)를 반환합니다.
 *     tags:
 *       - Video
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 유튜브 비디오 ID
 *         example: dQw4w9WgXcQ
 *     responses:
 *       200:
 *         description: 비디오 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoInfoResponse'
 *       400:
 *         description: 잘못된 요청 (유효하지 않은 ID 등)
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
router.get(
  "/video/info",
  validateVideoInfoRequest,
  // @ts-ignore
  subtitleController.getVideoInfo
);

export default router;
