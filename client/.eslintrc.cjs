module.exports = {
    root: true,
    env: {
        browser: true,
        es2020: true,
        node: true
    },
    ignorePatterns: [
        'dist',
        'node_modules'
    ],
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'react',
        'react-hooks',
        'react-refresh'
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended'
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true
        }
    },
    settings: {
        react: {
            version: 'detect'
        }
    },
    rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react/no-unknown-property': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'react-refresh/only-export-components': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }
        ]
    }
}
