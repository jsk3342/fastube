import { Logger } from "./logger";

export class SubtitleParser {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("SubtitleParser");
  }

  /**
   * 자막 데이터 파싱 메서드
   */
  public parse(data: any): string {
    // JSON 형식 자막 처리
    if (typeof data === "object" && data.events) {
      return this.parseJsonSubtitles(data);
    }

    // XML 형식 자막 처리
    if (typeof data === "string" && data.includes("<transcript>")) {
      return this.parseXmlSubtitles(data);
    }

    this.logger.error("지원되지 않는 자막 형식");
    return "자막을 파싱할 수 없습니다.";
  }

  /**
   * JSON 형식 자막 파싱
   */
  private parseJsonSubtitles(data: any): string {
    try {
      const subtitleSegments = [];

      // 빈 줄 제거 및 중복 방지를 위한 세트
      const uniqueLines = new Set<string>();

      data.events.forEach((event: any) => {
        if (event.segs) {
          const text = event.segs
            .map((seg: any) => seg.utf8 || "")
            .join("")
            .trim();

          // 빈 라인 또는 중복 제거
          if (text && !text.match(/^\s*$/) && !uniqueLines.has(text)) {
            uniqueLines.add(text);
            subtitleSegments.push(text);
          }
        }
      });

      // 자막 텍스트 결합 (각 라인을 띄어쓰기로 구분)
      return subtitleSegments.join(" ");
    } catch (error) {
      this.logger.error(`JSON 자막 파싱 오류: ${error.message}`);
      return "자막 파싱 중 오류가 발생했습니다.";
    }
  }

  /**
   * XML 형식 자막 파싱
   */
  private parseXmlSubtitles(data: string): string {
    try {
      // XML 문자열에서 텍스트 노드 추출
      const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/gi;
      const matches = [...data.matchAll(textRegex)];

      const subtitleSegments = [];
      const uniqueLines = new Set<string>();

      matches.forEach((match) => {
        // HTML 엔티티 디코딩 및 태그 제거
        let text = match[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/<\/?[^>]+(>|$)/g, "")
          .trim();

        if (text && !uniqueLines.has(text)) {
          uniqueLines.add(text);
          subtitleSegments.push(text);
        }
      });

      return subtitleSegments.join(" ");
    } catch (error) {
      this.logger.error(`XML 자막 파싱 오류: ${error.message}`);
      return "자막 파싱 중 오류가 발생했습니다.";
    }
  }
}
