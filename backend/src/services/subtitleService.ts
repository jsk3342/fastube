import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page, ElementHandle, Browser } from "puppeteer";
import axios from "axios";
import he from "he";
import { SubtitleParser } from "../utils/subtitleParser";
import { Logger } from "../utils/logger";
import { SubtitleData, SubtitleExtractionOptions } from "../types/subtitle";

// 스텔스 플러그인 추가 (YouTube 감지 회피)
puppeteer.use(StealthPlugin());

export class SubtitleService {
  private parser: SubtitleParser;
  private logger: Logger;

  constructor() {
    this.parser = new SubtitleParser();
    this.logger = new Logger("SubtitleService");
  }

  /**
   * YouTube 자막 추출 메인 메서드 (개선된 버전)
   */
  public async getSubtitles(
    options: SubtitleExtractionOptions & { signal?: AbortSignal }
  ): Promise<SubtitleData> {
    const {
      videoId,
      language = "ko",
      preferredMethod = "hybrid",
      signal,
    } = options;

    this.logger.info(
      `자막 추출 시작: ${videoId}, 언어: ${language}, 방식: ${preferredMethod}`
    );
    const startTime = Date.now();

    // 이미 취소되었는지 확인
    if (signal?.aborted) {
      const abortError = new Error("자막 추출 요청이 취소되었습니다");
      abortError.name = "AbortError";
      throw abortError;
    }

    // 방식에 따른 처리
    try {
      if (preferredMethod === "direct") {
        // 직접 파싱 방식만 사용
        return await this.extractSubtitlesDirect(videoId, language, signal);
      } else if (preferredMethod === "puppeteer") {
        // Puppeteer 방식만 사용
        return await this.extractSubtitlesPuppeteer(
          videoId,
          language,
          undefined,
          signal
        );
      } else if (preferredMethod === "hybrid") {
        // 하이브리드 모드: 두 방식을 동시에 시작하고 먼저 완료되는 방식 사용
        return await this.extractSubtitlesHybrid(videoId, language, signal);
      } else {
        // 기본값: 직접 파싱 방식
        return await this.extractSubtitlesDirect(videoId, language, signal);
      }
    } catch (error: any) {
      // AbortError 처리
      if (error.name === "AbortError") {
        const abortError = new Error("자막 추출 요청이 취소되었습니다");
        abortError.name = "AbortError";
        throw abortError;
      }

      this.logger.error(`자막 추출 최종 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 하이브리드 모드 처리 (두 방식을 동시에 시작하고 먼저 완료되는 방식 사용, 취소 기능 포함)
   */
  private async extractSubtitlesHybrid(
    videoId: string,
    language: string,
    externalSignal?: AbortSignal
  ): Promise<SubtitleData> {
    this.logger.info(
      `하이브리드 모드 시작 (두 방식 경쟁): ${videoId}, 언어: ${language}`
    );

    // 작업 취소를 위한 AbortController 생성
    const abortController = new AbortController();

    // 외부 signal이 있는 경우 연결
    if (externalSignal) {
      externalSignal.addEventListener(
        "abort",
        () => {
          abortController.abort();
          this.logger.info("외부 신호에 의해 하이브리드 모드 취소됨");
        },
        { once: true }
      );

      // 이미 취소되었는지 확인
      if (externalSignal.aborted) {
        abortController.abort();
      }
    }

    // Puppeteer 브라우저 참조 저장용 변수
    let puppeteerBrowser: Browser | null = null;
    const setPuppeteerBrowser = (browser: Browser) => {
      puppeteerBrowser = browser;
    };

    // 작업 취소 함수
    const cancelTasks = async () => {
      // 직접 파싱 방식 취소 (AbortController 사용)
      abortController.abort();

      // Puppeteer 브라우저 종료
      if (puppeteerBrowser) {
        try {
          await puppeteerBrowser.close();
          this.logger.info("취소된 Puppeteer 브라우저 세션 종료");
        } catch (error) {
          this.logger.warn("Puppeteer 브라우저 종료 중 오류:", error);
        }
      }
    };

    // 직접 파싱 프로미스
    const directPromise = (async () => {
      try {
        const result = await this.extractSubtitlesDirect(
          videoId,
          language,
          abortController.signal
        );
        return result;
      } catch (error: any) {
        if (error.name === "AbortError") {
          this.logger.info("직접 파싱 작업이 취소됨");
          throw new Error("TASK_CANCELLED");
        }
        this.logger.warn(`직접 파싱 방식 실패: ${error.message}`);
        throw error;
      }
    })();

    // Puppeteer 프로미스 (약간 지연 시작)
    const puppeteerPromise = new Promise<SubtitleData>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;

      // 500ms 후 Puppeteer 방식 시작
      timeoutId = setTimeout(async () => {
        try {
          // 이미 다른 작업이 완료되었는지 확인
          if (abortController.signal.aborted) {
            reject(new Error("TASK_CANCELLED"));
            return;
          }

          const result = await this.extractSubtitlesPuppeteer(
            videoId,
            language,
            setPuppeteerBrowser,
            abortController.signal
          );
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 500);

      // AbortController 신호 감지하여 타임아웃 취소
      abortController.signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        reject(new Error("TASK_CANCELLED"));
      });
    });

    try {
      // 두 방식 중 먼저 완료되는 것 사용
      const result = await Promise.race([directPromise, puppeteerPromise]);

      // 다른 작업 취소
      await cancelTasks();

      this.logger.info(
        `하이브리드 모드 성공 (${result.extractionMethod} 방식), 다른 작업 취소됨`
      );
      return result;
    } catch (error: any) {
      if (error.message === "TASK_CANCELLED") {
        // 작업 취소는 무시하고 다른 방식의 완료를 기다림
        this.logger.info("일부 작업이 취소됨, 다른 작업 진행 중");
        try {
          if (abortController.signal.aborted) {
            // 직접 파싱이 취소되었으므로 Puppeteer 완료 대기
            return await puppeteerPromise;
          } else {
            // Puppeteer가 취소되었으므로 직접 파싱 완료 대기
            return await directPromise;
          }
        } catch (finalError) {
          // 모든 방식이 실패한 경우
          this.logger.error(`모든 작업 실패: ${finalError.message}`);
          throw finalError;
        }
      }

      // 두 방식 모두 실패한 경우
      await cancelTasks(); // 확실하게 모든 작업 취소
      this.logger.error(`하이브리드 모드 최종 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 이전 버전 호환성을 위한 메서드 (텍스트만 반환)
   */
  public async extractSubtitles(
    videoId: string,
    language: string
  ): Promise<string> {
    try {
      const result = await this.getSubtitles({
        videoId,
        language,
        preferredMethod: "hybrid",
      });
      return result.plain;
    } catch (error) {
      throw error;
    }
  }

  /**
   * HTML 직접 파싱 방식 (빠른 방식)
   */
  private async extractSubtitlesDirect(
    videoId: string,
    language: string,
    abortSignal?: AbortSignal
  ): Promise<SubtitleData> {
    try {
      const startTime = Date.now();
      this.logger.info(`직접 파싱 시도: ${videoId}, 언어: ${language}`);

      // 이미 취소되었는지 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      // AbortSignal로 취소 가능한 axios 요청 설정
      const axiosConfig = {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 5000, // 타임아웃 5초 설정
        signal: abortSignal, // AbortSignal 추가
      };

      // YouTube 페이지 HTML 가져오기
      const { data: html } = await axios.get(
        `https://www.youtube.com/watch?v=${videoId}`,
        axiosConfig
      );

      // 작업 취소 여부 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      // 자막 트랙 데이터 추출
      if (!html.includes("captionTracks")) {
        throw new Error(`자막 트랙을 찾을 수 없음: ${videoId}`);
      }

      // 정규식으로 captionTracks 데이터 추출
      const regex = /"captionTracks":(\[.*?\])/;
      const match = regex.exec(html);

      if (!match || !match[1]) {
        throw new Error(`자막 데이터를 파싱할 수 없음: ${videoId}`);
      }

      // 작업 취소 여부 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      // JSON 파싱
      const { captionTracks } = JSON.parse(`{"captionTracks":${match[1]}}`);

      // 요청한 언어의 자막 찾기
      const subtitle = captionTracks.find(
        (track: any) =>
          track.vssId === `.${language}` ||
          track.vssId === `a.${language}` ||
          (track.vssId && track.vssId.match(`.${language}`))
      );

      if (!subtitle || !subtitle.baseUrl) {
        throw new Error(`${language} 언어의 자막을 찾을 수 없음: ${videoId}`);
      }

      // 작업 취소 여부 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      // 자막 XML 데이터 가져오기
      const { data: transcriptData } = await axios.get(
        subtitle.baseUrl,
        axiosConfig
      );

      // 구조화된 자막 데이터로 파싱
      const processingTime = Date.now() - startTime;
      this.logger.info(
        `직접 파싱 완료: ${videoId}, 소요시간: ${processingTime}ms`
      );

      return this.parser.parseStructured(transcriptData, {
        videoId,
        language,
        extractionMethod: "direct",
      });
    } catch (error: any) {
      // AbortError인 경우 특별히 처리
      if (
        error.name === "AbortError" ||
        error.message === "AbortError" ||
        (error.code === "ERR_CANCELED" && abortSignal?.aborted)
      ) {
        throw new Error("AbortError");
      }

      this.logger.error(`직접 파싱 방식 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * Puppeteer 방식 (기존 방식)
   */
  private async extractSubtitlesPuppeteer(
    videoId: string,
    language: string,
    setBrowser?: (browser: Browser) => void,
    abortSignal?: AbortSignal
  ): Promise<SubtitleData> {
    let browser = null;

    try {
      const startTime = Date.now();
      this.logger.info(
        `Puppeteer 자막 추출 시도: ${videoId}, 언어: ${language}`
      );

      // 이미 취소되었는지 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
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

      // 외부에서 브라우저 인스턴스 참조를 받아 작업 취소에 사용할 수 있도록 함
      if (setBrowser && browser) {
        setBrowser(browser);
      }

      // AbortSignal 취소 이벤트 핸들러 등록
      if (abortSignal && browser) {
        abortSignal.addEventListener(
          "abort",
          async () => {
            this.logger.info(`Puppeteer 자막 추출 취소됨: ${videoId}`);
            if (browser) {
              try {
                await browser.close();
                browser = null;
              } catch (error) {
                this.logger.warn("브라우저 종료 중 오류:", error);
              }
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
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      // 자막 데이터 캡처를 위한 네트워크 감시 설정
      let subtitleData = null;

      await page.setRequestInterception(true);

      page.on("request", (request) => request.continue());
      page.on("response", async (response) => {
        const url = response.url();

        // 자막 데이터 응답 필터링
        if (url.includes("timedtext") && url.includes(`lang=${language}`)) {
          try {
            const contentType = response.headers()["content-type"] || "";

            if (contentType.includes("json")) {
              subtitleData = await response.json();
              this.logger.info("JSON 형식 자막 데이터 감지");
            } else if (contentType.includes("xml")) {
              subtitleData = await response.text();
              this.logger.info("XML 형식 자막 데이터 감지");
            }
          } catch (error: any) {
            this.logger.error("자막 데이터 추출 실패:", error);
          }
        }
      });

      // 취소 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      // YouTube 페이지 로드 및 자막 활성화
      this.logger.info(`YouTube 페이지 로드 중: ${videoId}`);
      await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
        waitUntil: "networkidle2",
        timeout: 15000, // 타임아웃 15초로 줄임
      });

      // 취소 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      // 자막 버튼 클릭 (YouTube UI에 맞게 실제 구현 필요)
      await this.activateSubtitles(page, language);

      // 취소 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      // 자막 데이터 로드 기다리기
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 3000))
      );

      // 취소 확인
      if (abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      if (!subtitleData) {
        this.logger.warn(
          `자막 데이터를 찾을 수 없음: ${videoId}, 언어: ${language}`
        );
        throw new Error("SUBTITLE_NOT_FOUND");
      }

      // 구조화된 자막 데이터 파싱
      const processingTime = Date.now() - startTime;
      this.logger.info(
        `Puppeteer 자막 추출 완료: ${videoId}, 소요시간: ${processingTime}ms`
      );

      return this.parser.parseStructured(subtitleData, {
        videoId,
        language,
        extractionMethod: "puppeteer",
      });
    } catch (error: any) {
      // AbortError 처리
      if (error.name === "AbortError" || error.message === "AbortError") {
        throw new Error("AbortError");
      }

      this.logger.error(`Puppeteer 자막 추출 오류: ${error.message}`);
      throw error;
    } finally {
      // 브라우저 종료 (setBrowser 콜백을 통해 외부에서 참조하고 있을 수 있으므로 여기서는 닫지 않음)
      if (browser && !setBrowser) {
        await browser.close();
        this.logger.info("브라우저 세션 종료");
      }
    }
  }

  /**
   * YouTube 자막 활성화 메서드
   * (YouTube UI가 변경될 수 있으므로 별도 메서드로 분리)
   */
  private async activateSubtitles(page: Page, language: string): Promise<void> {
    try {
      // 자막 버튼 찾기 (cc 버튼)
      const ccButton = await page.$(".ytp-subtitles-button");

      if (ccButton) {
        // 자막이 꺼져 있다면 활성화
        const ariaPressed = await page.evaluate(
          (element) => element.getAttribute("aria-pressed"),
          ccButton
        );

        if (ariaPressed === "false") {
          await ccButton.click();
          this.logger.info("자막 활성화 완료");
          await page.evaluate(
            () => new Promise((resolve) => setTimeout(resolve, 1000))
          );
        }
      } else {
        this.logger.warn("자막 버튼을 찾을 수 없음");
      }

      // 자막 설정 버튼 클릭 (원하는 언어 선택을 위함)
      const settingsButton = await page.$(".ytp-settings-button");
      if (settingsButton) {
        await settingsButton.click();
        this.logger.info("설정 메뉴 클릭");
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 1000))
        );

        // 자막 메뉴 항목 찾기
        const subtitleMenuItem = await page.evaluateHandle(() => {
          const menuItems = Array.from(
            document.querySelectorAll(".ytp-menuitem")
          );
          return menuItems.find(
            (item) =>
              item.textContent?.includes("자막") ||
              item.textContent?.includes("Subtitles") ||
              item.textContent?.includes("CC")
          );
        });

        if (subtitleMenuItem) {
          const elementExists = await page.evaluate(
            (el) => !!el,
            subtitleMenuItem
          );
          if (elementExists) {
            await (subtitleMenuItem as ElementHandle<Element>).click();
            this.logger.info("자막 메뉴 클릭");
            await page.evaluate(
              () => new Promise((resolve) => setTimeout(resolve, 1000))
            );

            // 원하는 언어 선택
            const languageItem = await page.evaluateHandle((lang: string) => {
              const menuItems = Array.from(
                document.querySelectorAll(".ytp-menuitem")
              );
              return menuItems.find(
                (item) =>
                  item.textContent?.toLowerCase().includes(lang) ||
                  (lang === "ko" && item.textContent?.includes("한국어")) ||
                  (lang === "en" && item.textContent?.includes("영어"))
              );
            }, language);

            if (languageItem) {
              const langElementExists = await page.evaluate(
                (el) => !!el,
                languageItem
              );
              if (langElementExists) {
                await (languageItem as ElementHandle<Element>).click();
                this.logger.info(`${language} 언어 선택 완료`);
              }
            } else {
              this.logger.warn(`${language} 언어를 찾을 수 없음`);
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`자막 활성화 오류: ${error.message}`);
    }
  }
}
