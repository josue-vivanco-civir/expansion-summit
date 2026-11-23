export class HttpError extends Error {
  constructor(status, mensaje, extra) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

export const httpError = (status, mensaje, extra) => new HttpError(status, mensaje, extra);
