import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { 
  UserDocument, 
  IUser, 
  UserRole, 
  ThemePreference, 
  NotificationPreferences,
  UserPreferences,
  SecurityPreferences,
  UserAddress,
  UserDevice,
  AstrologyUserProfile,
  BusinessProfile,
  AstrologyPreferences,
  AstrologySubscriptionTier,
  AstrologySubscription
} from '../../shared/interfaces/user.interface';

// Notification Preferences Schema
const notificationPreferencesSchema = new Schema<NotificationPreferences>({
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: false }
}, { _id: false });

// User Preferences Schema
const userPreferencesSchema = new Schema<UserPreferences>({
  theme: { 
    type: String, 
    enum: Object.values(ThemePreference),
    default: ThemePreference.SYSTEM 
  },
  notifications: { 
    type: notificationPreferencesSchema, 
    default: () => ({
      email: true,
      push: false
    })
  },
  language: { type: String },
  timezone: { type: String }
}, { _id: false });

// Security Preferences Schema
const securityPreferencesSchema = new Schema<SecurityPreferences>({
  twoFactorEnabled: { type: Boolean, default: false },
  loginNotifications: { type: Boolean, default: true },
  activityAlerts: { type: Boolean, default: true },
  trustedDevicesOnly: { type: Boolean },
  passwordExpiryDays: { type: Number }
}, { _id: false });

// User Address Schema
const userAddressSchema = new Schema<UserAddress>({
  street: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  country: { type: String }
}, { _id: false });

// Location Schema (reusable)
const locationSchema = new Schema({
  city: { type: String },
  country: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  timezone: { type: String }
}, { _id: false });

// User Device Schema
const userDeviceSchema = new Schema<UserDevice>({
  deviceId: { type: String, required: true },
  deviceName: { type: String, required: true },
  deviceType: { type: String, required: true },
  browser: { type: String },
  operatingSystem: { type: String },
  lastUsed: { type: Date, default: Date.now },
  ipAddress: { type: String },
  isTrusted: { type: Boolean, default: false },
  userAgent: { type: String },
  location: locationSchema
});

// Astrology User Profile Schema
const astrologyUserProfileSchema = new Schema<AstrologyUserProfile>({
  birthDate: { type: String },
  birthTime: { type: String },
  birthPlace: locationSchema,
  sunSign: { type: String },
  moonSign: { type: String },
  ascendantSign: { type: String },
  chartIds: [{ type: String }]
}, { _id: false });

// Business Profile Schema
const businessProfileSchema = new Schema<BusinessProfile>({
  businessName: { type: String },
  incorporationDate: { type: String },
  incorporationTime: { type: String },
  incorporationPlace: locationSchema,
  industry: { type: String },
  size: { 
    type: String, 
    enum: ['startup', 'small', 'medium', 'large', 'enterprise'] 
  },
  chartIds: [{ type: String }]
});

// Astrology Preferences Schema
const astrologyPreferencesSchema = new Schema<AstrologyPreferences>({
  preferredZodiacSystem: { 
    type: String, 
    enum: ['tropical', 'sidereal'] 
  },
  preferredHouseSystem: { type: String },
  preferredAyanamsa: { type: String },
  preferredChartStyle: { 
    type: String, 
    enum: ['western', 'vedic', 'modern'] 
  },
  includeAsteroids: { type: Boolean },
  showTransits: { type: Boolean },
  dailyHoroscopeEnabled: { type: Boolean, default: true },
  weeklyHoroscopeEnabled: { type: Boolean, default: true },
  monthlyHoroscopeEnabled: { type: Boolean, default: true },
  yearlyHoroscopeEnabled: { type: Boolean, default: true },
  transitAlertsEnabled: { type: Boolean, default: false },
  retrogradeAlertsEnabled: { type: Boolean, default: false },
  newMoonAlertsEnabled: { type: Boolean, default: false },
  fullMoonAlertsEnabled: { type: Boolean, default: false }
}, { _id: false });

// Astrology Subscription Schema
const astrologySubscriptionSchema = new Schema<AstrologySubscription>({
  tier: { 
    type: String, 
    enum: Object.values(AstrologySubscriptionTier),
    default: AstrologySubscriptionTier.FREE 
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  autoRenew: { type: Boolean, default: false },
  features: [{ type: String }],
  aiChatCredits: { type: Number, default: 0 },
  specialistConsultationCredits: { type: Number, default: 0 },
  customReportCredits: { type: Number, default: 0 }
}, { _id: false });

// Main User Schema
const userSchema = new Schema<UserDocument>({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true,
    select: false // Don't return password by default in queries
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phoneNumber: { type: String },
  role: { 
    type: String, 
    enum: Object.values(UserRole),
    default: UserRole.USER 
  },
  // Add application-specific roles and permissions
  applicationRoles: [{
    application: { type: String, required: true }, // 'superadmin', 'app1', 'app2'
    role: { type: String, required: true },        // 'admin', 'manager', 'user'
    permissions: [String]                          // Override permissions
  }],
    // Add to track permission changes
    permissionVersion: { type: Number, default: 1 },
  permissions: [{ type: String }],
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  lastLogin: { type: Date },
  avatar: { type: String },
  address: userAddressSchema,
  metadata: { type: Map, of: Schema.Types.Mixed },
  preferences: { 
    type: userPreferencesSchema, 
    default: () => ({
      theme: ThemePreference.SYSTEM,
      notifications: {
        email: true,
        push: false
      }
    })
  },
  securityPreferences: { 
    type: securityPreferencesSchema,
    default: () => ({
      twoFactorEnabled: false,
      loginNotifications: true,
      activityAlerts: true
    })
  },
  devices: [userDeviceSchema],
  
  // Astrology-specific properties
  astrologyProfile: astrologyUserProfileSchema,
  businessProfiles: [businessProfileSchema],
  astrologyPreferences: astrologyPreferencesSchema,
  astrologySubscription: astrologySubscriptionSchema,
  subscriptionId: { type: String }
}, { 
  timestamps: true, // Adds createdAt and updatedAt fields
  versionKey: false // Don't include __v field
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    // Hash the password along with the new salt
    // Use get() method to access the password field
    const password = this.get('password') as string;
    // Use set() method to set the password field
    this.set('password', await bcrypt.hash(password, salt));
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    // @ts-ignore - this.password exists even though it's not in the interface
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Create and export the model
const UserModel = mongoose.model<UserDocument>('User', userSchema);

export default UserModel;
