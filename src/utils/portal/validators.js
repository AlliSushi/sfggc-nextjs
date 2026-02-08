const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_WEAK_TOKENS = ["password", "123456", "qwerty", "letmein", "admin", "welcome"];

const PASSWORD_ERRORS = {
  MIN_LENGTH: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  LOWERCASE: "Password must include at least one lowercase letter.",
  UPPERCASE: "Password must include at least one uppercase letter.",
  NUMBER: "Password must include at least one number.",
  WEAK: "Password is too common. Please choose a stronger password.",
};

const validatePassword = (value) => {
  if (!value || value.length < PASSWORD_MIN_LENGTH)
    return PASSWORD_ERRORS.MIN_LENGTH;
  if (!/[a-z]/.test(value))
    return PASSWORD_ERRORS.LOWERCASE;
  if (!/[A-Z]/.test(value))
    return PASSWORD_ERRORS.UPPERCASE;
  if (!/[0-9]/.test(value))
    return PASSWORD_ERRORS.NUMBER;
  const lower = value.toLowerCase();
  if (PASSWORD_WEAK_TOKENS.some((token) => lower.includes(token)))
    return PASSWORD_ERRORS.WEAK;
  return null;
};

export {
  PASSWORD_MIN_LENGTH,
  PASSWORD_WEAK_TOKENS,
  PASSWORD_ERRORS,
  validatePassword,
};
