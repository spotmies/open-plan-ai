# Open Plan AI

A modern project management application built with React, TypeScript, and a feature-based architecture.

## 🚀 Quick Start


```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Type check
npm run type-check

# Lint code
npm run lint
```


## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on all TypeScript files |
| `npm run type-check` | Run TypeScript compiler checks |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |

## 🏗️ Project Structure

```
src/
├── components/          # Shared UI components
│   ├── ui/             # shadcn/ui components
│   └── layout/         # Layout components (Header, Sidebar)
├── features/           # Feature-based modules
│   ├── dashboard/      # Dashboard feature
│   ├── projects/       # Projects management
│   ├── calendar/       # Calendar views
│   ├── myday/          # My Day task view
│   ├── reports/        # Reports and analytics
│   ├── settings/       # User settings
│   └── team/           # Team management
├── hooks/              # Custom React hooks
├── services/           # API services and monitoring
│   ├── api/           # HTTP client and endpoints
│   └── monitoring/    # Logging service
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
├── lib/                # Utility functions
└── test/               # Test utilities and setup
```

## 🛠️ Tech Stack

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS with shadcn/ui components
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Routing:** React Router v6
- **Forms:** React Hook Form with Zod validation
- **Testing:** Vitest with React Testing Library
- **Charts:** Recharts
- **Date Handling:** date-fns

## 🧪 Testing

The project uses Vitest with React Testing Library for testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

Tests are organized alongside their components:
- `ComponentName.test.tsx` for component tests
- `__tests__/` directories for grouped tests

## 📝 Code Quality

This project uses:
- **ESLint** for code linting
- **TypeScript** in strict mode for type safety
- **Husky** for pre-commit hooks
- **lint-staged** for running linters on staged files

Pre-commit hooks automatically run:
1. ESLint with auto-fix on staged files
2. TypeScript type checking
3. Test suite

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT License - see LICENSE file for details.


