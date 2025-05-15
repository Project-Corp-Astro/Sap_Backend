// Simple in-memory user storage for demonstration
const users = [
  { _id: "1", username: "admin", email: "admin@example.com", password: "password123" }
];

module.exports = {
  findByEmail: (email) => users.find(u => u.email === email),
  findById: (id) => users.find(u => u._id === id),
  getAll: () => users.map(({ password, ...user }) => user), // Remove password from response
  create: (user) => {
    const newUser = { ...user, _id: String(users.length + 1) };
    users.push(newUser);
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },
  update: (id, updates) => {
    const index = users.findIndex(user => user._id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      const { password, ...userWithoutPassword } = users[index];
      return userWithoutPassword;
    }
    return null;
  },
  delete: (id) => {
    const index = users.findIndex(user => user._id === id);
    if (index !== -1) {
      const { password, ...userWithoutPassword } = users[index];
      users.splice(index, 1);
      return userWithoutPassword;
    }
    return null;
  }
};