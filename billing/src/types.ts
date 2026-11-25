export type PriceMode = "exclusive" | "inclusive";

/** How the supply is treated. Only "taxable" calculates GST. */
export type Supply = "taxable" | "exempt" | "nil" | "non-gst";

/** How the money came in, or "unpaid". Part payments keep the method and a smaller amountPaid. */
export type Payment = "cash" | "upi" | "card" | "bank" | "unpaid";

export type PaymentStatus = "paid" | "partial" | "unpaid";

export type InvoiceStatus = "issued" | "cancelled";

export type InvoiceLayout = "standard" | "compact";

export type BusinessInput = {
  name: string;
  category: string;
  address: string;
  state: string;
  phone: string;
  email: string;
  /** A small data:image URL, or "". */
  logo: string;
  gstRegistered: boolean;
  gstin: string;
  invoicePrefix: string;
  defaultPriceMode: PriceMode;
  defaultGstRate: number;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  upiId: string;
  terms: string;
  footer: string;
  layout: InvoiceLayout;
  showHsn: boolean;
  /** Round the payable amount to the nearest rupee. */
  roundOff: boolean;
};

export type Business = BusinessInput & {
  id: string;
  ownerId: string;
  organisationId: string;
  nextNumber: number;
  createdAt: string;
};

/** The seller as printed on one invoice. Frozen when the invoice is issued. */
export type SellerSnapshot = Pick<
  BusinessInput,
  | "name"
  | "address"
  | "state"
  | "phone"
  | "email"
  | "gstRegistered"
  | "gstin"
  | "bankName"
  | "bankAccount"
  | "bankIfsc"
  | "upiId"
  | "footer"
  | "layout"
  | "showHsn"
>;

export type ItemInput = {
  name: string;
  description: string;
  price: number;
  hsn: string;
  gstRate: number;
  priceMode: PriceMode;
  unit: string;
  supply: Supply;
};

export type Item = ItemInput & {
  id: string;
  businessId: string;
  createdAt: string;
};

export type CustomerKind = "registered" | "unregistered";

export type CustomerEntity = "business" | "individual";

export type CustomerInput = {
  name: string;
  entity: CustomerEntity;
  kind: CustomerKind;
  gstin: string;
  phone: string;
  address: string;
  state: string;
};

export type Customer = CustomerInput & {
  id: string;
  businessId: string;
  createdAt: string;
};

export type LineInput = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  priceMode: PriceMode;
  discount: number;
  supply: Supply;
  hsn: string;
  unit: string;
  /** Packaging count, such as bags. It is not part of the price. */
  packs: number | null;
  packUnit: string;
  itemId: string | null;
};

export type CalculatedLine = LineInput & {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
};

export type CalculatedBill = {
  interstate: boolean;
  lines: CalculatedLine[];
  /** Quantity × rate before discounts, as typed. */
  subtotal: number;
  discount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
  roundOff: number;
  /** total + roundOff: what the customer pays. */
  payable: number;
};

export type InvoiceInput = {
  /** Set by the phone for each draft, so a retried save returns the same invoice. */
  clientRef: string | null;
  issuedOn: string;
  dueOn: string | null;
  customerId: string | null;
  customerName: string;
  customerKind: CustomerKind;
  customerGstin: string;
  customerState: string;
  customerAddress: string;
  customerPhone: string;
  /** State of supply. Blank means the customer's state. */
  placeOfSupply: string;
  paymentTerms: string;
  poNumber: string;
  notes: string;
  terms: string;
  payment: Payment;
  /** Null means paid in full when payment is not "unpaid". */
  amountPaid: number | null;
  lines: LineInput[];
  /** What the phone showed. The server refuses to save if its own sum differs. */
  expectedPayable: number | null;
};

export type Invoice = CalculatedBill & {
  id: string;
  businessId: string;
  clientRef: string | null;
  number: string;
  issuedOn: string;
  dueOn: string | null;
  customerId: string | null;
  customerName: string;
  customerKind: CustomerKind;
  customerGstin: string;
  customerState: string;
  customerAddress: string;
  customerPhone: string;
  placeOfSupply: string;
  paymentTerms: string;
  poNumber: string;
  notes: string;
  terms: string;
  payment: Payment;
  amountPaid: number;
  status: InvoiceStatus;
  /** Null on invoices made before seller details were frozen. */
  seller: SellerSnapshot | null;
  createdAt: string;
};

export type MonthSummary = {
  month: string;
  count: number;
  taxable: number;
  tax: number;
  total: number;
  /** Still to collect on issued bills of this month. */
  outstanding: number;
};
