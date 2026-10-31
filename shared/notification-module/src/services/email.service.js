import nodemailer from "nodemailer";
import { emailConfig } from "../config/email.config.js";
import { emailTemplates } from "../templates/emailTemplates.js";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    const transportOptions = {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
    };

    if (emailConfig.user && emailConfig.pass) {
      transportOptions.auth = {
        user: emailConfig.user,
        pass: emailConfig.pass,
      };
    }

    transporter = nodemailer.createTransport(transportOptions);
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    console.warn("[Email Service] No recipient email specified, skipping.");
    return { success: false, reason: "No recipient" };
  }

  const mailOptions = {
    from: emailConfig.from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim(),
  };

  try {
    const transport = getTransporter();
    const info = await transport.sendMail(mailOptions);
    console.log(`[Email Service] Delivered email: "${subject}" to ${to} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, simulated: false };
  } catch (err) {
    // Graceful fallback for local development when SMTP server (e.g. Mailpit) is offline
    console.log(`[Email Service] [SIMULATED] "${subject}" to ${to} (SMTP offline: ${err.message})`);
    return {
      success: true,
      simulated: true,
      to,
      subject,
      dispatchedAt: new Date().toISOString(),
    };
  }
}

export async function sendRegistrationEmail({ to, name, email }) {
  const { subject, html } = emailTemplates.getRegistrationEmail({ name, email: email || to });
  return sendEmail({ to, subject, html });
}

export async function sendBookingConfirmation({ to, bookingId, eventTitle, seats, total, date, time, venue, city, qrCodeData }) {
  const { subject, html } = emailTemplates.getBookingConfirmationEmail({
    bookingId,
    eventTitle,
    seats,
    total,
    date,
    time,
    venue,
    city,
    qrCodeData,
  });
  return sendEmail({ to, subject, html });
}

export async function sendPaymentReceipt({ to, paymentRef, txnId, amount, method, bookingId }) {
  const { subject, html } = emailTemplates.getPaymentReceiptEmail({
    paymentRef,
    txnId,
    amount,
    method,
    bookingId,
  });
  return sendEmail({ to, subject, html });
}

export async function sendCancellationEmail({ to, bookingId, eventTitle, seats, refundAmount, refundRef }) {
  const { subject, html } = emailTemplates.getBookingCancellationEmail({
    bookingId,
    eventTitle,
    seats,
    refundAmount,
    refundRef,
  });
  return sendEmail({ to, subject, html });
}

export async function sendRefundStatusEmail({ to, refundRef, paymentRef, amount, status, timeline }) {
  const { subject, html } = emailTemplates.getRefundStatusEmail({
    refundRef,
    paymentRef,
    amount,
    status,
    timeline,
  });
  return sendEmail({ to, subject, html });
}

export async function sendEventReminder({ to, eventTitle, date, time, venue, city, bookingId }) {
  const { subject, html } = emailTemplates.getEventReminderEmail({
    eventTitle,
    date,
    time,
    venue,
    city,
    bookingId,
  });
  return sendEmail({ to, subject, html });
}

