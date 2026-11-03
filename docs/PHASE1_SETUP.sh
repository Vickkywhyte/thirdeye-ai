#!/bin/bash
set -euo pipefail

# ============================================================
# ThirdEye AI — Phase 1 Project Scaffold
# Run from the PARENT directory of where you want the project
# Usage: cd ~ && bash docs/PHASE1_SETUP.sh
# ============================================================

PROJECT_DIR="$HOME/thirdeye-ai"

echo "🔧 Phase 1: Creating ThirdEye AI project scaffold..."

# ---- Step 1: Create Next.js project ----
echo "→ Creating Next.js project with TypeScript + Tailwind..."
cd "$HOME"
npx create-next-app@latest thirdeye-ai \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm \
  --no-turbopack

cd "$PROJECT_DIR"

# ---- Step 2: Install production dependencies ----
echo "→ Installing production dependencies..."
pnpm add \
  zustand \
  @tanstack/react-table \
  framer-motion \
  recharts \
  d3 \
  cmdk \
  react-hook-form \
  @hookform/resolvers \
  zod \
  sonner \
  date-fns \
  @supabase/supabase-js \
  @supabase/ssr \
  dompurify \
  next-themes

# ---- Step 3: Install dev dependencies ----
echo "→ Installing dev dependencies..."
pnpm add -D \
  @types/d3 \
  @types/dompurify \
  vitest \
  @vitejs/plugin-react \
  jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  prettier \
  prettier-plugin-tailwindcss \
  husky \
  lint-staged \
  @commitlint/cli \
  @commitlint/config-conventional

# ---- Step 4: Create directory structure ----
echo "→ Creating directory structure..."
mkdir -p \
  docs/adr \
  src/app/\(auth\)/login \
  src/app/\(auth\)/register \
  src/app/\(auth\)/reset-password \
  src/app/\(dashboard\)/dashboard \
  src/app/\(dashboard\)/investigations \
  src/app/\(dashboard\)/investigations/new \
  "src/app/(dashboard)/investigations/[id]" \
  src/app/\(dashboard\)/reports \
  "src/app/(dashboard)/reports/[id]/edit" \
  src/app/\(dashboard\)/settings \
  src/app/api/auth \
  src/app/api/investigations \
  src/app/api/screening \
  src/app/api/reports \
  src/app/api/entities \
  src/components/ui \
  src/components/layout \
  src/components/investigation \
  src/components/dashboard \
  src/components/reports \
  src/components/shared \
  src/lib/supabase \
  src/lib/screening \
  src/lib/ai \
  src/lib/auth \
  src/lib/validation \
  src/lib/api \
  src/lib/utils \
  src/hooks \
  src/stores \
  src/types \
  src/styles \
  supabase/migrations \
  tests/unit \
  tests/integration \
  tests/e2e \
  public/fonts \
  public/icons \
  .github/workflows

# ---- Step 5: Initialize shadcn/ui ----
echo "→ Initializing shadcn/ui..."
# We'll create the components.json manually for non-interactive setup
cat > components.json << 'SHADCN_EOF'
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
SHADCN_EOF

# ---- Step 6: Add shadcn/ui components ----
echo "→ Adding shadcn/ui components..."
pnpm dlx shadcn@latest add -y \
  button input label card badge dialog dropdown-menu \
  tooltip tabs accordion separator scroll-area sheet \
  popover command avatar skeleton switch select textarea \
  table sonner

# ---- Step 7: Setup Husky + commitlint ----
echo "→ Setting up Husky + commitlint..."
pnpm dlx husky init
echo 'pnpm lint-staged' > .husky/pre-commit
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg

# ---- Step 8: Create config files ----
echo "→ Creating configuration files..."

# .env.example
cat > .env.example << 'ENV_EOF'
# ===========================================
# ThirdEye AI — Environment Variables
# Copy to .env.local and fill in values
# ===========================================

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI / LLM
OLLAMA_BASE_URL=http://localhost:11434
OPENROUTER_API_KEY=

# External Data Sources
COMPANIES_HOUSE_API_KEY=
NEWSAPI_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional (later phases)
# GRAFANA_CLOUD_API_KEY=
# RESEND_API_KEY=
# UPSTASH_REDIS_URL=
# UPSTASH_REDIS_TOKEN=
ENV_EOF

# Copy to .env.local
cp .env.example .env.local

# commitlint config
cat > commitlint.config.ts << 'COMMITLINT_EOF'
import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'security',
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-max-length': [2, 'always', 100],
  },
};

export default config;
COMMITLINT_EOF

# .prettierrc
cat > .prettierrc << 'PRETTIER_EOF'
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
PRETTIER_EOF

# vitest config
cat > vitest.config.ts << 'VITEST_EOF'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts', 'src/hooks/**/*.ts', 'src/stores/**/*.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
VITEST_EOF

# Test setup file
cat > tests/setup.ts << 'TESTSETUP_EOF'
import '@testing-library/jest-dom/vitest';
TESTSETUP_EOF

# lint-staged config (add to package.json later or as file)
cat > .lintstagedrc.json << 'LINTSTAGED_EOF'
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
LINTSTAGED_EOF

echo ""
echo "✅ Phase 1 scaffold complete!"
echo ""
echo "Next steps:"
echo "  1. cd ~/thirdeye-ai"
echo "  2. Copy BUILD_GUIDE.md into docs/"
echo "  3. Open in VS Code: code ."
echo "  4. Run: pnpm dev"
echo "  5. Verify http://localhost:3000 loads"
echo "  6. Then proceed to Phase 1 code generation in Claude Code"
echo ""
echo "Claude Code will generate the remaining Phase 1 files:"
echo "  - tailwind.config.ts (full ThirdEye design tokens)"
echo "  - src/styles/globals.css (CSS variables + dark mode)"
echo "  - middleware.ts (CSP + auth redirect)"
echo "  - next.config.ts (security headers)"
echo "  - src/lib/utils/cn.ts (class merge utility)"
echo "  - Updated package.json scripts"
PHASE1_EOF
