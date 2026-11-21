// Vercel function for /api/ai. The logic lives in _core.js.
import { handle } from './_core.js';

export async function POST(request) { return handle(request, 'ai'); }
export async function OPTIONS(request) { return handle(request, 'ai'); }
export async function GET(request) { return handle(request, 'ai'); }
