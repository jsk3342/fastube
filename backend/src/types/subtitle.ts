/**
 * 자막 추출 옵션
 */
export interface SubtitleExtractionOptions {
  videoId: string;
  language?: string;
  preferredMethod?: "direct" | "puppeteer" | "hybrid";
}

/**
 * 파서 옵션
 */
export interface ParserOptions {
  videoId?: string;
  language?: string;
  extractionMethod?: "direct" | "puppeteer" | "hybrid";
}

/**
 * 개별 자막 큐
 */
export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * 이전 버전 호환성을 위한 자막 라인 인터페이스
 * @deprecated SubtitleCue를 사용하세요
 */
export interface SubtitleLine {
  start: number;
  duration: number;
  text: string;
}

/**
 * 구조화된 자막 데이터
 */
export interface SubtitleData {
  videoId: string;
  language: string;
  extractionMethod: "direct" | "puppeteer" | "hybrid";
  timestamp: string;
  cues: SubtitleCue[];
  plain: string;
  metadata: {
    totalCues: number;
    duration: number;
    processingTime?: number;
    [key: string]: any;
  };
}
