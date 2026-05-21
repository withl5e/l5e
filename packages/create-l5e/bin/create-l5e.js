#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const helpText = `
Usage:
  create-l5e <project-directory> [options]

Options:
  -t, --template <name>         Use a first-party template
  --dev                         Start the dev server after installing
  --no-install                  Copy the starter without installing dependencies
  -p, --package-manager <name>  Use npm, pnpm, yarn, or bun
  -h, --help                    Show this help

Templates:
  basic                         Example app with middleware, loaders, actions, and swap
  minimal                       Small app with one server-rendered page

Examples:
  pnpm create l5e@alpha my-app --template basic
  pnpm create l5e@alpha my-app --template minimal
`;

const builtInTemplates = new Map([
  ['basic', '../templates/basic'],
  ['minimal', '../templates/minimal'],
]);
const packageManagers = new Set(['npm', 'pnpm', 'yarn', 'bun']);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(helpText.trim());
    return;
  }

  if (!options.targetDir) {
    console.error(helpText.trim());
    process.exit(1);
  }

  if (options.dev && !options.install) {
    throw new Error('The --dev option requires dependency installation. Remove --no-install.');
  }

  const targetDir = path.resolve(process.cwd(), options.targetDir);
  const projectName = toPackageName(path.basename(targetDir));
  const template = resolveTemplate(options.template);
  const packageManager = options.packageManager ?? detectPackageManager();

  await ensureEmptyDirectory(targetDir);
  await writeTemplate(template, targetDir, { projectName });
  await updatePackageName(targetDir, projectName);

  console.log(`Created ${projectName} from ${template.name} in ${targetDir}`);

  if (options.install) {
    runCommand(packageManager, ['install'], targetDir);
  }

  if (options.dev) {
    runCommand(packageManager, devArgs(packageManager), targetDir);
    return;
  }

  printNextSteps(targetDir, packageManager, options.install);
}

function parseArgs(args) {
  const options = {
    dev: false,
    help: false,
    install: true,
    packageManager: undefined,
    template: 'basic',
    targetDir: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--dev') {
      options.dev = true;
      continue;
    }

    if (arg === '--no-install') {
      options.install = false;
      continue;
    }

    if (arg === '--template' || arg === '-t') {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires a first-party template name.`);
      options.template = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--template=')) {
      options.template = arg.slice('--template='.length);
      continue;
    }

    if (arg === '--package-manager' || arg === '-p') {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires npm, pnpm, yarn, or bun.`);
      options.packageManager = normalizePackageManager(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--package-manager=')) {
      options.packageManager = normalizePackageManager(arg.slice('--package-manager='.length));
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (options.targetDir) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    options.targetDir = arg;
  }

  return options;
}

function normalizePackageManager(value) {
  const normalized = value.trim().toLowerCase();
  if (!packageManagers.has(normalized)) {
    throw new Error(`Unsupported package manager: ${value}. Use npm, pnpm, yarn, or bun.`);
  }
  return normalized;
}

function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent ?? '';

  if (userAgent.startsWith('pnpm')) return 'pnpm';
  if (userAgent.startsWith('yarn')) return 'yarn';
  if (userAgent.startsWith('bun')) return 'bun';
  return 'npm';
}

function toPackageName(name) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'l5e-app';
}

function resolveTemplate(value) {
  const templateName = value.trim();
  const builtInPath = builtInTemplates.get(templateName.toLowerCase());

  if (builtInPath) {
    return {
      type: 'local',
      name: templateName,
      dir: path.resolve(__dirname, builtInPath),
    };
  }

  const builtIns = [...builtInTemplates.keys()].join(', ');
  throw new Error(`Unknown template: ${value}. Use one of: ${builtIns}.`);
}

async function ensureEmptyDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });

  const entries = await fs.readdir(dir);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${dir}`);
  }
}

async function writeTemplate(template, targetDir, replacements) {
  await copyTemplate(template.dir, targetDir, replacements);
}

async function copyTemplate(sourceDir, targetDir, replacements) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const targetPath = path.join(targetDir, targetName);

    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      await copyTemplate(sourcePath, targetPath, replacements);
      continue;
    }

    let content = await fs.readFile(sourcePath, 'utf8');
    content = content.replaceAll('__PROJECT_NAME__', replacements.projectName);
    await fs.writeFile(targetPath, content);
  }
}

async function updatePackageName(targetDir, projectName) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  let content;

  try {
    content = await fs.readFile(packageJsonPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }

  const packageJson = JSON.parse(content);
  packageJson.name = projectName;
  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function runCommand(command, args, cwd) {
  console.log(`Running ${[command, ...args].join(' ')}...`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    process.exit(exitCode);
  }
}

function devArgs(packageManager) {
  if (packageManager === 'npm') return ['run', 'dev'];
  if (packageManager === 'bun') return ['run', 'dev'];
  return ['dev'];
}

function printNextSteps(targetDir, packageManager, installed) {
  const relativeTarget = path.relative(process.cwd(), targetDir) || '.';
  const devCommand = [packageManager, ...devArgs(packageManager)].join(' ');

  console.log('');
  console.log('Next steps:');
  console.log(`  cd ${relativeTarget}`);
  if (!installed) {
    console.log(`  ${packageManager} install`);
  }
  console.log(`  ${devCommand}`);
}
