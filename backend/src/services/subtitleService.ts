import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page, ElementHandle } from "puppeteer";
import { SubtitleParser } from "../utils/subtitleParser";
import { Logger } from "../utils/logger";

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
   * YouTube 자막 추출 핵심 로직
   */
  public async extractSubtitles(
    videoId: string,
    language: string
  ): Promise<string> {
    let browser = null;

    try {
      this.logger.info(`자막 추출 시작: ${videoId}, 언어: ${language}`);

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

      const page = await browser.newPage();

      // 유저 에이전트 설정 (일반 브라우저처럼 보이게)
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
      );

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

      // YouTube 페이지 로드 및 자막 활성화
      this.logger.info(`YouTube 페이지 로드 중: ${videoId}`);
      await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // 자막 버튼 클릭 (YouTube UI에 맞게 실제 구현 필요)
      await this.activateSubtitles(page, language);

      // 자막 데이터 로드 기다리기
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      );

      if (!subtitleData) {
        this.logger.warn(
          `자막 데이터를 찾을 수 없음: ${videoId}, 언어: ${language}`
        );
        throw new Error("SUBTITLE_NOT_FOUND");
      }

      // 자막 데이터 파싱
      const parsedText = this.parser.parse(subtitleData);
      this.logger.info(`자막 추출 성공: ${videoId}`);

      return parsedText;
    } catch (error: any) {
      this.logger.error(`자막 추출 오류: ${error.message}`);
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
