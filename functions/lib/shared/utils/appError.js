export class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}
//# sourceMappingURL=appError.js.map