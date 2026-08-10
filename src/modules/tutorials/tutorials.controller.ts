import { Request, Response } from 'express';
import * as tutorialsService from './tutorials.service';
import { TutorialCategory } from '../../models/Tutorial';

export async function listTutorialsHandler(req: Request, res: Response): Promise<void> {
  await tutorialsService.seedInitialTutorials();
  const category = req.query.category as TutorialCategory | undefined;
  const tutorials = await tutorialsService.listTutorials(category);
  res.status(200).json({ tutorials });
}

export async function getTutorialHandler(req: Request, res: Response): Promise<void> {
  const tutorial = await tutorialsService.getTutorialBySlug(req.params.slug);
  res.status(200).json({ tutorial });
}
