# create-l5e

Create a L5E app from the official starter template.

```sh
npm create l5e@alpha my-app -- --template basic
```

Equivalent commands:

```sh
npx create-l5e@alpha my-app --template basic
pnpm create l5e@alpha my-app --template basic
bun create l5e@alpha my-app --template basic
```

Available templates:

- `basic`: example app with middleware rewrite, loader cache headers, action and swap interaction
- `minimal`: small app with one server-rendered page

Run the dev server immediately after install:

```sh
pnpm create l5e@alpha my-app --template basic --dev
```

## Publishing

The package name must be `create-l5e`. npm maps `npm create l5e` to the
`create-l5e` package name.

Publish the alpha:

```sh
pnpm --filter create-l5e publish --tag alpha
```

After the package is stable, publish or move the dist tag to `latest` so users can run:

```sh
npm create l5e@latest my-app
npx create-l5e@latest my-app
```
