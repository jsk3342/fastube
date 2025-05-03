import { Request, Response, NextFunction } from "express";

// Express 미들웨어 타입 확장
declare global {
  namespace Express {
    interface RequestHandler {
      (req: Request, res: Response, next: NextFunction): any;
    }
  }
}
