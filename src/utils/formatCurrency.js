export const formatCurrency = (amount, minimumFractionDigits = 2) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits }).format(amount);
};
