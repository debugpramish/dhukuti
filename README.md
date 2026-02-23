# Dhukuti 🏪

> Inventory + E-Commerce SaaS built for Nepali SMBs
> Built by DebugDream — Kathmandu, Nepal

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18, Vite, TypeScript, Tailwind |
| Backend  | Node.js, Express, TypeScript         |
| Database | MongoDB Atlas (Mongoose)             |
| Hosting  | Vercel (FE) + Render (BE)            |
| Payments | eSewa, Khalti, Stripe                |

## Project Structure

```
dhukuti/
├── client/   # React frontend (deployed to Vercel)
├── server/   # Express backend (deployed to Render)
└── shared/   # Zod schemas shared between FE + BE
```

## Getting Started

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/dhukuti.git
cd dhukuti

# Setup backend
cd server && cp .env.example .env  # fill in your values
npm install && npm run dev

# Setup frontend (new terminal)
cd client && cp .env.example .env
npm install && npm run dev
```

## Environment Variables

See `server/.env.example` and `client/.env.example` for required variables.

## Team

Built with ❤️ by DebugDream — Kathmandu, Nepal
