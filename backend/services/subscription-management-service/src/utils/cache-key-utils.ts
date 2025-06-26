export class CacheKeyUtils {
  private static readonly PREFIX = 'subscription:promos';
  private static readonly TTL = 60 * 4; // 4 minutes

  static getPromoCodeKey(promoCodeId: string): string {
    return `${this.PREFIX}:promo:${promoCodeId}`;
  }

  static getValidationKey(promoCodeId: string, userId: string): string {
    return `${this.PREFIX}:validate:${userId}:${promoCodeId}`;
  }

  static getFilterKey(filters: string): string {
    return `${this.PREFIX}:filters:${filters}`;
  }

  static getSubscriptionKey(subscriptionId: string): string {
    return `${this.PREFIX}:subscriptions:${subscriptionId}`;
  }

  static getTTL(): number {
    return this.TTL;
  }

  static getPatternsForPromo(promoCodeId: string): string[] {
    return [
      this.getPromoCodeKey(promoCodeId),
      `promo:validate:*:${promoCodeId}:*`,
      `promos:filters:*:promo:${promoCodeId}`,
      `subscriptions:*:promo:${promoCodeId}`,
    ];
  }
}
