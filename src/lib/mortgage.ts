// Standard fixed-rate mortgage math.

export function monthlyMortgagePayment(
  principal: number,
  annualRatePct: number,
  years = 30,
): number {
  if (principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export interface PitiInput {
  housePrice: number;
  downPaymentPct: number; // 0..1
  annualRatePct: number;
  propertyTaxRatePct: number; // annual % of price
  homeInsuranceAnnual: number;
  hoaMonthly: number;
}

export interface Piti {
  loanAmount: number;
  downPayment: number;
  principalInterest: number;
  propertyTax: number;
  insurance: number;
  hoa: number;
  pmi: number;
  total: number;
}

// Principal, Interest, Taxes, Insurance (+ HOA, +PMI if < 20% down).
export function computePiti(input: PitiInput): Piti {
  const downPayment = input.housePrice * input.downPaymentPct;
  const loanAmount = input.housePrice - downPayment;
  const principalInterest = monthlyMortgagePayment(loanAmount, input.annualRatePct);
  const propertyTax = (input.housePrice * (input.propertyTaxRatePct / 100)) / 12;
  const insurance = input.homeInsuranceAnnual / 12;
  // Rough PMI: ~0.6%/yr of loan when down payment is under 20%.
  const pmi = input.downPaymentPct < 0.2 ? (loanAmount * 0.006) / 12 : 0;
  const total = principalInterest + propertyTax + insurance + input.hoaMonthly + pmi;
  return {
    loanAmount,
    downPayment,
    principalInterest,
    propertyTax,
    insurance,
    hoa: input.hoaMonthly,
    pmi,
    total,
  };
}
