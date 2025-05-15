require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Category, Content } = require('../src/models');

const initDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/content-service', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    });

    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Content.deleteMany({}),
    ]);

    console.log('Cleared existing data');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      displayName: 'Admin User',
      isActive: true,
    });

    // Create categories
    const categories = await Category.create([
      { name: 'Astrology', description: 'Astrology related content', createdBy: adminUser._id },
      { name: 'Horoscope', description: 'Daily, weekly, and monthly horoscopes', createdBy: adminUser._id },
      { name: 'Zodiac Signs', description: 'Information about zodiac signs', createdBy: adminUser._id },
      { name: 'Moon Phases', description: 'Moon phases and their meanings', createdBy: adminUser._id },
      { name: 'Crystals', description: 'Healing crystals and their properties', createdBy: adminUser._id },
    ]);

    // Create sample content
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    const sampleContent = [
      {
        title: 'Understanding Your Sun Sign',
        description: 'A comprehensive guide to understanding your sun sign in astrology',
        content: 'Your sun sign represents your core identity and life purpose...',
        type: 'article',
        status: 'published',
        author: adminUser._id,
        categories: [categories[0]._id, categories[2]._id],
        tags: ['sun sign', 'astrology basics', 'zodiac'],
        featuredImage: 'https://example.com/images/sun-sign.jpg',
        seo: {
          metaTitle: 'Understanding Your Sun Sign - Astrology Guide',
          metaDescription: 'Learn what your sun sign means and how it influences your personality and life path.',
          keywords: ['sun sign', 'astrology', 'zodiac signs'],
        },
        createdBy: adminUser._id,
      },
      {
        title: 'Weekly Horoscope: May 5-11',
        description: 'Your weekly horoscope for all zodiac signs',
        content: 'This week brings exciting opportunities for all signs...',
        type: 'article',
        status: 'published',
        publishDate: now,
        author: adminUser._id,
        categories: [categories[1]._id],
        tags: ['weekly horoscope', 'may 2024', 'zodiac'],
        createdBy: adminUser._id,
      },
      {
        title: 'Full Moon in Scorpio: Transformation',
        description: 'How the full moon in Scorpio will affect each zodiac sign',
        content: 'The full moon in Scorpio brings intense energy for transformation...',
        type: 'article',
        status: 'scheduled',
        publishDate: nextWeek,
        author: adminUser._id,
        categories: [categories[0]._id, categories[3]._id],
        tags: ['full moon', 'scorpio', 'moon phases'],
        createdBy: adminUser._id,
      },
    ];

    await Content.insertMany(sampleContent);

    console.log('Database initialized with sample data');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

initDatabase();
