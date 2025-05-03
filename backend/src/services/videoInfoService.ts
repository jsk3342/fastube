import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser } from "puppeteer";
import axios from "axios";
import { Logger } from "../utils/logger";
import { extractVideoId } from "../utils/urlParser";

export interface VideoInfo {
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: number;
  availableLanguages: string[];
}

export interface VideoInfoOptions {
  signal?: AbortSignal;
}

// 스텔스 플러그인 추가 (YouTube 감지 회피)
puppeteer.use(StealthPlugin());

export class VideoInfoService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("VideoInfoService");
  }

  /**
   * YouTube 비디오 정보 가져오기
   */
  public async getVideoInfo(
    videoIdOrUrl: string,
    options?: VideoInfoOptions
  ): Promise<VideoInfo> {
    const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;
    let browser: Browser | null = null;

    try {
      const startTime = Date.now();
      this.logger.info(`비디오 정보 추출 시작: ${videoId}`);

      // 이미 취소되었는지 확인
      if (options?.signal?.aborted) {
        const abortError = new Error("비디오 정보 요청이 취소되었습니다");
        abortError.name = "AbortError";
        throw abortError;
      }

      // 브라우저 시작
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
      });

      // AbortSignal 취소 이벤트 핸들러 등록
      if (options?.signal) {
        options.signal.addEventListener(
          "abort",
          async () => {
            this.logger.info(`비디오 정보 추출 취소됨: ${videoId}`);
            if (browser) {
              await browser.close();
              browser = null;
            }
          },
          { once: true }
        );
      }

      const page = await browser.newPage();

      // 유저 에이전트 설정 (일반 브라우저처럼 보이게)
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
      );

      // 취소 확인
      if (options?.signal?.aborted) {
        const abortError = new Error("비디오 정보 요청이 취소되었습니다");
        abortError.name = "AbortError";
        throw abortError;
      }

      // YouTube 페이지 로드
      await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      // 취소 확인
      if (options?.signal?.aborted) {
        const abortError = new Error("비디오 정보 요청이 취소되었습니다");
        abortError.name = "AbortError";
        throw abortError;
      }

      // 비디오 정보 추출
      const videoInfo = await page.evaluate(() => {
        // 제목 추출
        const titleElement = document.querySelector(
          "h1.ytd-video-primary-info-renderer"
        );
        const title = titleElement ? titleElement.textContent?.trim() : "";

        // 채널명 추출
        const channelElement = document.querySelector(
          "#channel-name #text.ytd-channel-name"
        );
        const channelName = channelElement
          ? channelElement.textContent?.trim()
          : "";

        // 썸네일 URL 구성
        const videoId = new URLSearchParams(window.location.search).get("v");
        const thumbnailUrl = videoId
          ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
          : "";

        // 비디오 길이 추출 (초 단위)
        let duration = 0;
        const durationElement = document.querySelector(
          ".ytp-time-duration"
        ) as HTMLElement;
        if (durationElement) {
          const durationText = durationElement.innerText;
          const parts = durationText.split(":").map(Number);
          if (parts.length === 2) {
            // MM:SS 형식
            duration = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            // HH:MM:SS 형식
            duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        // 사용 가능한 자막 언어 목록 추출
        let availableLanguages: string[] = [];
        try {
          const settingsButton = document.querySelector(
            ".ytp-settings-button"
          ) as HTMLElement;
          if (settingsButton) {
            settingsButton.click();
            setTimeout(() => {
              const menuItems = Array.from(
                document.querySelectorAll(".ytp-menuitem")
              );
              const subtitleMenuItem = menuItems.find(
                (item) =>
                  item.textContent?.includes("자막") ||
                  item.textContent?.includes("Subtitles") ||
                  item.textContent?.includes("CC")
              ) as HTMLElement;

              if (subtitleMenuItem) {
                subtitleMenuItem.click();
                setTimeout(() => {
                  const languageItems = Array.from(
                    document.querySelectorAll(".ytp-menuitem")
                  );
                  availableLanguages = languageItems
                    .filter(
                      (item) =>
                        item.textContent &&
                        !item.textContent.includes("Off") &&
                        !item.textContent.includes("끄기")
                    )
                    .map((item) => {
                      const text = item.textContent || "";
                      // 언어 코드 추출 (예: 한국어 → ko)
                      if (text.includes("한국어")) return "ko";
                      if (text.includes("영어") || text.includes("English"))
                        return "en";
                      return text.toLowerCase().slice(0, 2); // 간단하게 처리
                    });
                }, 500);
              }
            }, 500);
          }
        } catch (error) {
          console.error("자막 언어 추출 중 오류:", error);
        }

        // 기본값으로 영어와 한국어 포함
        if (availableLanguages.length === 0) {
          availableLanguages = ["en", "ko"];
        }

        return {
          title: title || "제목 없음",
          channelName: channelName || "채널명 없음",
          thumbnailUrl,
          duration,
          availableLanguages,
        };
      });

      // 결과 반환
      const processingTime = Date.now() - startTime;
      this.logger.info(
        `비디오 정보 추출 완료: ${videoId}, 소요시간: ${processingTime}ms`
      );

      return {
        title: videoInfo.title,
        channelName: videoInfo.channelName,
        thumbnailUrl: videoInfo.thumbnailUrl,
        duration: videoInfo.duration,
        availableLanguages: videoInfo.availableLanguages,
      };
    } catch (error: any) {
      // AbortError 처리
      if (
        error.name === "AbortError" ||
        (options?.signal?.aborted &&
          error.message.includes("Navigation timeout"))
      ) {
        const abortError = new Error("비디오 정보 요청이 취소되었습니다");
        abortError.name = "AbortError";
        throw abortError;
      }

      this.logger.error(`비디오 정보 추출 오류: ${error.message}`);
      throw error;
    } finally {
      // 브라우저 종료
      if (browser) {
        await browser.close();
        this.logger.info("브라우저 세션 종료");
      }
    }
  }

  /**
   * 간단한 비디오 정보만 빠르게 추출 (직접 HTML 파싱)
   */
  public async getBasicVideoInfo(
    videoIdOrUrl: string,
    options?: VideoInfoOptions
  ): Promise<Partial<VideoInfo>> {
    const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;

    try {
      const startTime = Date.now();
      this.logger.info(`기본 비디오 정보 추출 시작: ${videoId}`);

      // 이미 취소되었는지 확인
      if (options?.signal?.aborted) {
        const abortError = new Error("비디오 정보 요청이 취소되었습니다");
        abortError.name = "AbortError";
        throw abortError;
      }

      // 요청 설정
      const axiosConfig = {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        },
        timeout: 5000,
        signal: options?.signal,
      };

      // YouTube 페이지 HTML 가져오기
      const { data: html } = await axios.get(
        `https://www.youtube.com/watch?v=${videoId}`,
        axiosConfig
      );

      // 제목 추출
      let title = "제목 없음";
      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].replace(" - YouTube", "").trim();
      }

      // 채널명 추출
      let channelName = "채널명 없음";
      const channelMatch = html.match(/"ownerChannelName":"(.*?)"/);
      if (channelMatch && channelMatch[1]) {
        channelName = channelMatch[1];
      }

      // 썸네일 URL 구성
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      // 기본 결과 반환
      const processingTime = Date.now() - startTime;
      this.logger.info(
        `기본 비디오 정보 추출 완료: ${videoId}, 소요시간: ${processingTime}ms`
      );

      return {
        title,
        channelName,
        thumbnailUrl,
      };
    } catch (error: any) {
      // AbortError 처리
      if (error.name === "AbortError" || error.code === "ERR_CANCELED") {
        const abortError = new Error("비디오 정보 요청이 취소되었습니다");
        abortError.name = "AbortError";
        throw abortError;
      }

      this.logger.error(`기본 비디오 정보 추출 오류: ${error.message}`);
      throw error;
    }
  }
}
