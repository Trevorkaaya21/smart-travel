// eslint.config.js
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'

const nextCoreWebVitals = nextPlugin.configs['core-web-vitals']
const reactHooksRecommended = reactHooks.configs?.recommended ?? { rules: {} }

export default tseslint.config(
  {
    ignores: ['**/.next/**', 'dist', 'node_modules', '**/*.config.js']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['smart-travel-frontend/apps/web/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks
    },
    settings: nextCoreWebVitals?.settings ?? {},
    rules: {
      ...nextCoreWebVitals?.rules,
      ...reactHooksRecommended.rules,
      'react-hooks/set-state-in-effect': 'off'
    }
  }
)
