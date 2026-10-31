function baseLayout(title, content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f7; margin: 0; padding: 24px; color: #1f2937; }
    .box { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; }
    .header { background: #1f2533; padding: 24px 32px; color: #ffffff; display: flex; align-items: center; justify-content: space-between; }
    .brand { font-size: 24px; font-weight: 300; letter-spacing: -0.5px; }
    .brand b { color: #f84464; font-weight: 800; }
    .badge { background: rgba(248,68,100,0.2); color: #f84464; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .body { padding: 32px; }
    .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .ticket-card { background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; padding: 20px; margin: 20px 0; }
    .btn { display: inline-block; background: #f84464; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; font-weight: 700; text-decoration: none; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <div class="brand">show<b>time</b></div>
      <div class="badge">Official Notice</div>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© 2026 ShowTime Events Pvt. Ltd. · 100% Verified Live Entertainment</p>
      <p>This is an automated system email for your registered ShowTime account.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export const emailTemplates = {
  getRegistrationEmail({ name, email }) {
    const content = `
      <h2 style="font-size: 22px; font-weight: 800; color: #111827; margin-top: 0;">Welcome to ShowTime, ${name}!</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Your ShowTime account has been successfully created. You can now discover, reserve, and book exclusive concerts, cricket matches, standup comedy, and nightlife events across India.
      </p>
      <div class="ticket-card">
        <strong style="display: block; font-size: 14px; margin-bottom: 6px;">Account Details:</strong>
        <span style="font-size: 13px; color: #6b7280;">Registered Email: <strong>${email}</strong></span><br>
        <span style="font-size: 13px; color: #6b7280;">Member Status: <strong style="color: #16a34a;">Active · Verified</strong></span>
      </div>
      <p style="font-size: 14px; color: #4b5563;">
        Enjoy instant digital E-Tickets and fast-track gate entry with scannable QR passes.
      </p>
    `;
    return {
      subject: `Welcome to ShowTime, ${name}!`,
      html: baseLayout("Welcome to ShowTime", content),
    };
  },

  getBookingConfirmationEmail({ bookingId, eventTitle, seats, total, date, time, venue, city, qrCodeData }) {
    const seatList = Array.isArray(seats) ? seats.join(", ") : seats;
    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: #e8f8ed; color: #16a34a; font-size: 24px;">✓</div>
        <h2 style="font-size: 24px; font-weight: 800; color: #111827; margin: 10px 0 4px;">Booking Confirmed!</h2>
        <p style="font-size: 13px; color: #6b7280; margin: 0;">Booking Reference: <strong>${bookingId}</strong></p>
      </div>

      <div class="ticket-card">
        <h3 style="font-size: 18px; font-weight: 700; color: #1f2937; margin: 0 0 12px;">${eventTitle}</h3>
        <p style="font-size: 13px; margin: 4px 0; color: #4b5563;"><strong>Venue:</strong> ${venue}, ${city}</p>
        <p style="font-size: 13px; margin: 4px 0; color: #4b5563;"><strong>Date & Time:</strong> ${date} at ${time}</p>
        <p style="font-size: 13px; margin: 4px 0; color: #4b5563;"><strong>Confirmed Seats:</strong> <span style="color: #f84464; font-weight: 700;">${seatList}</span></p>
        <p style="font-size: 13px; margin: 4px 0; color: #4b5563;"><strong>Total Amount Paid:</strong> <strong>₹${Number(total).toLocaleString()}</strong></p>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #4b5563;">
        Present your digital mobile ticket or QR code at gate security for contactless verification. No physical printout is required.
      </p>
    `;
    return {
      subject: `Tickets Confirmed: ${eventTitle} (Ref: ${bookingId})`,
      html: baseLayout("Tickets Confirmed", content),
    };
  },

  getPaymentReceiptEmail({ paymentRef, txnId, amount, method, bookingId }) {
    const content = `
      <h2 style="font-size: 22px; font-weight: 800; color: #111827; margin-top: 0;">Payment Receipt</h2>
      <p style="font-size: 14px; color: #4b5563;">
        We have received your payment of <strong>₹${Number(amount).toLocaleString()}</strong> for Order <strong>${bookingId}</strong>.
      </p>
      <div class="ticket-card">
        <p style="font-size: 13px; margin: 6px 0;"><strong>Payment Reference:</strong> ${paymentRef}</p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Transaction ID:</strong> ${txnId || "TXN_SIMULATED"}</p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Payment Method:</strong> ${method || "UPI"}</p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Status:</strong> <span style="color: #16a34a; font-weight: 700;">PAID & SETTLED</span></p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Paid At:</strong> ${new Date().toLocaleString("en-IN")}</p>
      </div>
    `;
    return {
      subject: `Payment Receipt: ₹${Number(amount).toLocaleString()} for ${bookingId}`,
      html: baseLayout("Payment Receipt", content),
    };
  },

  getBookingCancellationEmail({ bookingId, eventTitle, seats, refundAmount, refundRef }) {
    const seatList = Array.isArray(seats) ? seats.join(", ") : seats;
    const content = `
      <h2 style="font-size: 22px; font-weight: 800; color: #dc2626; margin-top: 0;">Booking Cancelled</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Your booking <strong>${bookingId}</strong> for <strong>${eventTitle}</strong> (Seats: ${seatList}) has been cancelled as requested.
      </p>
      <div class="ticket-card" style="border-color: #fecaca; background: #fef2f2;">
        <h4 style="font-size: 15px; color: #991b1b; margin: 0 0 8px;">Refund Breakdown:</h4>
        <p style="font-size: 13px; margin: 4px 0;"><strong>Refund Amount:</strong> <strong style="color: #16a34a; font-size: 16px;">₹${Number(refundAmount).toLocaleString()}</strong></p>
        <p style="font-size: 13px; margin: 4px 0;"><strong>Refund Reference ID:</strong> ${refundRef}</p>
        <p style="font-size: 13px; margin: 4px 0;"><strong>Status:</strong> <span style="color: #2563eb; font-weight: 700;">PROCESSING</span></p>
      </div>
      <p style="font-size: 13px; color: #6b7280;">
        The refund has been initiated to your original payment method and will reflect in 3-5 business days. Your QR tickets have been invalidated.
      </p>
    `;
    return {
      subject: `Cancellation Confirmed: ${eventTitle} (Ref: ${bookingId})`,
      html: baseLayout("Booking Cancelled", content),
    };
  },

  getRefundStatusEmail({ refundRef, paymentRef, amount, status, timeline = "3-5 business days" }) {
    const content = `
      <h2 style="font-size: 22px; font-weight: 800; color: #111827; margin-top: 0;">Refund Update</h2>
      <p style="font-size: 14px; color: #4b5563;">
        Your refund of <strong>₹${Number(amount).toLocaleString()}</strong> has been processed by our banking gateway.
      </p>
      <div class="ticket-card">
        <p style="font-size: 13px; margin: 6px 0;"><strong>Refund Reference:</strong> ${refundRef}</p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Original Payment:</strong> ${paymentRef}</p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Status:</strong> <span style="color: #16a34a; font-weight: 700;">${status}</span></p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Estimated Credit:</strong> ${timeline}</p>
      </div>
    `;
    return {
      subject: `Refund Processed: ₹${Number(amount).toLocaleString()} (Ref: ${refundRef})`,
      html: baseLayout("Refund Processed", content),
    };
  },

  getEventReminderEmail({ eventTitle, date, time, venue, city, bookingId }) {
    const content = `
      <h2 style="font-size: 22px; font-weight: 800; color: #111827; margin-top: 0;">Event Reminder: Showtime is Tomorrow!</h2>
      <p style="font-size: 14px; color: #4b5563;">
        Get ready for <strong>${eventTitle}</strong> happening on <strong>${date} at ${time}</strong>.
      </p>
      <div class="ticket-card">
        <p style="font-size: 13px; margin: 6px 0;"><strong>Venue:</strong> ${venue}, ${city}</p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Booking ID:</strong> ${bookingId}</p>
        <p style="font-size: 13px; margin: 6px 0;"><strong>Gates Open:</strong> 1 hour before showtime</p>
      </div>
    `;
    return {
      subject: `Reminder: ${eventTitle} is tomorrow!`,
      html: baseLayout("Event Reminder", content),
    };
  },
};

