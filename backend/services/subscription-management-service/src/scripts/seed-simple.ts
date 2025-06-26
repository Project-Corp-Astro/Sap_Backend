/**
 * Simple Database Seeder Script
 * 
 * This script populates the database with test data for development and testing purposes.
 */

import { AppDataSource, initializeDatabase } from '../db/data-source';
import { App } from '../entities/App.entity';
import { PlanFeature } from '../entities/PlanFeature.entity';
import { Payment, PaymentStatus } from '../entities/Payment.entity';
import { PromoCode, DiscountType } from '../entities/PromoCode.entity';
import { Subscription, SubscriptionStatus, PaymentMethod } from '../entities/Subscription.entity';
import { SubscriptionPlan, BillingCycle, PlanStatus } from '../entities/SubscriptionPlan.entity';
import { SubscriptionPromoCode } from '../entities/SubscriptionPromoCode.entity';
import logger from '../utils/logger';




// Helper function to generate UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


// Generate fake user IDs for testing with proper UUID format
const fakeUserIds = Array.from({ length: 10 }, generateUUID);

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');
    
    // Initialize the database connection
    await initializeDatabase();
    
    // Clear existing data from tables with proper foreign key handling
    try {
      logger.info('Clearing existing data with proper foreign key handling...');
      
      // Get list of existing tables
      interface TableInfo {
        table_name: string;
      }
      const tables = await AppDataSource.query<TableInfo[]>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      // Disable foreign key checks temporarily
      await AppDataSource.query('SET CONSTRAINTS ALL DEFERRED');
      
      // Clear tables in reverse dependency order if they exist
      const tableNames = tables.map(row => row.table_name);
      
      // Clear tables in reverse dependency order if they exist
      if (tableNames.includes('payment')) await AppDataSource.query('TRUNCATE TABLE payment RESTART IDENTITY CASCADE');
      if (tableNames.includes('plan_feature')) await AppDataSource.query('TRUNCATE TABLE plan_feature RESTART IDENTITY CASCADE');
      if (tableNames.includes('subscription')) await AppDataSource.query('TRUNCATE TABLE subscription RESTART IDENTITY CASCADE');
      if (tableNames.includes('subscription_plan')) await AppDataSource.query('TRUNCATE TABLE subscription_plan RESTART IDENTITY CASCADE');
      if (tableNames.includes('promo_code')) await AppDataSource.query('TRUNCATE TABLE promo_code RESTART IDENTITY CASCADE');
      if (tableNames.includes('app')) await AppDataSource.query('TRUNCATE TABLE app RESTART IDENTITY CASCADE');
      
      // Re-enable foreign key checks
      await AppDataSource.query('SET CONSTRAINTS ALL IMMEDIATE');
      
      logger.info('Existing tables cleared successfully');
    } catch (error) {
      logger.error('Error clearing tables:', error);
      throw error;
    }
    
    // Create a timestamp to ensure unique names
    const timestamp = Date.now();

    const mockAppsData = [
      { 
        name: 'Corp Astro', 
        color: '#8952e0', 
        logo: 'StarOutlined',
        totalPlans: 3,
        description: 'Corporate Astrology Platform',
        owner: 'corpastro@example.com',
        website: 'https://corpastro.com'
      },
      { 
        name: 'Mobile Astrology', 
        color: '#1890ff', 
        logo: 'MobileOutlined',
        totalPlans: 2,
        description: 'Mobile Astrology App',
        owner: 'mobileastro@example.com',
        website: 'https://mobileastro.com'
      },
      { 
        name: 'Vedic Calendar', 
        color: '#fa8c16', 
        logo: 'CalendarOutlined',
        totalPlans: 2,
        description: 'Vedic Calendar Application',
        owner: 'vediccalendar@example.com',
        website: 'https://vediccalendar.com'
      },
      { 
        name: 'Astro Cloud', 
        color: '#13c2c2', 
        logo: 'CloudOutlined',
        totalPlans: 2,
        description: 'Cloud Astrology Services',
        owner: 'astrocloud@example.com',
        website: 'https://astrocloud.com'
      },
      { 
        name: 'Astro Learn', 
        color: '#52c41a', 
        logo: 'BulbOutlined',
        totalPlans: 2,
        description: 'Astrology Learning Platform',
        owner: 'astrolearn@example.com',
        website: 'https://astrolearn.com'
      },
      { 
        name: 'Astro Business', 
        color: '#f5222d', 
        logo: 'RocketOutlined',
        totalPlans: 2,
        description: 'Business Astrology Solutions',
        owner: 'astrobusiness@example.com',
        website: 'https://astrobusiness.com'
      }
    ];
    
    logger.info('Creating App records...');
    const apps: App[] = [];
    
    for (const appData of mockAppsData) {
      const app = new App();
      app.id = generateUUID();
      app.name = appData.name;
      app.description = appData.description;
      app.owner = appData.owner;
      app.logo = appData.logo;
      app.website = appData.website;
      app.color = appData.color;
      app.totalPlans = appData.totalPlans;
    
      const savedApp = await AppDataSource.manager.save(app);
      apps.push(savedApp);
      logger.info(`Created app: ${savedApp.name} (${savedApp.id})`);
    }
    // 2. Create Subscription Plans (10)
    logger.info('Creating SubscriptionPlan records...');
    const plans: SubscriptionPlan[] = [];
    
    const planNames = [
      'Basic', 'Standard', 'Premium', 'Enterprise', 
      'Starter', 'Professional', 'Ultimate', 'Bronze',
      'Silver', 'Gold'
    ];
    
    // Add timestamp to plan names for uniqueness
    const uniquePlanNames = planNames.map(name => `${name}-${timestamp}`);
    
    for (let i = 0; i < 10; i++) {
      const plan = new SubscriptionPlan();
      plan.name = uniquePlanNames[i];
      plan.description = `${planNames[i]} plan with great features`;
      plan.price = (999 + (i * 1000)) / 100;
      plan.annualPrice = plan.price * 10;
      plan.discountPercentage = 10 + (i * 2);
      plan.billingCycle = i % 3 === 0 ? BillingCycle.MONTHLY : 
                         i % 3 === 1 ? BillingCycle.QUARTERLY : 
                         BillingCycle.YEARLY;
      plan.appId = apps[i % apps.length].id;
      plan.app = apps[i % apps.length];
      plan.trialDays = (i % 3) * 10;
      plan.status = i < 7 ? PlanStatus.ACTIVE : 
                  i === 7 ? PlanStatus.DRAFT : 
                  PlanStatus.ARCHIVED;
      plan.highlight = i < 3 ? 'Popular Choice' : '';
      plan.sortPosition = i;
      plan.version = 1;
      plan.effectiveDate = new Date();
      plan.maxUsers = (i + 1) * 10;
      plan.enterprisePricing = i === 9;
      plan.currency = '₹';
      
      const savedPlan = await AppDataSource.manager.save(plan);
      plans.push(savedPlan);
      logger.info(`Created plan: ${savedPlan.name} (${savedPlan.id})`);
    }
    
    // 3. Create Plan Features (40)
    logger.info('Creating PlanFeature records...');
    const features: PlanFeature[] = [];
    
    const featureOptions = [
      'Unlimited access', 'Priority support', 'Ad-free experience',
      'Premium content', 'Custom exports', 'API access',
      'Advanced analytics', 'Team collaboration', 'White labeling',
      'Custom domain', 'Email support', 'Phone support',
      'Multiple users', 'Offline access', 'Custom reports'
    ];
    
    let featureCount = 0;
    for (const plan of plans) {
      // Add 4 features per plan
      for (let i = 0; i < 4; i++) {
        const feature = new PlanFeature();
        feature.name = featureOptions[(featureCount + i) % featureOptions.length];
        feature.planId = plan.id;
        feature.included = (i < 3); // First 3 features included, last one optional
        feature.limit = (i * 10);
        feature.category = ['Core', 'Support', 'Advanced', 'Add-on'][i % 4];
        feature.description = `${feature.name} for ${plan.name} plan`;
        feature.isPopular = (i === 0);
        
        const savedFeature = await AppDataSource.manager.save(feature);
        features.push(savedFeature);
      }
      featureCount += 4;
    }
    logger.info(`Created ${features.length} plan features`);
    
    // 4. Create Promo Codes (10)
    logger.info('Creating PromoCode records...');
    const promoCodes: PromoCode[] = [];
    
    const promoCodeStrings = [
      'WELCOME10', 'SUMMER25', 'FALL20', 'WINTER30',
      'SPRING15', 'HOLIDAY50', 'FRIEND20', 'LOYAL15',
      'SAVE25', 'FLASH10'
    ];
    
    // Make promo codes unique with timestamp
    const uniquePromoCodes = promoCodeStrings.map(code => `${code}-${timestamp}`);
    
    for (let i = 0; i < 10; i++) {
      const promoCode = new PromoCode();
      promoCode.code = uniquePromoCodes[i];
      promoCode.description = `${promoCodeStrings[i]} promotion`;
      promoCode.discountType = i % 2 === 0 ? DiscountType.PERCENTAGE : DiscountType.FIXED;
      promoCode.discountValue = promoCode.discountType === DiscountType.PERCENTAGE ? 
                             10 + (i * 5) : 500 + (i * 200);
      
      // Set dates for the promo code with proper date calculations
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 10); // Start 10 days ago
      promoCode.startDate = startDate;
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30 + (i * 5)); // End 30-80 days from now
      promoCode.endDate = endDate;
      
      promoCode.usageLimit = 50 + (i * 10);
      promoCode.usageCount = i * 3;
      
      const savedPromoCode = await AppDataSource.manager.save(promoCode);
      promoCodes.push(savedPromoCode);
    }
    logger.info(`Created ${promoCodes.length} promo codes`);
    
    // 5. Create Subscriptions (10)
    logger.info('Creating Subscription records...');
    const subscriptions: Subscription[] = [];
    
    for (let i = 0; i < 10; i++) {
      const subscription = new Subscription();
      subscription.userId = fakeUserIds[i % fakeUserIds.length];
      subscription.planId = plans[i % plans.length].id;
      
      subscription.status = i < 6 ? SubscriptionStatus.ACTIVE : 
                          i < 8 ? SubscriptionStatus.TRIAL : 
                          i < 9 ? SubscriptionStatus.CANCELED : 
                          SubscriptionStatus.PENDING;
                          
      subscription.billingCycle = plans[i % plans.length].billingCycle;
      
      // Add required amount field
      subscription.amount = plans[i % plans.length].price;
      subscription.currency = '₹';
      
      // Set start date to today
      subscription.startDate = new Date();
      
      // Calculate end date based on billing cycle
      const endDate = new Date();
      if (subscription.billingCycle === BillingCycle.MONTHLY) {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (subscription.billingCycle === BillingCycle.QUARTERLY) {
        endDate.setMonth(endDate.getMonth() + 3);
      } else {
        endDate.setMonth(endDate.getMonth() + 12);
      }
      subscription.endDate = endDate;
      
      subscription.cancelAtPeriodEnd = (i >= 8);
      subscription.cancellationReason = subscription.cancelAtPeriodEnd ? 'Too expensive' : '';
      subscription.appId = apps[i % apps.length].id;
      
      subscription.paymentMethod = i % 3 === 0 ? PaymentMethod.CREDIT_CARD : 
                                i % 3 === 1 ? PaymentMethod.BANK_TRANSFER : 
                                PaymentMethod.PAYPAL;
                                
      subscription.autoRenew = !subscription.cancelAtPeriodEnd;
      
      const savedSubscription = await AppDataSource.manager.save(subscription);
      subscriptions.push(savedSubscription);
    }
    logger.info(`Created ${subscriptions.length} subscriptions`);
    
    // 6. Create Subscription Promo Codes (5)
    logger.info('Creating SubscriptionPromoCode records...');
    const subscriptionPromoCodes: SubscriptionPromoCode[] = [];
    
    for (let i = 0; i < 5; i++) {
      const subscriptionPromoCode = new SubscriptionPromoCode();
      subscriptionPromoCode.subscriptionId = subscriptions[i].id;
      subscriptionPromoCode.promoCodeId = promoCodes[i].id;
      
      // Add required discountAmount field
      // Calculate a realistic discount based on the promo code type
      const subscription = subscriptions[i];
      const promoCode = promoCodes[i];
      
      if (promoCode.discountType === DiscountType.PERCENTAGE) {
        // Apply percentage discount
        subscriptionPromoCode.discountAmount = (subscription.amount * promoCode.discountValue) / 100;
      } else {
        // Apply fixed discount (convert from cents to dollars if needed)
        subscriptionPromoCode.discountAmount = promoCode.discountValue / 100;
      }
      
      // Add applied date
      subscriptionPromoCode.appliedDate = new Date();
      subscriptionPromoCode.isActive = true;
      
      const savedSubscriptionPromoCode = await AppDataSource.manager.save(subscriptionPromoCode);
      subscriptionPromoCodes.push(savedSubscriptionPromoCode);
    }
    logger.info(`Created ${subscriptionPromoCodes.length} subscription promo codes`);
    
    // 7. Create Payments (10)
    logger.info('Creating Payment records...');
    const payments: Payment[] = [];
    
    for (let i = 0; i < 10; i++) {
      const payment = new Payment();
      payment.subscriptionId = subscriptions[i].id;
      payment.userId = subscriptions[i].userId;
      payment.amount = (999 + (i * 500)) / 100;
      payment.currency = '₹';
      
      payment.status = i < 7 ? PaymentStatus.SUCCEEDED : 
                     i < 9 ? PaymentStatus.PENDING : 
                     PaymentStatus.FAILED;
                     
      payment.paymentMethod = subscriptions[i].paymentMethod;
      payment.paymentIntentId = `pi_${Date.now()}_${i}`;
      
      // Set billing periods
      payment.billingPeriodStart = new Date(subscriptions[i].startDate);
      payment.billingPeriodEnd = new Date(subscriptions[i].endDate);
      
      const savedPayment = await AppDataSource.manager.save(payment);
      payments.push(savedPayment);
    }
    logger.info(`Created ${payments.length} payments`);
    
    logger.info('Database seeding completed successfully!');
    
    // Close the database connection
    await AppDataSource.destroy();
    
    return {
      success: true,
      counts: {
        apps: apps.length,
        plans: plans.length,
        features: features.length,
        promoCodes: promoCodes.length,
        subscriptions: subscriptions.length,
        subscriptionPromoCodes: subscriptionPromoCodes.length,
        payments: payments.length
      }
    };
  } catch (error) {
    logger.error('Error seeding database:', error);
    
    // Make sure to close the connection even if there's an error
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run the seeder if this file is run directly
if (require.main === module) {
  seedDatabase()
    .then(result => {
      if (result.success) {
        console.log('Database seeding completed successfully!');
        console.log('Records created:', result.counts);
        process.exit(0);
      } else {
        console.error('Database seeding failed:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Uncaught error during database seeding:', err);
      process.exit(1);
    });
}

export default seedDatabase;
