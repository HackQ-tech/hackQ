# HackQ

HackQ is a community platform for hackers, developers, and curious minds. Share security research, CVEs, CTF events, projects, and tutorials, then connect with other builders.

## Features

- Community feed with post types, tags, search, and trending content
- Markdown posts with syntax-highlighted code and up to four images
- Comments, reactions, bookmarks, and GIF search
- User profiles, follows, notifications, and a points-based leaderboard
- Email/password accounts with verification and password recovery
- Optional Google and GitHub sign-in
- Admin tools and authenticated bug reports
- Responsive pages with metadata for search engines and link previews

## Requirements

- Node.js 18 or later
- MongoDB, local or hosted
- npm

Cloudinary is needed for image uploads. OAuth providers, Resend email, and Giphy are optional integrations; the app can run without them.

## Getting Started

1. Install dependencies:

	```bash
	npm install
	```

2. Create your local environment file:

	```bash
	cp .env.example .env
	```

3. Set `MONGO_URI` and `JWT_SECRET` in `.env`. For a local MongoDB instance, the example URI uses `mongodb://127.0.0.1:27017/hackq`. Change the example admin credentials before running the app.

4. Start the development server:

	```bash
	npm run dev
	```

5. Visit [http://localhost:3000](http://localhost:3000).

For a normal start without file watching, use `npm start`.

## Configuration

All supported settings are listed in [`.env.example`](.env.example). The most commonly used are:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port; defaults to `3000` |
| `BASE_URL` | Public site URL, used for OAuth callbacks, links, and sitemap metadata |
| `MONGO_URI` | MongoDB connection string; defaults to local `hackq` database |
| `JWT_SECRET` | Secret used to sign authentication tokens; set a long, unique value |
| `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Optional admin account, created or promoted automatically at startup |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary image storage; all three are required for uploads |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend email delivery; without an API key, development emails are printed in the server console and are not sent |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth credentials |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional GitHub OAuth credentials |
| `GIPHY_API_KEY` | Optional GIF search in comments |
| `BUG_REPORT_EMAIL` | Optional comma-separated bug report recipients; falls back to `ADMIN_EMAIL` |

For Google and GitHub OAuth, set the provider callback URL to `{BASE_URL}/api/auth/google/callback` or `{BASE_URL}/api/auth/github/callback`, respectively. OAuth is only enabled when both credentials for a provider are configured.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the production-style server |
| `npm run dev` | Start the server with Node.js watch mode |
| `npm run reset-admin` | Sync the admin account with `ADMIN_EMAIL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` from `.env` |
| `npm run test-mail` | Send a test email using the configured mail provider |

## Project Structure

```text
config/       Database, OAuth, and Cloudinary configuration
controllers/  Request handlers and application logic
middleware/   Authentication, uploads, rate limits, and error handling
models/       Mongoose data models
public/       Browser JavaScript, stylesheets, images, and vendor assets
routes/       Express API routes
scripts/      Administrative and mail utility scripts
utils/        Shared helpers, mail, feeds, notifications, and SEO
views/        HTML pages served by Express
server.js     Application setup and HTTP server
```

## API Overview

The JSON API is rooted at `/api`:

- `/api/auth` for registration, login, account recovery, and OAuth
- `/api/posts` for feed content, posts, comments, reactions, and bookmarks
- `/api/users` for profiles, follows, notifications, and the leaderboard
- `/api/bugs` for authenticated bug reports
- `/api/admin` for administration

## Deployment Notes

Set `NODE_ENV=production`, use a strong `JWT_SECRET`, configure a production `BASE_URL` and MongoDB connection, and provide credentials for any integrations you rely on. Keep `.env` and all provider secrets out of version control. The server listens on `PORT` (or `3000` by default).
