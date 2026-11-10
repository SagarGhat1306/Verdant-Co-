// Vercel entry point. vercel.json sends every request here, to the same
// Express app `npm run dev` runs locally.
import { createApp } from '../src/app.js';

export default createApp();
