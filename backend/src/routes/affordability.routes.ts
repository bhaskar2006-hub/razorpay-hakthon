import { Router, Request, Response } from "express";

const router = Router();

// GET /api/checkout/affordability
// Calculates dynamic EMI plans and lists eligible BNPL providers based on purchase amount
router.get("/", (req: Request, res: Response) => {
  try {
    const amountStr = req.query.amount as string;
    if (!amountStr) {
      return res.status(400).json({ message: "amount (in paise) is required" });
    }

    const amountPaise = parseInt(amountStr, 10);
    if (isNaN(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const amountInr = amountPaise / 100;

    // 1. Calculate Credit Card EMI Options
    // Banks we support
    const banks = [
      { code: "HDFC", name: "HDFC Bank" },
      { code: "ICICI", name: "ICICI Bank" },
      { code: "SBI", name: "State Bank of India" },
      { code: "AXIS", name: "Axis Bank" },
    ];

    const tenures = [
      { months: 3, annualRate: 12 },
      { months: 6, annualRate: 13 },
      { months: 9, annualRate: 14 },
      { months: 12, annualRate: 14 },
    ];

    const emiPlans = banks.map((bank) => {
      const plans = tenures.map((tenure) => {
        const p = amountInr;
        const r = (tenure.annualRate / 12) / 100;
        const n = tenure.months;
        
        // EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
        const emiVal = Math.round(p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
        const totalPayable = emiVal * n;
        const interestAmount = totalPayable - p;

        return {
          months: n,
          interestRate: tenure.annualRate,
          emi: emiVal,
          formattedEmi: `₹${emiVal.toLocaleString("en-IN")}`,
          interestCharged: Math.round(interestAmount),
          formattedInterestCharged: `₹${Math.round(interestAmount).toLocaleString("en-IN")}`,
          totalCost: Math.round(totalPayable),
          formattedTotalCost: `₹${Math.round(totalPayable).toLocaleString("en-IN")}`,
        };
      });

      return {
        bankCode: bank.code,
        bankName: bank.name,
        plans,
      };
    });

    // 2. Calculate BNPL Options (eligible for amounts <= ₹50,000)
    const bnpl = [];
    if (amountInr <= 50000) {
      bnpl.push({
        provider: "Simpl",
        description: "Pay in 3 interest-free installments",
        installment: Math.round(amountInr / 3),
        formattedInstallment: `₹${Math.round(amountInr / 3).toLocaleString("en-IN")}/mo`,
        charges: 0,
      });
      bnpl.push({
        provider: "LazyPay",
        description: "Pay in 15 days, no extra charge",
        installment: Math.round(amountInr),
        formattedInstallment: `₹${Math.round(amountInr).toLocaleString("en-IN")}`,
        charges: 0,
      });
      bnpl.push({
        provider: "Simpl PayLater",
        description: "Buy now, pay next month",
        installment: Math.round(amountInr),
        formattedInstallment: `₹${Math.round(amountInr).toLocaleString("en-IN")}`,
        charges: 0,
      });
    }

    return res.json({
      amount: amountPaise,
      formattedAmount: `₹${amountInr.toLocaleString("en-IN")}`,
      emiPlans,
      bnpl,
    });
  } catch (error) {
    console.error("Affordability calculation error:", error);
    return res.status(500).json({ message: "Failed to calculate affordability options" });
  }
});

export default router;
