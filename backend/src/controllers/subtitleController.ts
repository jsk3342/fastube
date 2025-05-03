import { Request, Response, NextFunction, RequestHandler } from "express";
import { SubtitleService } from "../services/subtitleService";
import { VideoInfoService } from "../services/videoInfoService";
import { UrlValidator } from "../utils/urlValidator";
import { createResponse } from "../utils/responseHandler";
import { Logger } from "../utils/logger";

export class SubtitleController {
  private subtitleService: SubtitleService;
  private videoInfoService: VideoInfoService;
  private urlValidator: UrlValidator;
  private logger: Logger;

  constructor() {
    this.subtitleService = new SubtitleService();
    this.videoInfoService = new VideoInfoService();
    this.urlValidator = new UrlValidator();
    this.logger = new Logger("SubtitleController");
  }

  /**
   * 유튜브 자막 추출 API 핸들러
   */
  public extractSubtitles: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { url, language = "ko" } = req.body;
      this.logger.info(`자막 추출 요청: ${url}, 언어: ${language}`);

      // URL 유효성 검증 및 videoId 추출
      const videoId = this.urlValidator.extractVideoId(url);
      if (!videoId) {
        res
          .status(400)
          .json(createResponse(false, null, "유효한 YouTube URL이 아닙니다"));
        return;
      }

      // 비디오 정보 가져오기 (병렬 처리로 성능 향상)
      const [subtitles, videoInfo] = await Promise.all([
        this.subtitleService.extractSubtitles(videoId, language),
        this.videoInfoService.getVideoInfo(videoId),
      ]);

      // 응답 반환
      res.status(200).json(
        createResponse(true, {
          text: subtitles,
          videoInfo: videoInfo,
        })
      );
    } catch (error: any) {
      this.logger.error("자막 추출 오류:", error);

      if (error.message === "SUBTITLE_NOT_FOUND") {
        res
          .status(404)
          .json(
            createResponse(false, null, "해당 언어의 자막을 찾을 수 없습니다")
          );
        return;
      }

      res
        .status(500)
        .json(createResponse(false, null, "서버 오류가 발생했습니다"));
    }
  };

  /**
   * 비디오 정보 API 핸들러
   */
  public getVideoInfo: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.query;
      this.logger.info(`비디오 정보 요청: ${id}`);

      if (!id || typeof id !== "string") {
        res
          .status(400)
          .json(createResponse(false, null, "유효한 비디오 ID가 필요합니다"));
        return;
      }

      const videoInfo = await this.videoInfoService.getVideoInfo(id);

      res.status(200).json(createResponse(true, videoInfo));
    } catch (error: any) {
      this.logger.error("비디오 정보 조회 오류:", error);
      res
        .status(500)
        .json(createResponse(false, null, "서버 오류가 발생했습니다"));
    }
  };
}
