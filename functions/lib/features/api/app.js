import cors from 'cors';
import express from 'express';
import { errorHandler } from '../../shared/middleware/errorHandler.js';
import { notFound } from '../../shared/middleware/notFound.js';
import { adminsRouter } from './admins/admins.routes.js';
const ALLOWED_ORIGINS = ['http://localhost:8080'];
export const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
app.use('/admins', adminsRouter);
app.use(notFound);
app.use(errorHandler);
//# sourceMappingURL=app.js.map