import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { createResponse } from "../utils/responseHandler";

// 자막 추출 요청 검증
export const validateSubtitleRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const schema = Joi.object({
    url: Joi.string().required().messages({
      "string.empty": "URL은 필수 입력 항목입니다",
      "any.required": "URL은 필수 입력 항목입니다",
    }),
    language: Joi.string().default("ko").messages({
      "string.empty": "언어 코드는 유효한 문자열이어야 합니다",
    }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res
      .status(400)
      .json(createResponse(false, null, error.details[0].message));
  }

  req.body = value;
  next();
};

// 비디오 정보 요청 검증
export const validateVideoInfoRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const schema = Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "비디오 ID는 필수 입력 항목입니다",
      "any.required": "비디오 ID는 필수 입력 항목입니다",
    }),
  });

  const { error, value } = schema.validate(req.query);

  if (error) {
    return res
      .status(400)
      .json(createResponse(false, null, error.details[0].message));
  }

  req.query = value;
  next();
};
