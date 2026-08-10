import { Router } from 'express';
import { listTutorialsHandler, getTutorialHandler } from './tutorials.controller';

export const tutorialsRouter = Router();

tutorialsRouter.get('/', listTutorialsHandler);
tutorialsRouter.get('/:slug', getTutorialHandler);
