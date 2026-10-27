import fs from 'node:fs';

// this call changes types based on which optional parameters you pass. The way it
// is being called here it will always return string[]. I don't know why they didn't
// fix this in the types upstream 🤔
const localStuff = fs.readdirSync('./addon/', { recursive: true }) as string[];

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

const availableComponents: string[] = [];
const availableHelpers: string[] = [];
const availableModifiers: string[] = [];

const extensionRegex = /\.(hbs|ts|js|gts|gjs)$/;

for (const item of localStuff) {
  if (!extensionRegex.test(item)) {
    // probably a directory
    continue;
  }
  if (item.startsWith('components/')) {
    availableComponents.push(item.replace(/^components\//, '').replace(extensionRegex, ''));
  }
  if (item.startsWith('helpers/')) {
    availableHelpers.push(item.replace(/^helpers\//, '').replace(extensionRegex, ''));
  }

  if (item.startsWith('modifiers/')) {
    availableHelpers.push(item.replace(/^modifiers\//, '').replace(extensionRegex, ''));
  }
}

function resolveVirtualInvokable(path: string) {
  let basePath = path.replace('@embroider/virtual/', '');
  const barePath = basePath.replace(/^(components|helpers|ambiguous|modifiers)\//, '');

  if (basePath.startsWith('components/') && availableComponents.includes(barePath)) {
    return `${pkg.name}/${basePath}`;
  }

  if (basePath.startsWith('helpers/') && availableHelpers.includes(barePath)) {
    return `${pkg.name}/${basePath}`;
  }

  if (basePath.startsWith('modifiers/') && availableModifiers.includes(barePath)) {
    return `${pkg.name}/${basePath}`;
  }

  if (availableComponents.includes(barePath)) {
    return `${pkg.name}/components/${barePath}`;
  }

  if (availableHelpers.includes(barePath)) {
    return `${pkg.name}/helpers/${barePath}`;
  }

  if (availableModifiers.includes(barePath)) {
    return `${pkg.name}/modifiers/${barePath}`;
  }
}

// I set resolve as any here because we're just passing it through and it doesn't matter to this use case
export default async function (path: string, filename: string, resolve: any) {
  let localResolution = resolveVirtualInvokable(path);

  if (localResolution) {
    return localResolution;
  }

  await resolve(path, filename);
}
