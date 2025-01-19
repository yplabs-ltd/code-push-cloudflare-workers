type SnakeCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? First extends Lowercase<First>
    ? `${First}${SnakeCase<Rest>}`
    : `_${Lowercase<First>}${SnakeCase<Rest>}`
  : S;

type SnakeCasedPropertiesDeep<T> = T extends (infer U)[]
  ? SnakeCasedPropertiesDeep<U>[]
  : T extends object
    ? {
        [K in keyof T as K extends string
          ? SnakeCase<K>
          : K]: SnakeCasedPropertiesDeep<T[K]>;
      }
    : T;

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

export function convertObjectToSnakeCase<T>(
  obj: T,
): SnakeCasedPropertiesDeep<T> {
  if (obj === null || typeof obj !== "object") {
    return obj as SnakeCasedPropertiesDeep<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      convertObjectToSnakeCase(item),
    ) as SnakeCasedPropertiesDeep<T>;
  }

  const result = {} as SnakeCasedPropertiesDeep<T>;
  for (const [key, value] of Object.entries(obj)) {
    (result as Record<string, unknown>)[toSnakeCase(key)] =
      convertObjectToSnakeCase(value);
  }
  return result;
}
