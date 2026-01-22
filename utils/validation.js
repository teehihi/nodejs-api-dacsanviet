// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
const validatePassword = (password) => {
  // Ít nhất 6 ký tự
  return password && password.length >= 6;
};

// Validate phone number (Vietnam format)
const validatePhone = (phone) => {
  const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
  return phoneRegex.test(phone);
};

// Validate username
const validateUsername = (username) => {
  // 3-20 ký tự, chỉ chứa chữ cái, số và dấu gạch dưới
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

// Sanitize input (remove dangerous characters)
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateUsername,
  sanitizeInput
};