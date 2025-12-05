export function resolvableExtensions(): string[] {
  let fromEnv = process.env.EMBROIDER_RESOLVABLE_EXTENSIONS;
  if (fromEnv) {
    return fromEnv.split(',');
  } else {
    return ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'];
  }
}
