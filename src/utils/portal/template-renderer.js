const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

const renderTemplate = (template, variables = {}) => {
  if (!template) return "";
  return template.replace(PLACEHOLDER_PATTERN, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
};

export { renderTemplate, PLACEHOLDER_PATTERN };
