import mongoose from 'mongoose';
import UserActivity, { ActivityType } from '../../models/UserActivity';

describe('UserActivity Model Tests', () => {
  const userId = new mongoose.Types.ObjectId();
  
  const activityData = {
    user: userId,
    type: ActivityType.LOGIN,
    description: 'User logged in',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    successful: true
  };

  beforeEach(async () => {
    // Clear activities collection before each test
    await UserActivity.deleteMany({});
  });

  it('should create a new activity successfully', async () => {
    const newActivity = new UserActivity(activityData);
    const savedActivity = await newActivity.save();
    
    expect(savedActivity._id).toBeDefined();
    expect(savedActivity.user.toString()).toBe(userId.toString());
    expect(savedActivity.type).toBe(activityData.type);
    expect(savedActivity.description).toBe(activityData.description);
    expect(savedActivity.ipAddress).toBe(activityData.ipAddress);
    expect(savedActivity.userAgent).toBe(activityData.userAgent);
    expect(savedActivity.successful).toBe(activityData.successful);
    expect(savedActivity.createdAt).toBeDefined();
    expect(savedActivity.updatedAt).toBeDefined();
  });

  it('should fail to create an activity without required fields', async () => {
    const invalidActivity = new UserActivity({
      // Missing required fields
      description: 'Invalid activity'
    });

    await expect(invalidActivity.save()).rejects.toThrow();
  });

  it('should validate activity type enum values', async () => {
    const activityWithInvalidType = new UserActivity({
      ...activityData,
      type: 'invalid_type' // Not in ActivityType enum
    });

    await expect(activityWithInvalidType.save()).rejects.toThrow();
  });

  it('should create activity with default values when not provided', async () => {
    const minimalActivity = new UserActivity({
      user: userId,
      type: ActivityType.LOGOUT,
      description: 'User logged out'
    });

    const savedActivity = await minimalActivity.save();
    
    expect(savedActivity.metadata).toBeDefined();
    expect(savedActivity.ipAddress).toBe('');
    expect(savedActivity.userAgent).toBe('');
    expect(savedActivity.successful).toBe(true);
  });

  it('should store metadata as an object', async () => {
    const activityWithMetadata = new UserActivity({
      ...activityData,
      metadata: {
        browser: 'Chrome',
        os: 'Windows',
        device: 'Desktop'
      }
    });

    const savedActivity = await activityWithMetadata.save();
    
    expect(savedActivity.metadata).toEqual({
      browser: 'Chrome',
      os: 'Windows',
      device: 'Desktop'
    });
  });

  it('should find activities by user ID', async () => {
    // Create multiple activities
    const activity1 = new UserActivity(activityData);
    const activity2 = new UserActivity({
      ...activityData,
      type: ActivityType.PROFILE_UPDATE,
      description: 'User updated profile'
    });
    
    await activity1.save();
    await activity2.save();
    
    // Find activities by user
    const foundActivities = await UserActivity.find({ user: userId });
    
    expect(foundActivities.length).toBe(2);
    expect(foundActivities[0].user.toString()).toBe(userId.toString());
    expect(foundActivities[1].user.toString()).toBe(userId.toString());
  });

  it('should find activities by type', async () => {
    // Create multiple activities with different types
    const activity1 = new UserActivity(activityData);
    const activity2 = new UserActivity({
      ...activityData,
      type: ActivityType.PROFILE_UPDATE,
      description: 'User updated profile'
    });
    
    await activity1.save();
    await activity2.save();
    
    // Find activities by type
    const loginActivities = await UserActivity.find({ type: ActivityType.LOGIN });
    const profileActivities = await UserActivity.find({ type: ActivityType.PROFILE_UPDATE });
    
    expect(loginActivities.length).toBe(1);
    expect(loginActivities[0].type).toBe(ActivityType.LOGIN);
    
    expect(profileActivities.length).toBe(1);
    expect(profileActivities[0].type).toBe(ActivityType.PROFILE_UPDATE);
  });
});
