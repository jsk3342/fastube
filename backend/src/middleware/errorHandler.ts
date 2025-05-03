import { Request, Response, NextFunction } from "express";
import { createResponse } from "../utils/responseHandler";
import { Logger } from "../utils/logger";

const logger = new Logger("ErrorHandler");

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(`오류 발생: ${err.message}`, err);

  // 특정 오류 타입에 따른 처리
  if (err.message === "SUBTITLE_NOT_FOUND") {
    res
      .status(404)
      .json(createResponse(false, null, "자막을 찾을 수 없습니다"));
    return;
  }

  if (err.message.includes("Navigation timeout")) {
    res
      .status(504)
      .json(createResponse(false, null, "페이지 로딩 시간이 초과되었습니다"));
    return;
  }

  // 기본 서버 오류
  res.status(500).json(createResponse(false, null, "서버 오류가 발생했습니다"));
};
