# RemitRoot Backend API

Express.js backend API built with TypeScript for the RemitRoot application.

## Features

- Express.js server with TypeScript
- CORS support
- Error handling middleware
- Request logging
- Jest testing framework
- ESLint & Prettier for code quality
- Example CRUD routes for users

## Prerequisites

- Node.js 16+
- npm or yarn

## Installation

```bash
npm install
```

## Environment Setup

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Update `.env` with your configuration

## Development

Start the development server:

```bash
npm run dev
```

The server will run on `http://localhost:3000`

## Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

## Production

```bash
npm run build
npm start
```

## Testing

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

## Code Quality

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## API Endpoints

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Health Check

- `GET /health` - Check API health status

## Project Structure

```
src/
├── index.ts              # Main application file
├── routes/               # Route handlers
│   └── users.ts         # User routes example
├── middleware/           # Custom middleware
│   ├── errorHandler.ts  # Error handling
│   └── logger.ts        # Request logging
└── __tests__/           # Test files
```

## License

MIT

## Note

Documentation touch-up: added a small maintenance note.
