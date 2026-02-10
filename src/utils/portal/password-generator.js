const crypto = require("crypto");

/**
 * Generates a cryptographically secure random password
 *
 * @param {number} length - Password length (default: 16)
 * @returns {string} - Strong random password containing uppercase, lowercase, numbers, and symbols
 *
 * @example
 * const password = generateStrongPassword(); // "aB3$xY9!zM2#pQ5&"
 * const longerPassword = generateStrongPassword(24);
 */
function generateStrongPassword(length = 16) {
  if (length < 12) {
    throw new Error("Password length must be at least 12 characters");
  }

  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  // Ensure at least one of each character type for strong password
  const password = [
    uppercase[crypto.randomInt(uppercase.length)],
    lowercase[crypto.randomInt(lowercase.length)],
    numbers[crypto.randomInt(numbers.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  // Fill remaining characters with random selection from all types
  const allChars = uppercase + lowercase + numbers + symbols;
  for (let i = 4; i < length; i++) {
    password.push(allChars[crypto.randomInt(allChars.length)]);
  }

  // Shuffle array using Fisher-Yates algorithm with crypto randomness
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

module.exports = { generateStrongPassword };
