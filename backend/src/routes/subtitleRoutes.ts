import { Router } from "express";
import { SubtitleController } from "../controllers/subtitleController";
import {
  validateSubtitleRequest,
  validateVideoInfoRequest,
} from "../middleware/validators";

const router = Router();
const subtitleController = new SubtitleController();

// 자막 추출 엔드포인트
router.post(
  "/subtitles",
  validateSubtitleRequest,
  subtitleController.extractSubtitles
);

// 비디오 정보 조회 엔드포인트
router.get(
  "/video/info",
  validateVideoInfoRequest,
  subtitleController.getVideoInfo
);

export default router;
