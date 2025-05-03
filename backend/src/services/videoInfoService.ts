import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page, ElementHandle } from "puppeteer";
import { Logger } from "../utils/logger";

puppeteer.use(StealthPlugin());

export interface VideoInfo {
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: number;
  availableLanguages: string[];
}

export class VideoInfoService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("VideoInfoService");
  }

  /**
   * YouTube 비디오 정보 추출
   */
  public async getVideoInfo(videoId: string): Promise<VideoInfo> {
    let browser = null;

    try {
      this.logger.info(`비디오 정보 추출 시작: ${videoId}`);

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
      );

      await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // 비디오 정보 추출
      const videoInfo = await page.evaluate((id) => {
        // 제목
        const titleElement = document.querySelector(
          "h1.ytd-video-primary-info-renderer"
        );
        const title =
          titleElement && titleElement.textContent
            ? titleElement.textContent.trim()
            : "제목 없음";

        // 채널명
        const channelElement = document.querySelector("#channel-name a");
        const channelName =
          channelElement && channelElement.textContent
            ? channelElement.textContent.trim()
            : "채널명 없음";

        // 썸네일 URL
        const thumbnailUrl = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;

        // 영상 길이
        const durationElement = document.querySelector(".ytp-time-duration");
        const durationText =
          durationElement && durationElement.textContent
            ? durationElement.textContent
            : "0:00";
        const durationParts = durationText.split(":").map(Number);
        let duration = 0;
        if (durationParts.length === 3) {
          // 시:분:초 형식
          duration =
            durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2];
        } else if (durationParts.length === 2) {
          // 분:초 형식
          duration = durationParts[0] * 60 + durationParts[1];
        }

        // 사용 가능한 자막 언어 (YouTube UI 구조에 따라 구현 필요)
        const availableLanguages: string[] = [];

        return {
          title,
          channelName,
          thumbnailUrl,
          duration,
          availableLanguages,
        };
      }, videoId);

      this.logger.info(`비디오 정보 추출 성공: ${videoId}`);

      // 사용 가능한 자막 언어 목록 가져오기 (별도 로직으로 구현)
      videoInfo.availableLanguages = await this.getAvailableSubtitleLanguages(
        page
      );

      return videoInfo;
    } catch (error: any) {
      this.logger.error(`비디오 정보 추출 오류: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * 사용 가능한 자막 언어 목록 추출
   */
  private async getAvailableSubtitleLanguages(page: Page): Promise<string[]> {
    try {
      // 설정 버튼 클릭
      const settingsButton = await page.$(".ytp-settings-button");
      if (!settingsButton) return ["ko", "en"]; // 기본값

      await settingsButton.click();
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      // 자막 메뉴 찾기
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

      if (!subtitleMenuItem) {
        await page.click("body"); // 메뉴 닫기
        return ["ko", "en"]; // 기본값
      }

      const elementExists = await page.evaluate((el) => !!el, subtitleMenuItem);
      if (elementExists) {
        await (subtitleMenuItem as ElementHandle<Element>).click();
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 1000))
        );

        // 언어 목록 추출
        const languages = await page.evaluate(() => {
          const menuItems = Array.from(
            document.querySelectorAll(".ytp-menuitem")
          );
          return menuItems
            .map((item) => {
              const text = item.textContent ? item.textContent.trim() : "";

              // 언어 코드 매핑 (간소화된 버전)
              if (text.includes("한국어")) return "ko";
              if (text.includes("영어")) return "en";
              if (text.includes("일본어")) return "ja";
              if (text.includes("중국어")) return "zh";
              if (text.includes("스페인어")) return "es";

              return null;
            })
            .filter(Boolean) as string[];
        });

        // 메뉴 닫기
        await page.click("body");

        return languages.length > 0 ? languages : ["ko", "en"];
      }

      return ["ko", "en"];
    } catch (error: any) {
      this.logger.error(`자막 언어 목록 추출 오류: ${error.message}`);
      return ["ko", "en"]; // 오류 발생 시 기본값 반환
    }
  }
}
