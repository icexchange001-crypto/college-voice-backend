# College Management System

A comprehensive college management system with AI-powered features including text-to-speech, chatbot assistance, and administrative tools.

## Features

- 🎓 Department Management
- 🤖 AI-Powered Court Assistant (OpenAI/Groq)
- 🔊 Text-to-Speech (ElevenLabs & Cartesia)
- 👥 Admin Dashboard
- 🔐 Secure Authentication
- 📊 Real-time Data with Supabase

## Prerequisites

Before you begin, make sure you have:

- Node.js (v18 or higher)
- npm or yarn
- A Supabase account
- API keys for the services you want to use (see below)

## Environment Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd <project-folder>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and fill in your actual API keys and credentials:

#### Required Services:

**Supabase** (Database & Authentication)
- Sign up at: https://supabase.com
- Create a new project
- Go to Settings → API
- Copy:
  - `SUPABASE_URL` → Your project URL
  - `SUPABASE_ANON_KEY` → Your anon/public key
  - `SUPABASE_SERVICE_ROLE_KEY` → Your service role key (keep this secret!)

**Admin Credentials**
```env
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_random_secret_key
```

Generate a JWT secret using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Optional Services (for AI features):

**OpenAI** (AI Chat)
- Get key from: https://platform.openai.com/api-keys
- Set: `OPENAI_API_KEY=sk-...`

**Groq** (AI Chat - Alternative/Fallback)
- Get key from: https://console.groq.com/keys
- Set: `GROQ_API_KEY=gsk-...`
- Set: `GROQ_API_KEY_ADMIN=gsk-...` (can be same as above)

**ElevenLabs** (Text-to-Speech)
- Get key from: https://elevenlabs.io/app/settings/api-keys
- Set: `ELEVENLABS_API_KEY=...`

**Cartesia** (Text-to-Speech - Alternative)
- Get key from: https://cartesia.ai/
- Set: `CARTESIA_API_KEY=...`

> **Note**: AI and TTS features are optional. The system will work without them, but those specific features won't be available.

## Running the Application

### Development Mode

```bash
npm run dev
```

This will start the development server on http://localhost:5000

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Deployment

### Deploy to Render

1. Push your code to GitHub
2. Go to [Render](https://render.com/)
3. Create a new "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Add all your `.env` variables in the Environment section
6. Deploy!

### Deploy to Railway

1. Install Railway CLI or use their dashboard
2. Push your code to GitHub
3. Create a new project on [Railway](https://railway.app/)
4. Connect your repository
5. Add environment variables from your `.env` file
6. Railway will auto-detect and deploy your app

### Deploy to Heroku

```bash
# Install Heroku CLI and login
heroku login

# Create a new app
heroku create your-app-name

# Set environment variables
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_ANON_KEY=your_key
# ... (set all other env vars)

# Deploy
git push heroku main
```

### Deploy to Vercel (Frontend) + Backend on Render

Since this is a full-stack app, you can:
1. Deploy the backend to Render/Railway
2. Deploy the frontend to Vercel
3. Update CORS settings in `server/index.ts` to allow your Vercel domain

### Deploy to DigitalOcean/AWS/Any VPS

1. SSH into your server
2. Install Node.js
3. Clone your repository
4. Create `.env` file with your credentials
5. Install dependencies: `npm install`
6. Build: `npm run build`
7. Use PM2 to run: `pm2 start npm --name "college-app" -- start`
8. Set up Nginx as reverse proxy (optional)

## Important Security Notes

⚠️ **NEVER commit your `.env` file to version control!**

The `.env` file is already in `.gitignore`. Make sure it stays there.

When deploying:
- Use environment variable settings in your hosting platform
- Don't hardcode secrets in your code
- Rotate API keys regularly
- Use different keys for development and production

## CORS Configuration

If you're hosting frontend and backend separately, update the `allowedOrigins` in `server/index.ts`:

```typescript
const allowedOrigins = [
  'https://your-frontend-domain.com',
  'http://localhost:5000', // for local development
  // ... add your domains
];
```

## Database Setup

The app uses Supabase as the database. Make sure to:

1. Run migrations (if any): `npm run db:push`
2. Set up your database schema in Supabase
3. Configure Row Level Security (RLS) policies as needed

## Troubleshooting

### Port Already in Use
```bash
# Find and kill the process using port 5000
npx kill-port 5000
```

### Missing Environment Variables
Check the console output. The app will warn you about missing environment variables.

### CORS Errors
Make sure your frontend domain is added to `allowedOrigins` in `server/index.ts`

### API Key Not Working
- Verify the key is correctly copied (no extra spaces)
- Check if the key is active in the service dashboard
- Ensure you're using the correct key type (test vs production)

## Project Structure

```
├── client/              # Frontend React application
│   ├── src/
│   └── public/
├── server/              # Backend Express server
│   ├── index.ts        # Main server file
│   ├── routes.ts       # API routes
│   ├── routes-court.ts # Court/AI routes
│   └── supabase.ts     # Supabase configuration
├── shared/              # Shared types and utilities
├── .env.example         # Environment variables template
├── .env                 # Your actual env vars (DO NOT COMMIT)
├── package.json
└── vite.config.ts
```

## Support

For issues or questions:
- Check the troubleshooting section above
- Review environment variable configuration
- Check API service status pages

## License

MIT License

---

**Happy Coding! 🚀**
