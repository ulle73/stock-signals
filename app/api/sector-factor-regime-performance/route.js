import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      disabled: true,
      message: 'Matrix-sektionen är avstängd. Se docs/matrix-reenable-guide.md för återaktivering.',
    },
    { status: 410 }
  );
}
