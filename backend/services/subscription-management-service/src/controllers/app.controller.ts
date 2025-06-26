import { Request, Response } from 'express';
import { SubscriptionPlanService } from '../services/subscription-plan.service';

export class AppController {
  private subscriptionPlanService: SubscriptionPlanService;

  constructor() {
    this.subscriptionPlanService = new SubscriptionPlanService();
  }

  /**
   * Get all apps for dropdown
   * @route GET /api/apps/dropdown
   * @returns {Array<{id: string, name: string}>}
   */
  async getAppsForDropdown(req: Request, res: Response) {
    try {
      const apps = await this.subscriptionPlanService.getAppsForDropdown();
      return res.json(apps);
    } catch (error:any) {
      res.status(500).json({
        error: 'Failed to fetch apps',
        message: error.message
      });
    }
  }
}
