import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.warn('RESEND_API_KEY is not set. Email not sent.');
      return NextResponse.json(
        { error: 'RESEND_API_KEY is missing from environment variables.' },
        { status: 500 }
      );
    }

    // Initialize Resend dynamically inside the request handler
    const resend = new Resend(apiKey);
    const { email, venueName } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Missing applicant email' }, { status: 400 });
    }

    const fromAddress = process.env.NODE_ENV === 'production'
      ? 'Motion Team <partners@motion.sports.com>'
      : 'Motion Team <onboarding@resend.dev>';

    const data = await resend.emails.send({
      from: fromAddress, // Update with your verified domain in production
      to: [email],
      subject: `🎉 Application Approved: ${venueName} is live on Motion!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 16px;">
          <h2 style="color: #101310; font-size: 24px; margin-bottom: 8px;">Welcome to the Motion Partner Ecosystem!</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Great news! Your venue application for <strong>${venueName}</strong> has been officially reviewed and approved by the Motion HQ team.
          </p>
          <div style="background-color: #f7f8f4; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #333;">
              <strong>What's next?</strong><br/>
              Your account has been elevated to <code>venue_owner</code> status. Log back into Motion to access your <strong>Control Centre</strong>, where you can set up court schedules, operating hours, and live availability matrices.
            </p>
          </div>
          <a href="https://motion-starter-two.vercel.app" style="display: inline-block; background-color: #d8ff3e; color: #101310; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 99px; font-size: 13px;">
            Go to Control Centre
          </a>
          <p style="margin-top: 32px; font-size: 12px; color: #999;">
            If you have any questions, reply directly to this email to get in touch with our partner ops team.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Failed to send approval email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}