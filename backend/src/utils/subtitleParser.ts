import { Logger } from "./logger";
import {
  SubtitleLine,
  SubtitleData,
  SubtitleCue,
  ParserOptions,
} from "../types/subtitle";
import he from "he";

export class SubtitleParser {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("SubtitleParser");
  }

  /**
   * 자막 데이터 파싱 메서드 (구조화된 데이터 반환)
   */
  public parseStructured(data: any, options?: ParserOptions): SubtitleData {
    const startTime = Date.now();
    let cues: SubtitleCue[] = [];
    let plain = "";

    try {
      if (typeof data === "string") {
        // XML 형식으로 가정
        const result = this.parseXMLStructured(data);
        cues = result.cues;
        plain = result.plain;
      } else if (data?.events) {
        // YouTube JSON 형식으로 가정
        const result = this.parseJSONStructured(data);
        cues = result.cues;
        plain = result.plain;
      } else {
        throw new Error("지원되지 않는 자막 데이터 형식");
      }

      const processingTime = Date.now() - startTime;

      return {
        videoId: options?.videoId || "",
        language: options?.language || "unknown",
        extractionMethod: (options?.extractionMethod || "direct") as
          | "direct"
          | "puppeteer"
          | "hybrid",
        timestamp: new Date().toISOString(),
        cues,
        plain,
        metadata: {
          totalCues: cues.length,
          duration: cues.length > 0 ? cues[cues.length - 1].endTime : 0,
          processingTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`자막 파싱 오류: ${error.message}`);
      throw new Error(`자막 파싱 오류: ${error.message}`);
    }
  }

  /**
   * 자막 데이터 파싱 메서드 (이전 호환성 유지)
   */
  public parse(data: any): string {
    if (typeof data === "string") {
      return this.parseXML(data);
    } else if (data?.events) {
      return this.parseJSON(data);
    }
    throw new Error("지원되지 않는 자막 데이터 형식");
  }

  /**
   * XML 형식 자막 파싱 (텍스트만)
   */
  private parseXML(xmlData: string): string {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, "text/xml");
      const textElements = xmlDoc.getElementsByTagName("text");

      let subtitleText = "";

      for (let i = 0; i < textElements.length; i++) {
        const content = textElements[i].textContent;
        if (content) {
          // HTML 엔티티 디코딩
          const decodedText = he.decode(content.trim());
          if (decodedText) {
            subtitleText += decodedText + " ";
          }
        }
      }

      return this.cleanText(subtitleText);
    } catch (error) {
      // Node.js 환경용 서버 측 파싱 (DOMParser 없음)
      return this.parseXMLServer(xmlData);
    }
  }

  /**
   * 서버 환경에서 XML 자막 파싱 (정규식 사용)
   */
  private parseXMLServer(xmlData: string): string {
    try {
      const regex = /<text[^>]*>(.*?)<\/text>/g;
      let match;
      let subtitleText = "";

      while ((match = regex.exec(xmlData)) !== null) {
        if (match[1]) {
          // HTML 엔티티 디코딩
          const decodedText = he.decode(match[1].trim());
          if (decodedText) {
            subtitleText += decodedText + " ";
          }
        }
      }

      return this.cleanText(subtitleText);
    } catch (error: any) {
      this.logger.error(`XML 파싱 오류: ${error.message}`);
      throw new Error(`XML 파싱 오류: ${error.message}`);
    }
  }

  /**
   * XML 형식 자막 구조화 파싱 (시간 정보 포함)
   */
  private parseXMLStructured(xmlData: string): {
    cues: SubtitleCue[];
    plain: string;
  } {
    const cues: SubtitleCue[] = [];
    let plainText = "";

    try {
      // 서버 측 파싱 (DOMParser 없음)
      const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
      let match;

      while ((match = regex.exec(xmlData)) !== null) {
        const startTime = parseFloat(match[1]);
        const duration = parseFloat(match[2]);
        const endTime = startTime + duration;
        const content = match[3] ? he.decode(match[3].trim()) : "";

        if (content) {
          cues.push({
            id: cues.length.toString(),
            startTime,
            endTime,
            text: content,
          });

          plainText += content + " ";
        }
      }

      return {
        cues,
        plain: this.cleanText(plainText),
      };
    } catch (error: any) {
      this.logger.error(`XML 구조화 파싱 오류: ${error.message}`);
      throw new Error(`XML 구조화 파싱 오류: ${error.message}`);
    }
  }

  /**
   * YouTube JSON 형식 자막 파싱 (텍스트만)
   */
  private parseJSON(jsonData: any): string {
    try {
      let subtitleText = "";

      if (jsonData.events) {
        jsonData.events.forEach((event: any) => {
          if (event.segs) {
            event.segs.forEach((seg: any) => {
              if (seg.utf8) {
                subtitleText += seg.utf8 + " ";
              }
            });
          }
        });
      }

      return this.cleanText(subtitleText);
    } catch (error: any) {
      this.logger.error(`JSON 파싱 오류: ${error.message}`);
      throw new Error(`JSON 파싱 오류: ${error.message}`);
    }
  }

  /**
   * YouTube JSON 형식 자막 구조화 파싱 (시간 정보 포함)
   */
  private parseJSONStructured(jsonData: any): {
    cues: SubtitleCue[];
    plain: string;
  } {
    const cues: SubtitleCue[] = [];
    let plainText = "";

    try {
      if (jsonData.events) {
        let currentCueId = 0;

        jsonData.events.forEach((event: any) => {
          if (event.segs && event.tStartMs !== undefined) {
            const startTime = event.tStartMs / 1000; // ms → sec
            const duration = (event.dDurationMs || 0) / 1000; // ms → sec
            const endTime = startTime + duration;

            let cueText = "";

            event.segs.forEach((seg: any) => {
              if (seg.utf8) {
                cueText += seg.utf8;
              }
            });

            if (cueText.trim()) {
              cues.push({
                id: currentCueId.toString(),
                startTime,
                endTime,
                text: cueText.trim(),
              });

              currentCueId++;
              plainText += cueText.trim() + " ";
            }
          }
        });
      }

      return {
        cues,
        plain: this.cleanText(plainText),
      };
    } catch (error: any) {
      this.logger.error(`JSON 구조화 파싱 오류: ${error.message}`);
      throw new Error(`JSON 구조화 파싱 오류: ${error.message}`);
    }
  }

  /**
   * 텍스트 정리 및 포맷팅
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ") // 연속 공백 제거
      .replace(/&#39;/g, "'") // 작은따옴표 처리
      .replace(/&quot;/g, '"') // 큰따옴표 처리
      .replace(/&amp;/g, "&") // 앰퍼샌드 처리
      .replace(/&lt;/g, "<") // 꺾쇠 처리
      .replace(/&gt;/g, ">") // 꺾쇠 처리
      .trim();
  }
}
