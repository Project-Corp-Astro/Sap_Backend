"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromoCodeAnalyticsController = void 0;
const error_handler_1 = require("../../utils/error-handler");
const promo_code_analytics_service_1 = require("../../services/promo-code-analytics.service");
const logger_1 = __importDefault(require("../../utils/logger"));
// Create the singleton instance
const promoCodeAnalyticsService = promo_code_analytics_service_1.PromoCodeAnalyticsService.getInstance();
/**
 * Controller for promo code analytics
 */
class PromoCodeAnalyticsController {
    /**
     * Get comprehensive promo code analytics
     */
    getAnalytics(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const analytics = yield promoCodeAnalyticsService.getAnalytics();
                res.status(200).json(analytics);
            }
            catch (error) {
                if (error instanceof Error) {
                    logger_1.default.error('Error getting promo code analytics:', { error: error.message, stack: error.stack });
                    res.status(500).json((0, error_handler_1.formatErrorResponse)(error.message));
                }
                else {
                    logger_1.default.error('Error getting promo code analytics:', { error: String(error) });
                    res.status(500).json((0, error_handler_1.formatErrorResponse)('Unknown error occurred while fetching promo code analytics'));
                }
            }
        });
    }
}
exports.PromoCodeAnalyticsController = PromoCodeAnalyticsController;
exports.default = new PromoCodeAnalyticsController();
