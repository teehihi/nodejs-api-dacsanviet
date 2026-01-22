const { pool } = require('../config/database');

class User {
  constructor(userData) {
    this.username = userData.username;
    this.email = userData.email;
    this.password = userData.password;
    this.fullName = userData.fullName;
    this.phoneNumber = userData.phoneNumber || null;
    this.role = userData.role || 'USER';
    this.isActive = true;
  }

  // Tạo user mới
  static async create(userData) {
    try {
      const user = new User(userData);
      
      const [result] = await pool.execute(`
        INSERT INTO users (username, email, password, full_name, phone_number, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        user.username,
        user.email,
        user.password,
        user.fullName,
        user.phoneNumber,
        user.role,
        user.isActive ? 1 : 0
      ]);

      if (result.affectedRows > 0) {
        return await User.findById(result.insertId);
      }
      return null;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Tìm user theo email
  static async findByEmail(email) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE email = ? AND is_active = 1',
        [email]
      );
      
      return rows.length > 0 ? User.formatUser(rows[0]) : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Tìm user theo username
  static async findByUsername(username) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        [username]
      );
      
      return rows.length > 0 ? User.formatUser(rows[0]) : null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  // Tìm user theo ID
  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? User.formatUser(rows[0]) : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Lấy tất cả users
  static async findAll(limit = 100, offset = 0) {
    try {
      const [rows] = await pool.execute(`
        SELECT id, username, email, full_name, phone_number, role, is_active, 
               created_at, updated_at
        FROM users 
        ORDER BY created_at DESC 
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `);
      
      return rows.map(User.formatUser);
    } catch (error) {
      console.error('Error finding all users:', error);
      throw error;
    }
  }

  // Kiểm tra email đã tồn tại
  static async emailExists(email) {
    try {
      const [rows] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking email exists:', error);
      throw error;
    }
  }

  // Kiểm tra username đã tồn tại
  static async usernameExists(username) {
    try {
      const [rows] = await pool.execute(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );
      
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking username exists:', error);
      throw error;
    }
  }

  // Cập nhật user
  static async updateById(id, updateData) {
    try {
      const fields = [];
      const values = [];
      
      // Build dynamic update query
      Object.keys(updateData).forEach(key => {
        if (key === 'fullName') {
          fields.push('full_name = ?');
          values.push(updateData[key]);
        } else if (key === 'isActive') {
          fields.push('is_active = ?');
          values.push(updateData[key] ? 1 : 0);
        } else if (key === 'phoneNumber') {
          fields.push('phone_number = ?');
          values.push(updateData[key]);
        } else if (key === 'role') {
          fields.push('role = ?');
          values.push(updateData[key]);
        }
      });
      
      if (fields.length === 0) {
        return await User.findById(id);
      }
      
      values.push(id);
      
      const [result] = await pool.execute(`
        UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, values);
      
      if (result.affectedRows > 0) {
        return await User.findById(id);
      }
      return null;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Xóa user (soft delete)
  static async deleteById(id) {
    try {
      const [result] = await pool.execute(
        'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Lấy thống kê users
  static async getStats() {
    try {
      const [totalRows] = await pool.execute('SELECT COUNT(*) as count FROM users');
      const [activeRows] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
      const [adminRows] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE role = "ADMIN"');
      const [staffRows] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE role = "STAFF"');
      const [userRows] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE role = "USER"');
      
      return {
        totalUsers: totalRows[0].count,
        activeUsers: activeRows[0].count,
        adminUsers: adminRows[0].count,
        staffUsers: staffRows[0].count,
        regularUsers: userRows[0].count
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Tìm kiếm users
  static async search(query, limit = 50) {
    try {
      const searchTerm = `%${query}%`;
      const [rows] = await pool.execute(`
        SELECT id, username, email, full_name, phone_number, role, is_active, 
               created_at, updated_at
        FROM users 
        WHERE (full_name LIKE ? OR email LIKE ? OR username LIKE ?) 
        AND is_active = 1
        ORDER BY created_at DESC 
        LIMIT ${parseInt(limit)}
      `, [searchTerm, searchTerm, searchTerm]);
      
      return rows.map(User.formatUser);
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Lấy users theo role
  static async findByRole(role, limit = 50) {
    try {
      const [rows] = await pool.execute(`
        SELECT id, username, email, full_name, phone_number, role, is_active, 
               created_at, updated_at
        FROM users 
        WHERE role = ? AND is_active = 1
        ORDER BY created_at DESC 
        LIMIT ${parseInt(limit)}
      `, [role]);
      
      return rows.map(User.formatUser);
    } catch (error) {
      console.error('Error finding users by role:', error);
      throw error;
    }
  }

  // Format user data (convert snake_case to camelCase)
  static formatUser(dbUser) {
    if (!dbUser) return null;
    
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      password: dbUser.password, // Include for authentication, remove in responses
      fullName: dbUser.full_name,
      phoneNumber: dbUser.phone_number,
      role: dbUser.role,
      isActive: dbUser.is_active && (dbUser.is_active[0] === 1 || dbUser.is_active === 1),
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at
    };
  }

  // Remove password from user object
  static sanitizeUser(user) {
    if (!user) return null;
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

module.exports = User;