const isExampleSecret = (value) => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes('replace-with') ||
    normalized.includes('replace_with') ||
    normalized.includes('change-me') ||
    normalized.includes('change_me') ||
    normalized.includes('example') ||
    normalized.includes('default') ||
    normalized.includes('<') ||
    normalized.includes('>')
  );
};

const isProductionJwtSecret = (value) =>
  typeof value === 'string' &&
  value.length >= 32 &&
  !/^(.)(?:\1)+$/.test(value) &&
  !isExampleSecret(value);

module.exports = { isProductionJwtSecret };
