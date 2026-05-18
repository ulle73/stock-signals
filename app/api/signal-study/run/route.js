import { NextResponse } from 'next/server';
import { executeSignalStudy } from '../../../../lib/utils/signal-study-runner.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const config = await request.json();
    const payload = await executeSignalStudy({
      config,
      configPath: 'ui://signal-study-lab',
      saveResult: true,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message ?? 'Okänt fel när studien skulle köras.',
      },
      { status: 400 }
    );
  }
}
