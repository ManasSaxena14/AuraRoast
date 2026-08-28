import { env } from '@/config/env';
import { buildUpiUri } from '@/lib/upi';

/**
 * Merchant details are configuration, not secrets (§8.2). A UPI ID is designed
 * to be shared publicly to receive money — exactly like a bank account number
 * printed on an invoice — so this route is public and needs no protection.
 */
export function paymentSettings() {
  return {
    upiId: env.UPI_ID,
    payeeName: env.UPI_PAYEE_NAME,
    methods: [
      {
        id: 'cash' as const,
        label: 'Cash',
        detail: 'Pay the courier or at the counter. Confirms instantly.',
        instant: true,
      },
      {
        id: 'upi' as const,
        label: 'UPI',
        detail: 'Scan or tap to pay. A human verifies the transfer, usually within minutes.',
        instant: false,
      },
    ],
    note:
      'There is no card data anywhere in this system — not encrypted, not tokenised, simply absent. UPI verification is manual by design; automating it needs a payment-service-provider integration and a registered business.',
  };
}

export function upiPayload(orderNumber: string, amountPaise: number) {
  const uri = buildUpiUri({
    upiId: env.UPI_ID,
    payeeName: env.UPI_PAYEE_NAME,
    amountPaise,
    orderNumber,
  });
  return { uri, upiId: env.UPI_ID, payeeName: env.UPI_PAYEE_NAME, amountPaise };
}
