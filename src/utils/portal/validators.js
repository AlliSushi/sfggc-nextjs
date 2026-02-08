const looksLikeEmail = (value) => {
  return /.+@.+\..+/.test(value);
};

const looksLikePhone = (value) => {
  return /[0-9]{3}[^0-9]*[0-9]{3}[^0-9]*[0-9]{4}/.test(value);
};

export { looksLikeEmail, looksLikePhone };
