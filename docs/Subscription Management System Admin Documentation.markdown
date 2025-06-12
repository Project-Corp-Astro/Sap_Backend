# Subscription Management System Admin Documentation

## 1. System Overview

### 1.1 Purpose
The subscription management system is a SaaS platform designed to manage subscription-based astrology services across multiple applications (e.g., Corp Astro, Mobile Astrology). From the admin perspective, the system enables administrators to:
- Create, edit, and analyze subscription plans with varying features and pricing.
- Monitor and manage user subscriptions, including activation, cancellation, and renewals.
- Design and track promotional codes to drive user acquisition and retention.
- Analyze key metrics (e.g., revenue, churn rate, promo code usage) to optimize business performance.

The system is built with a React front-end (using TypeScript, Ant Design, and Day.js) and assumes a Node.js/Express backend with a PostgreSQL database. Administrators access the system via a secure dashboard, authenticated using JWT.

### 1.2 Key Components
- **SubscriptionPlans**: Manages subscription plans offered across apps.
- **UserSubscriptions**: Oversees individual user subscriptions.
- **PromoCodes**: Handles promotional codes for discounts.
- **Analytics**: Provides cross-module insights (revenue, subscribers, redemptions).

### 1.3 Target Audience
- **Administrators**: Manage plans, subscriptions, promo codes, and analytics.
- **Business Context**: Supports a multi-app astrology service with tiered subscription plans (Basic, Premium, Enterprise).

### 1.4 Technologies
- **Front-End**: React, TypeScript, Ant Design, Day.js, Chart.js.
- **Backend**: Node.js + Express (recommended).
- **Database**: PostgreSQL (recommended).
- **Tools**: Git, VS Code, Vercel (front-end), AWS (backend/database), Prisma (ORM).

## 2. Admin Functionalities and Workflows

### 2.1 Subscription Plans Management (`SubscriptionPlans` Component)
- **Purpose**: Create, edit, and analyze subscription plans for different apps.
- **Functionalities**:
  - **View Plans**: Display plans in grid or list view, filter by app (e.g., Corp Astro), status (active, draft, archived), or search by name/description.
  - **Create/Edit Plans**: Use a drawer to input plan details (name, price, billing cycle, trial days) and manage features (e.g., Daily Horoscope, Priority Support).
  - **Compare Plans**: Select multiple plans to compare features.
  - **Batch Operations**: Activate, archive, or delete multiple plans.
  - **Duplicate Plans**: Copy existing plans for quick setup.
  - **Analytics**: View metrics (total plans, subscribers, average price, plan distribution).
- **Workflow**:
  1. Log into the admin dashboard and navigate to "Subscription Plans."
  2. Filter plans by app or status; sort by price or subscribers.
  3. Create a new plan (e.g., "Enterprise Plus," ₹2999/month) or edit an existing one.
  4. Assign features (e.g., Astro AI Assistant) and set trial days.
  5. Compare plans to ensure differentiation.
  6. Activate draft plans or archive outdated ones.
  7. Review analytics (e.g., Premium Plan has 150 subscribers).
- **Database Tables**:
  - **Apps**: Application details (e.g., Corp Astro).
    - Columns: `id`, `name`, `color`, `icon`, `created_at`, `active_users`, `plans_count`.
  - **SubscriptionPlans**: Plan details.
    - Columns: `id`, `app_id`, `name`, `description`, `price`, `annual_price`, `discount_percentage`, `billing_cycle`, `trial_days`, `status`, `highlight`, `sort_position`, `version`, `effective_date`, `created_at`, `updated_at`, `subscribers`, `max_users`, `currency`, `growth_rate`, `conversion_rate`, `churn_rate`.
  - **PlanFeatures**: Plan-specific features.
    - Columns: `id`, `plan_id`, `name`, `category`, `included`, `limit`, `description`, `is_popular`.

### 2.2 User Subscriptions Management (`UserSubscriptions` Component)
- **Purpose**: Monitor and manage individual user subscriptions.
- **Functionalities**:
  - **View Subscriptions**: Table view with filters (status, plan, user name/email) and sorting.
  - **Manage Subscriptions**: View details, change plans, renew, cancel, or send reminders.
  - **Bulk Actions**: Renew, cancel, or send reminders for multiple subscriptions.
  - **Export**: Export subscriptions as CSV.
  - **Analytics**: Metrics (total subscribers, MRR, churn rate, trial conversions).
  - **Notifications**: Alerts for expiring subscriptions or failed payments.
- **Workflow**:
  1. Navigate to "User Subscriptions."
  2. Filter by status (e.g., trial) or search for a user.
  3. View details (e.g., John Doe’s Premium Plan, next payment June 15, 2025).
  4. Renew or cancel a subscription; send reminders for failed payments.
  5. Perform bulk renewals for expiring subscriptions.
  6. Export data for reporting.
  7. Analyze metrics (e.g., 3.2% churn, $12,800 MRR).
- **Database Tables**:
  - **Users**: User information.
    - Columns: `id`, `name`, `email`, `avatar_url`, `created_at`.
  - **Subscriptions**: User subscription details.
    - Columns: `id`, `user_id`, `plan_id`, `price`, `currency`, `billing_cycle`, `start_date`, `end_date`, `next_payment_date`, `status`, `payment_method`, `auto_renew`, `created_at`, `trial_ends_at`.
  - **SubscriptionEvents**: Subscription events (e.g., created, cancelled).
    - Columns: `id`, `subscription_id`, `event`, `description`, `timestamp`, `metadata`.
  - **Invoices**: Payment invoices.
    - Columns: `id`, `subscription_id`, `amount`, `currency`, `status`, `due_date`, `paid_date`, `created_at`.
  - **InvoiceItems**: Invoice line items.
    - Columns: `id`, `invoice_id`, `description`, `amount`, `quantity`.

### 2.3 Promo Codes Management (`PromoCodes` Component)
- **Purpose**: Create and track promotional codes to incentivize subscriptions.
- **Functionalities**:
  - **View Promo Codes**: Table view with filters (status, discount type, search) and sorting.
  - **Create/Edit Codes**: Modal for code details (code, discount, valid period, restrictions).
  - **Manage Codes**: Activate, deactivate, delete, or copy codes.
  - **Bulk Actions**: Activate, deactivate, or delete multiple codes.
  - **Analytics**: Metrics (redemptions, discount value, redemption rate, code performance).
  - **Export**: Placeholder for Excel, PDF, or print export.
- **Workflow**:
  1. Navigate to "Promo Codes."
  2. Filter by active codes or percentage discounts; search for a code.
  3. Create a new code (e.g., `SUMMER25`, 25% off Premium Plan) or edit one.
  4. Restrict codes to plans (e.g., Premium) or users (e.g., VIP Users).
  5. Deactivate codes that reach usage limits.
  6. Analyze performance (e.g., `PREMIUM10` has 890 redemptions).
  7. Export data for marketing analysis.
- **Database Tables**:
  - **PromoCodes**: Promo code details.
    - Columns: `id`, `app_id` (optional), `code`, `description`, `discount_type`, `discount_value`, `start_date`, `end_date`, `usage_limit`, `usage_count`, `min_purchase_amount`, `max_discount_amount`, `is_active`, `is_first_time_only`, `applicable_to`, `applicable_items`, `created_at`, `updated_at`.
  - **SubscriptionPromoCodes**: Links subscriptions to promo codes.
    - Columns: `id`, `subscription_id`, `promo_code_id`, `discount_amount`, `applied_at`.
  - **PromoCodeApplicablePlans**: Links promo codes to plans.
    - Columns: `id`, `promo_code_id`, `plan_id`.
  - **PromoCodeApplicableUsers**: Links promo codes to users.
    - Columns: `id`, `promo_code_id`, `user_id`.

### 2.4 Analytics Across Modules
- **Purpose**: Provide insights to optimize plans, subscriptions, and promotions.
- **Functionalities**:
  - **SubscriptionPlans**: Plan distribution, subscriber growth, MRR.
  - **UserSubscriptions**: Churn rate, trial conversions, revenue trends.
  - **PromoCodes**: Redemption rates, total discounts, code performance.
- **Workflow**:
  1. Toggle to analytics view in any module.
  2. Review metrics (e.g., 45% Premium Plan subscribers, 67.8% promo code redemption rate).
  3. Correlate promo code usage with subscription growth.
  4. Adjust strategies (e.g., extend `WELCOME20` due to high conversions).

## 3. Admin User Flow for Supporting User Purchases with Promo Codes
Admins indirectly support the user purchase process by managing plans and promo codes, which users access during subscription purchases. The user flow (from the admin’s perspective) is:

1. **Plan Setup**:
   - Admin creates a plan (e.g., Premium, ₹999/month) in `SubscriptionPlans`, ensuring it’s active and visible to users.
   - Table: `SubscriptionPlans`, `PlanFeatures`.

2. **Promo Code Creation**:
   - Admin creates a promo code (e.g., `WELCOME20`, 20% off) in `PromoCodes`, restricting it to specific plans or users if needed.
   - Tables: `PromoCodes`, `PromoCodeApplicablePlans`, `PromoCodeApplicableUsers`.

3. **User Purchase Monitoring**:
   - When a user purchases a subscription (e.g., Premium with `WELCOME20`), the admin sees the new subscription in `UserSubscriptions`.
   - The discount is recorded in `SubscriptionPromoCodes`, and `PromoCodes.usage_count` increments.
   - Tables: `Subscriptions`, `SubscriptionPromoCodes`, `Invoices`, `InvoiceItems`.

4. **Analytics Review**:
   - Admin checks `PromoCodes` analytics to see `WELCOME20`’s impact (e.g., 438 redemptions, ₹8760 discount).
   - Reviews `UserSubscriptions` for new subscribers and `SubscriptionPlans` for plan popularity.
   - Tables: All tables contribute to analytics.

## 4. Database Schema
The system uses the following PostgreSQL tables, ensuring relational integrity:
- **Apps**: Application details.
- **Users**: User data.
- **SubscriptionPlans**: Subscription plans.
- **PlanFeatures**: Plan features.
- **Subscriptions**: User subscriptions.
- **SubscriptionEvents**: Subscription events.
- **Invoices**: Payment invoices.
- **InvoiceItems**: Invoice line items.
- **PromoCodes**: Promotional codes.
- **SubscriptionPromoCodes**: Links subscriptions to promo codes.
- **PromoCodeApplicablePlans**: Links promo codes to plans.
- **PromoCodeApplicableUsers**: Links promo codes to users.

## 5. Admin Dashboard Experience
- **Access**: Secure login at `/admin` with JWT authentication.
- **Navigation**: Sidebar links to Subscription Plans, User Subscriptions, Promo Codes, and Analytics.
- **Interface**:
  - Tables/grids with filtering, sorting, and search.
  - Modals/drawers for data entry.
  - Analytics with charts (e.g., plan distribution, redemption trends).
  - Dark mode support.
- **Security**: Role-based access, input validation, and rate limiting.

## 6. Potential Challenges
- **Data Management**: Filtering large datasets requires efficient queries.
- **Promo Code Abuse**: Monitor `usage_count` and validate restrictions.
- **Analytics Accuracy**: Ensure consistency across tables (e.g., `SubscriptionPromoCodes` vs. `Invoices`).
- **Scalability**: Handle high volumes of subscriptions and redemptions.

## 7. Next Steps
- Implement payment gateway (e.g., Stripe, Razorpay) for user purchases.
- Develop export functionality for `PromoCodes` (Excel, PDF).
- Scale database with indexes and caching (e.g., Redis).
- Add real-time analytics via WebSockets.