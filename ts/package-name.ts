export default function absolutePackageName(specifier) {
  if (specifier[0] === '.' || specifier[0] === '/') {
    // Not an absolute specifier
    return;
  }
  let parts = specifier.split('/');
  if (specifier[0] === '@') {
    return `${parts[0]}/${parts[1]}`;
  } else {
    return parts[0];
  }
}
