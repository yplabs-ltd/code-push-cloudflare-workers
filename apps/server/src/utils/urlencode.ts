export function urlEncode(
  strings: TemplateStringsArray,
  ...values: string[]
): string {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += encodeURIComponent(values[i]);
    }
  }
  return result;
}
