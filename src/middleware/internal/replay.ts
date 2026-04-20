import { NextFunction, Response } from "express";
import { SettledResponse } from "../../shared";

export function replayExistingResponse(
  promise: Promise<SettledResponse>,
  res: Response,
  next: NextFunction
): void {
  promise
    .then(({ status, body }) => {
      if (!res.headersSent) res.status(status).json(body);
    })
    .catch((err: unknown) => {
      if (!res.headersSent) next(err);
    });
}