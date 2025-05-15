/**
 * Analytics interfaces
 */

/**
 * Metric value with trend information
 */
export interface MetricValue {
  value: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

/**
 * Content metrics summary
 */
export interface ContentMetrics {
  totalContent: MetricValue;
  totalViews: MetricValue;
  avgEngagement: MetricValue;
  totalShares: MetricValue;
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  date: string;
  views: number;
  engagement: number;
  shares: number;
  count: number;
}

/**
 * Category distribution data point
 */
export interface CategoryDataPoint {
  category: string;
  count: number;
  percentage: number;
  views: number;
  engagement: number;
  shares: number;
}

/**
 * Top content item
 */
export interface TopContentItem {
  id: string;
  title: string;
  slug: string;
  views: number;
  engagement: number;
  shares: number;
  author: {
    id: string;
    name: string;
  };
  publishedAt: string;
}

/**
 * Author performance data
 */
export interface AuthorPerformance {
  id: string;
  name: string;
  contentCount: number;
  totalViews: number;
  avgViews: number;
  totalEngagement: number;
  avgEngagement: number;
}

/**
 * Time grouping for aggregation
 */
export interface TimeGroup {
  year: any;
  month?: any;
  day?: any;
  hour?: any;
  week?: any;
}

/**
 * Date range for queries
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}
