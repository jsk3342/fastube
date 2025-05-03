import { Logger } from "./logger";

const logger = new Logger("UrlParser");

/**
 * URL 파서 유틸리티
 * 다양한 형식의 YouTube URL에서 비디오 ID를 추출하는 함수
 */

/**
 * YouTube URL에서 비디오 ID를 추출
 * @param url YouTube 비디오 URL
 * @returns 추출된 비디오 ID 또는 null
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null;

  // 일반 YouTube URL 형식
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);

  if (match && match[7].length === 11) {
    return match[7];
  }

  // 짧은 URL 형식 (ex: youtu.be/VIDEO_ID)
  const shortUrlRegExp = /^.*(youtu.be\/)(.*)/;
  const shortMatch = url.match(shortUrlRegExp);

  if (shortMatch && shortMatch[2].length === 11) {
    return shortMatch[2];
  }

  // 이미 비디오 ID 형식인 경우 (11자리 문자)
  if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  return null;
}
