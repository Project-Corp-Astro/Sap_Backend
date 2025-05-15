import mongoose, { Schema, model } from 'mongoose';
/**
 * User role enum
 */
export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["EDITOR"] = "editor";
    UserRole["AUTHOR"] = "author";
    UserRole["VIEWER"] = "viewer";
})(UserRole || (UserRole = {}));
/**
 * Theme enum
 */
export var Theme;
(function (Theme) {
    Theme["LIGHT"] = "light";
    Theme["DARK"] = "dark";
    Theme["SYSTEM"] = "system";
})(Theme || (Theme = {}));
// Prevent model from being redefined if already exists
let User;
if (mongoose.models.User) {
    User = mongoose.model('User');
}
else {
    const userSchema = new Schema({
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        displayName: {
            type: String,
            trim: true,
        },
        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.VIEWER,
        },
        avatar: {
            type: String,
            default: '',
        },
        bio: {
            type: String,
            default: '',
        },
        socialLinks: {
            facebook: String,
            twitter: String,
            linkedin: String,
            instagram: String,
            website: String,
        },
        preferences: {
            notifications: {
                email: {
                    type: Boolean,
                    default: true,
                },
                push: {
                    type: Boolean,
                    default: true,
                },
            },
            theme: {
                type: String,
                enum: Object.values(Theme),
                default: Theme.SYSTEM,
            },
            language: {
                type: String,
                default: 'en',
            },
        },
        stats: {
            contentCount: {
                type: Number,
                default: 0,
            },
            followers: {
                type: Number,
                default: 0,
            },
            following: {
                type: Number,
                default: 0,
            },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
        },
        metadata: {
            createdAt: {
                type: Date,
                default: Date.now,
            },
            updatedAt: {
                type: Date,
                default: Date.now,
            },
        },
    }, {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    });
    // Indexes for better query performance
    userSchema.index({ username: 1 }, { unique: true });
    userSchema.index({ email: 1 }, { unique: true });
    userSchema.index({ role: 1 });
    userSchema.index({ 'metadata.createdAt': -1 });
    // Virtual for user's full URL
    userSchema.virtual('url').get(function () {
        return `/users/${this.username}`;
    });
    // Pre-save hook to update timestamps
    userSchema.pre('save', function (next) {
        this.metadata.updatedAt = new Date();
        next();
    });
    // Method to get user's full name
    userSchema.methods.getFullName = function () {
        return this.displayName || this.username;
    };
    // Static method to find active users
    userSchema.statics.findActive = function () {
        return this.find({ isActive: true });
    };
    User = model('User', userSchema);
}
export default User;
