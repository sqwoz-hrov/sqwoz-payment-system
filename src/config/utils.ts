export const getOrThrow = <T extends string>(key: T): string => {
  const val = process.env[key];

  if (val === undefined || val === null) {
    throw new Error(`Value of ${key} is undefined or null`);
  }

  if (val === '') {
    throw new Error(`Value of ${key} is empty`);
  }

  return val;
};

export const getOrDefault = <T extends string>(
  key: T,
  defaultValue: string,
): string => {
  return process.env[key] || defaultValue;
};
