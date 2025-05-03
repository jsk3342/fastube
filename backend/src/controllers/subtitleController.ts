import { Request, Response } from "express";
import { SubtitleService } from "../services/subtitleService";
import { VideoInfoService } from "../services/videoInfoService";
import { extractVideoId } from "../utils/urlParser";
import { Logger } from "../utils/logger";
import { SubtitleExtractionOptions } from "../types/subtitle";

export class SubtitleController {
  private subtitleService: SubtitleService;
  private videoInfoService: VideoInfoService;
  private logger: Logger;

  constructor() {
    this.subtitleService = new SubtitleService();
    this.videoInfoService = new VideoInfoService();
    this.logger = new Logger("SubtitleController");
  }

  /**
   * YouTube 자막 추출 API 핸들러
   */
  public getSubtitles = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const {
        url,
        videoId: rawVideoId,
        language = "ko",
        preferredMethod = "hybrid",
        includeTimestamps = false,
      } = req.body;

      // URL 또는 비디오 ID가 없는 경우
      if (!url && !rawVideoId) {
        res.status(400).json({
          success: false,
          error: "URL 또는 비디오 ID를 제공해야 합니다",
        });
        return;
      }

      // 비디오 ID 추출
      const videoId = rawVideoId || extractVideoId(url);
      if (!videoId) {
        res.status(400).json({
          success: false,
          error: "유효한 YouTube URL 또는 비디오 ID가 아닙니다",
        });
        return;
      }

      this.logger.info(
        `자막 요청: videoId=${videoId}, language=${language}, method=${preferredMethod}`
      );

      // 자막 추출 옵션 설정
      const options: SubtitleExtractionOptions = {
        videoId,
        language,
        preferredMethod,
      };

      // 작업 취소를 위한 AbortController 생성
      const controller = new AbortController();
      const signal = controller.signal;

      // 타임아웃 설정 (최대 대기 시간: 20초)
      const timeout = setTimeout(() => {
        controller.abort();
        this.logger.warn("자막 추출 최대 시간 초과로 취소됨");
      }, 20000);

      try {
        // 비디오 정보 조회 함수 (타입 정보 포함)
        const fetchVideoInfo = async () => {
          try {
            // 빠른 기본 정보 먼저 시도
            const info = await this.videoInfoService.getBasicVideoInfo(
              videoId,
              { signal }
            );
            return {
              type: "videoInfo",
              data: {
                title: info.title || "",
                channelName: info.channelName || "",
                thumbnailUrl: info.thumbnailUrl || "",
              },
            };
          } catch (error: any) {
            if (error.name === "AbortError") {
              this.logger.info("비디오 정보 요청 취소됨");
              throw error;
            }
            this.logger.warn(`비디오 정보 조회 오류: ${error.message}`);
            throw error;
          }
        };

        // 자막 추출 함수 (타입 정보 포함)
        const fetchSubtitles = async () => {
          try {
            const subtitles = await this.subtitleService.getSubtitles({
              ...options,
              signal,
            });
            return {
              type: "subtitles",
              data: subtitles,
            };
          } catch (error: any) {
            if (error.name === "AbortError") {
              this.logger.info("자막 추출 요청 취소됨");
              throw error;
            }
            this.logger.warn(`자막 추출 오류: ${error.message}`);
            throw error;
          }
        };

        // 동시에 두 작업 시작
        const videoInfoPromise = fetchVideoInfo();
        const subtitlesPromise = fetchSubtitles();

        // 기본 응답 데이터 준비
        const responseData: any = {
          success: true,
          data: {
            text: "",
            videoInfo: {
              title: "",
              channelName: "",
              thumbnailUrl: "",
            },
          },
        };

        // 경쟁 방식으로 먼저 완료되는 작업 처리
        const firstResult = await Promise.race([
          videoInfoPromise,
          subtitlesPromise,
        ]);

        // 첫 번째 결과 타입에 따라 처리
        if (firstResult.type === "videoInfo") {
          // 비디오 정보가 먼저 도착
          this.logger.info("비디오 정보가 먼저 도착함");
          responseData.data.videoInfo = firstResult.data;

          // 자막 정보 최대 2초만 더 기다리기
          try {
            const subtitleResult = await Promise.race([
              subtitlesPromise,
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error("SUBTITLE_TIMEOUT")), 2000);
              }),
            ]);

            if (subtitleResult.type === "subtitles") {
              responseData.data.text = subtitleResult.data.plain;

              // 타임스탬프 포함 옵션이 있는 경우 추가 데이터
              if (includeTimestamps) {
                responseData.data.cues = subtitleResult.data.cues;
                responseData.data.metadata = {
                  ...subtitleResult.data.metadata,
                  extractionMethod: subtitleResult.data.extractionMethod,
                };
              }
            }
          } catch (error: any) {
            // 자막 데이터를 기다리지 않고 비디오 정보만 반환
            if (error.message === "SUBTITLE_TIMEOUT") {
              this.logger.info(
                "자막 정보 추가 대기 시간 초과, 비디오 정보만 반환"
              );
            } else {
              this.logger.warn(`자막 정보 추가 대기 중 오류: ${error.message}`);
            }
          }
        } else if (firstResult.type === "subtitles") {
          // 자막 정보가 먼저 도착
          this.logger.info("자막 정보가 먼저 도착함");
          responseData.data.text = firstResult.data.plain;

          // 타임스탬프 포함 옵션이 있는 경우 추가 데이터
          if (includeTimestamps) {
            responseData.data.cues = firstResult.data.cues;
            responseData.data.metadata = {
              ...firstResult.data.metadata,
              extractionMethod: firstResult.data.extractionMethod,
            };
          }

          // 비디오 정보 최대 2초만 더 기다리기
          try {
            const videoResult = await Promise.race([
              videoInfoPromise,
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error("VIDEO_INFO_TIMEOUT")), 2000);
              }),
            ]);

            if (videoResult.type === "videoInfo") {
              responseData.data.videoInfo = videoResult.data;
            }
          } catch (error: any) {
            // 비디오 정보를 기다리지 않고 자막만 반환
            if (error.message === "VIDEO_INFO_TIMEOUT") {
              this.logger.info("비디오 정보 추가 대기 시간 초과, 자막만 반환");
            } else {
              this.logger.warn(
                `비디오 정보 추가 대기 중 오류: ${error.message}`
              );
            }
          }
        }

        // 총 처리 시간 계산 및 로깅
        const totalTime = Date.now() - startTime;
        this.logger.info(`자막 API 총 처리 시간: ${totalTime}ms`);

        res.json(responseData);
      } finally {
        // 타임아웃 제거 및 작업 취소
        clearTimeout(timeout);
        controller.abort();
      }
    } catch (error: any) {
      // 오류 처리 및 응답
      this.logger.error(`자막 추출 오류: ${error.message}`);

      if (error.message === "SUBTITLE_NOT_FOUND") {
        res.status(404).json({
          success: false,
          error: "자막을 찾을 수 없습니다",
        });
      } else {
        res.status(500).json({
          success: false,
          error: "자막 추출 중 오류가 발생했습니다",
          detail: error.message,
        });
      }
    }
  };
}
