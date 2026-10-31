import { query, isDbConnected } from "../pool.js";

const inMemoryPayments = new Map();
const inMemoryRefunds = new Map();

export const paymentRepo = {
  async findByIdempotencyKey(key) {
    if (!key) return null;
    if (isDbConnected()) {
      const res = await query(
        `SELECT id, payment_reference, booking_reference, amount, currency, payment_method, payment_status, gateway_transaction_id, metadata, created_at
         FROM payments
         WHERE idempotency_key = $1`,
        [key]
      );
      return res.rows[0] || null;
    }
    return inMemoryPayments.get(`idemp:${key}`) || null;
  },

  async recordPayment({
    paymentReference,
    bookingReference,
    amount,
    currency = "INR",
    paymentMethod = "UPI",
    paymentStatus = "COMPLETED",
    idempotencyKey = null,
    gatewayTransactionId = null,
    metadata = {},
  }) {
    if (isDbConnected()) {
      const res = await query(
        `INSERT INTO payments (
          payment_reference, booking_reference, amount, currency,
          payment_method, payment_status, idempotency_key,
          gateway_transaction_id, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id, payment_reference, booking_reference, amount, currency, payment_method, payment_status, gateway_transaction_id, metadata, created_at`,
        [
          paymentReference,
          bookingReference,
          amount,
          currency,
          paymentMethod,
          paymentStatus,
          idempotencyKey,
          gatewayTransactionId,
          JSON.stringify(metadata),
        ]
      );
      return res.rows[0];
    }

    const record = {
      id: Math.floor(Math.random() * 100000),
      payment_reference: paymentReference,
      booking_reference: bookingReference,
      amount,
      currency,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      idempotency_key: idempotencyKey,
      gateway_transaction_id: gatewayTransactionId,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryPayments.set(paymentReference, record);
    if (idempotencyKey) inMemoryPayments.set(`idemp:${idempotencyKey}`, record);
    return record;
  },

  async updatePaymentStatus({ paymentReference, paymentStatus, gatewayTransactionId = null, metadata = {} }) {
    if (isDbConnected()) {
      const res = await query(
        `UPDATE payments
         SET payment_status = $2,
             gateway_transaction_id = COALESCE($3, gateway_transaction_id),
             metadata = metadata || $4::jsonb,
             updated_at = NOW()
         WHERE payment_reference = $1
         RETURNING id, payment_reference, booking_reference, amount, currency, payment_method, payment_status, gateway_transaction_id, metadata, updated_at`,
        [paymentReference, paymentStatus, gatewayTransactionId, JSON.stringify(metadata)]
      );
      return res.rows[0] || null;
    }

    const record = inMemoryPayments.get(paymentReference);
    if (record) {
      record.payment_status = paymentStatus;
      if (gatewayTransactionId) record.gateway_transaction_id = gatewayTransactionId;
      record.metadata = { ...record.metadata, ...metadata };
      record.updated_at = new Date().toISOString();
      return record;
    }
    return null;
  },

  async getPaymentByReference(ref) {
    if (!ref) return null;
    if (isDbConnected()) {
      const res = await query(
        `SELECT id, payment_reference, booking_reference, amount, currency, payment_method, payment_status, gateway_transaction_id, metadata, created_at, updated_at
         FROM payments
         WHERE payment_reference = $1`,
        [ref]
      );
      return res.rows[0] || null;
    }
    return inMemoryPayments.get(ref) || null;
  },

  async getPaymentByBooking(bookingReference) {
    if (!bookingReference) return null;
    if (isDbConnected()) {
      const res = await query(
        `SELECT id, payment_reference, booking_reference, amount, currency, payment_method, payment_status, gateway_transaction_id, metadata, created_at, updated_at
         FROM payments
         WHERE booking_reference = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [bookingReference]
      );
      return res.rows[0] || null;
    }

    return (
      Array.from(inMemoryPayments.values()).find(
        (p) => p.booking_reference === bookingReference
      ) || null
    );
  },

  async processRefund(paymentReference, amount, reason) {
    const refundRef = "REF_" + Date.now().toString(36).toUpperCase() + "_" + Math.random().toString(36).slice(2, 6).toUpperCase();
    if (isDbConnected()) {
      await query(
        `INSERT INTO refunds (
          refund_reference, payment_reference, amount, reason, refund_status, created_at
        ) VALUES ($1, $2, $3, $4, 'COMPLETED', NOW())`,
        [refundRef, paymentReference, amount, reason || "Customer requested refund"]
      );
      await query(
        `UPDATE payments
         SET payment_status = 'REFUNDED', updated_at = NOW()
         WHERE payment_reference = $1`,
        [paymentReference]
      );
    }

    const refundRec = {
      refund_reference: refundRef,
      payment_reference: paymentReference,
      amount,
      reason,
      refund_status: "COMPLETED",
      created_at: new Date().toISOString(),
    };
    inMemoryRefunds.set(refundRef, refundRec);

    const payment = inMemoryPayments.get(paymentReference);
    if (payment) {
      payment.payment_status = "REFUNDED";
      payment.updated_at = new Date().toISOString();
    }

    return {
      refundReference: refundRef,
      paymentReference,
      amount,
      status: "COMPLETED",
      refundedAt: refundRec.created_at,
    };
  },
};
