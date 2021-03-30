// I'm doing this as a json import because even though that's not standard JS,
// it's relaively easy to consume into builds for the web. As opposed to doing
// something like fs.readFile, which is harder.
//
// @ts-ignore
import mappings from 'ember-rfc176-data/mappings.json';

// these are packages that available to import in standard ember code that don't
// exist as real packages. If a build system encounters them in stage 3, it
// should convert them to runtime AMD require.
//
// Some of them (like @embroider/macros) won't ever be seen in stage 3, because
// earlier plugins should take care of them.
//
// In embroider builds using ember-source >= 3.28, you won't see *any* of these
// in stage3 because ember-source uses the standard rename-modules feature to
// map them into real modules within ember-source.
export const emberVirtualPackages = new Set<string>(mappings.map((m: any) => m.module));

// these are *real* packages that every ember addon is allow to resolve *as if
// they were peerDepenedencies, because the host application promises to have
// these packages. In principle, we could force every addon to declare these as
// real peerDeps all the way down the dependency graph, but in practice that
// makes the migration from v1 to v2 addons more painful than necessary, because
// a v1 addon in between the app and a v2 addon might not declare the peerDep,
// breaking the deeper v2 addon.
export const emberVirtualPeerDeps = new Set<string>(['@glimmer/component']);

// this is a real package, even though it's still listed in rfc176
emberVirtualPackages.delete('@ember/string');
emberVirtualPeerDeps.add('@ember/string');

// these can also appear in ember code and should get compiled away by babel,
// but we may need to tell a build tool that is inspecting pre-transpiled code
// (like snowpack) not to worrya bout these packages.
emberVirtualPackages.add('@glimmer/env');
emberVirtualPackages.add('ember');
emberVirtualPackages.add('@embroider/macros');
