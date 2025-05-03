import { Request, Response } from "express";
import { VideoInfoService } from "../services/videoInfoService";
import { Logger } from "../utils/logger";
import { extractVideoId } from "../utils/urlParser";

export class VideoInfoController {
  private videoInfoService: VideoInfoService;
  private logger: Logger;

  constructor() {
    this.videoInfoService = new VideoInfoService();
    this.logger = new Logger("VideoInfoController");
  }

  /**
   * 비디오 정보 API 핸들러
   */
  public getVideoInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, url } = req.query;

      // ID 또는 URL 필요
      if (!id && !url) {
        res.status(400).json({
          success: false,
          error: "비디오 ID 또는 URL이 필요합니다",
        });
        return;
      }

      // 비디오 ID 추출
      let videoId: string | null = null;

      if (typeof id === "string") {
        videoId = id;
      } else if (typeof url === "string") {
        videoId = extractVideoId(url);
      }

      if (!videoId) {
        res.status(400).json({
          success: false,
          error: "유효한 비디오 ID 또는 URL이 아닙니다",
        });
        return;
      }

      this.logger.info(`비디오 정보 요청: ${videoId}`);

      // 비디오 정보 가져오기
      const videoInfo = await this.videoInfoService.getVideoInfo(videoId);

      if (!videoInfo) {
        res.status(404).json({
          success: false,
          error: "비디오 정보를 찾을 수 없습니다",
        });
        return;
      }

      // 응답
      res.json({
        success: true,
        data: videoInfo,
      });
    } catch (error: any) {
      this.logger.error(`비디오 정보 조회 오류: ${error.message}`);

      res.status(500).json({
        success: false,
        error: "비디오 정보 조회 중 오류가 발생했습니다",
        detail: error.message,
      });
    }
  };
}
