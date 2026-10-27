// Erros de domínio — traduzidos para códigos HTTP em utils/httpError.ts
export class ValidationError extends Error {}    // 400
export class UnauthorizedError extends Error {}  // 401
export class ForbiddenError extends Error {}     // 403
export class NotFoundError extends Error {}      // 404
export class ConflictError extends Error {}      // 409

// 409 específico da história: quem gravou estava baseado numa revisão que não é mais a atual
// (outra aba ou dispositivo gravou antes). Leva a revisão atual para o cliente decidir.
export class StaleRevisionError extends ConflictError {
  constructor(message: string, readonly currentRevision: number) {
    super(message);
  }
}
