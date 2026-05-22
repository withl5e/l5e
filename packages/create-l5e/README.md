# create-l5e

Create a L5E app from the official starter template.

```sh
npm create l5e my-app -- --template basic
```

Equivalent commands:

```sh
npx create-l5e my-app --template basic
pnpm create l5e my-app --template basic
bun create l5e my-app --template basic
```

Available templates:

- `basic`: example app with middleware rewrite, loader cache headers, action and swap interaction
- `minimal`: small app with one server-rendered page

Run the dev server immediately after install:

```sh
pnpm create l5e my-app --template basic --dev
```

## Pinning a version

By default the generator pulls the `latest` dist-tag. To track the alpha
channel or pin to a specific release:

```sh
npm create l5e@alpha my-app           # follow the alpha channel
npm create l5e@0.1.2 my-app           # pin to an exact version
```

## Publishing

The package name must be `create-l5e`. npm maps `npm create l5e` to the
`create-l5e` package name. Releases for this package go out together with
`@withl5e/l5e` and `@withl5e/richtext-payload` via the tag-driven release
workflow — see [`RELEASE.md`](../../RELEASE.md) in the repo root.
