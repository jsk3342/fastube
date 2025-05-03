export class UrlValidator {
  /**
   * YouTube URL에서 비디오 ID 추출
   */
  public extractVideoId(url: string): string | null {
    if (!url) return null;

    // 다양한 YouTube URL 형식 처리
    const patterns = [
      // 표준 URL: https://www.youtube.com/watch?v=VIDEO_ID
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,

      // 짧은 URL: https://youtu.be/VIDEO_ID
      /(?:https?:\/\/)?youtu\.be\/([^?]+)/,

      // 임베드 URL: https://www.youtube.com/embed/VIDEO_ID
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,

      // YouTube Music: https://music.youtube.com/watch?v=VIDEO_ID
      /(?:https?:\/\/)?music\.youtube\.com\/watch\?v=([^&]+)/,

      // 공유 URL: https://www.youtube.com/shorts/VIDEO_ID
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^?]+)/,
    ];

    // 패턴 매칭 시도
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 직접 비디오 ID가 입력된 경우 (11자리 영숫자)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return null;
  }

  /**
   * URL 유효성 검사
   */
  public isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
}
