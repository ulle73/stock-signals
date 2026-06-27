import { NextResponse } from 'next/server';
import { handleSignalStudyRunRequest } from '../../../../lib/utils/signal-study-run-endpoint.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const response = await handleSignalStudyRunRequest(request);
  return NextResponse.json(response.body, { status: response.status });
}
