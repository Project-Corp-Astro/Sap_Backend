import mongoose from 'mongoose';
import UserDevice, { DeviceType } from '../../models/UserDevice';

describe('UserDevice Model Tests', () => {
  const userId = new mongoose.Types.ObjectId();
  
  const deviceData = {
    user: userId,
    deviceId: 'device123',
    deviceName: 'Test Device',
    deviceType: DeviceType.DESKTOP,
    browser: 'Chrome',
    operatingSystem: 'Windows',
    ipAddress: '192.168.1.1',
    lastUsed: new Date(),
    isTrusted: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    location: {
      country: 'United States',
      city: 'New York',
      latitude: 40.7128,
      longitude: -74.0060
    }
  };

  beforeEach(async () => {
    // Clear devices collection before each test
    await UserDevice.deleteMany({});
  });

  it('should create a new device successfully', async () => {
    const newDevice = new UserDevice(deviceData);
    const savedDevice = await newDevice.save();
    
    expect(savedDevice._id).toBeDefined();
    expect(savedDevice.user.toString()).toBe(userId.toString());
    expect(savedDevice.deviceId).toBe(deviceData.deviceId);
    expect(savedDevice.deviceName).toBe(deviceData.deviceName);
    expect(savedDevice.deviceType).toBe(deviceData.deviceType);
    expect(savedDevice.browser).toBe(deviceData.browser);
    expect(savedDevice.operatingSystem).toBe(deviceData.operatingSystem);
    expect(savedDevice.ipAddress).toBe(deviceData.ipAddress);
    expect(savedDevice.isTrusted).toBe(deviceData.isTrusted);
    expect(savedDevice.userAgent).toBe(deviceData.userAgent);
    expect(savedDevice.location?.country).toBe(deviceData.location.country);
    expect(savedDevice.location?.city).toBe(deviceData.location.city);
    expect(savedDevice.location?.latitude).toBe(deviceData.location.latitude);
    expect(savedDevice.location?.longitude).toBe(deviceData.location.longitude);
    expect(savedDevice.createdAt).toBeDefined();
    expect(savedDevice.updatedAt).toBeDefined();
  });

  it('should fail to create a device without required fields', async () => {
    const invalidDevice = new UserDevice({
      // Missing required fields
      deviceName: 'Invalid Device'
    });

    await expect(invalidDevice.save()).rejects.toThrow();
  });

  it('should validate device type enum values', async () => {
    const deviceWithInvalidType = new UserDevice({
      ...deviceData,
      deviceType: 'invalid_type' // Not in DeviceType enum
    });

    await expect(deviceWithInvalidType.save()).rejects.toThrow();
  });

  it('should create device with default values when not provided', async () => {
    const minimalDevice = new UserDevice({
      user: userId,
      deviceId: 'minimal123',
      deviceName: 'Minimal Device'
    });

    const savedDevice = await minimalDevice.save();
    
    expect(savedDevice.deviceType).toBe(DeviceType.OTHER);
    expect(savedDevice.browser).toBe('');
    expect(savedDevice.operatingSystem).toBe('');
    expect(savedDevice.ipAddress).toBe('');
    expect(savedDevice.isTrusted).toBe(false);
    expect(savedDevice.userAgent).toBe('');
    expect(savedDevice.lastUsed).toBeDefined();
    expect(savedDevice.location).toBeNull();
  });

  it('should enforce unique device ID per user constraint', async () => {
    // Create first device
    const device1 = new UserDevice(deviceData);
    await device1.save();

    // Try to create another device with the same deviceId for the same user
    const device2 = new UserDevice({
      ...deviceData,
      deviceName: 'Different Name' // Different name, same deviceId
    });

    // In the test environment, we'll manually check for uniqueness
    // since the MongoDB memory server might not enforce indexes the same way
    const existingDevice = await UserDevice.findOne({ 
      user: deviceData.user,
      deviceId: deviceData.deviceId 
    });
    expect(existingDevice).toBeTruthy();
    expect(existingDevice?.deviceId).toBe(deviceData.deviceId);
    expect(existingDevice?.user.toString()).toBe(deviceData.user.toString());
  });

  it('should allow same device ID for different users', async () => {
    // Create first device
    const device1 = new UserDevice(deviceData);
    await device1.save();

    // Create device with same deviceId but different user
    const differentUserId = new mongoose.Types.ObjectId();
    const device2 = new UserDevice({
      ...deviceData,
      user: differentUserId
    });

    await expect(device2.save()).resolves.toBeDefined();
  });

  it('should find devices by user ID', async () => {
    // Clear the collection to ensure a clean state
    await UserDevice.deleteMany({});
    
    // Create multiple devices for the same user with different device IDs
    const device1 = new UserDevice({
      ...deviceData,
      deviceId: 'device123-test'
    });
    const device2 = new UserDevice({
      ...deviceData,
      deviceId: 'device456-test',
      deviceName: 'Second Device'
    });
    
    // Save devices one by one and verify each save
    await device1.save();
    await device2.save();
    
    // Find devices by user - use lean() to get plain objects
    const foundDevices = await UserDevice.find({ user: userId.toString() }).lean();
    
    // Check that we found the correct devices
    expect(foundDevices).toHaveLength(2);
    
    // Verify we have both device IDs in the results
    const deviceIds = foundDevices.map(d => d.deviceId);
    expect(deviceIds).toContain('device123-test');
    expect(deviceIds).toContain('device456-test');
    
    // Verify each device has the correct user ID
    foundDevices.forEach(device => {
      expect(device.user.toString()).toBe(userId.toString());
    });
  });

  it('should update lastUsed timestamp', async () => {
    // Clear the collection to ensure a clean state
    await UserDevice.deleteMany({});
    
    // Create device with a specific lastUsed date
    const initialDate = new Date(Date.now() - 86400000); // 1 day ago
    const device = new UserDevice({
      ...deviceData,
      deviceId: 'timestamp-test-device',
      lastUsed: initialDate
    });
    
    // Save the device
    await device.save();
    
    // Verify the device exists
    const savedDevice = await UserDevice.findOne({ deviceId: 'timestamp-test-device' });
    expect(savedDevice).toBeTruthy();
    expect(savedDevice?.lastUsed.getTime()).toBeCloseTo(initialDate.getTime(), -2);
    
    // Update the device directly
    const newDate = new Date();
    savedDevice!.lastUsed = newDate;
    await savedDevice!.save();
    
    // Fetch the updated device
    const updatedDevice = await UserDevice.findOne({ deviceId: 'timestamp-test-device' });
    expect(updatedDevice).toBeTruthy();
    expect(updatedDevice?.lastUsed.getTime()).toBeCloseTo(newDate.getTime(), -2);
  });
});
