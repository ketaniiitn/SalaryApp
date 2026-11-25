import { ApiError, request } from "@/lib/api";
import type { Business, BusinessInput, Customer, CustomerInput, Invoice, InvoiceInput, Item, ItemInput, MonthSummary, Payment } from "@/billing/engine";

export async function billingForOrganisation(baseUrl: string, organisationId: string): Promise<Business | null> {
  try {
    return await request(baseUrl, `/api/billing/organisations/${organisationId}`);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return null;
    throw caught;
  }
}

export function createBillingForOrganisation(baseUrl: string, organisationId: string, input: BusinessInput): Promise<Business> {
  return request(baseUrl, `/api/billing/organisations/${organisationId}`, { method: "POST", body: JSON.stringify(input) });
}

export function listBusinesses(baseUrl: string): Promise<Business[]> {
  return request(baseUrl, "/api/billing/businesses");
}

export function createBusiness(baseUrl: string, input: BusinessInput): Promise<Business> {
  return request(baseUrl, "/api/billing/businesses", { method: "POST", body: JSON.stringify(input) });
}

export function getBusiness(baseUrl: string, id: string): Promise<Business> {
  return request(baseUrl, `/api/billing/businesses/${id}`);
}

export function updateBusiness(baseUrl: string, id: string, input: BusinessInput): Promise<Business> {
  return request(baseUrl, `/api/billing/businesses/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function getSummary(baseUrl: string, id: string): Promise<MonthSummary> {
  return request(baseUrl, `/api/billing/businesses/${id}/summary`);
}

export function listItems(baseUrl: string, businessId: string): Promise<Item[]> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/items`);
}

export function createItem(baseUrl: string, businessId: string, input: ItemInput): Promise<Item> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/items`, { method: "POST", body: JSON.stringify(input) });
}

export function deleteItem(baseUrl: string, businessId: string, itemId: string): Promise<void> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/items/${itemId}`, { method: "DELETE" });
}

export function listCustomers(baseUrl: string, businessId: string): Promise<Customer[]> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/customers`);
}

export function createCustomer(baseUrl: string, businessId: string, input: CustomerInput): Promise<Customer> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/customers`, { method: "POST", body: JSON.stringify(input) });
}

export function updateCustomer(baseUrl: string, businessId: string, customerId: string, input: CustomerInput): Promise<Customer> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/customers/${customerId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listInvoices(baseUrl: string, businessId: string, filter: { query?: string; from?: string; to?: string } = {}): Promise<Invoice[]> {
  const params = new URLSearchParams();
  if (filter.query?.trim()) params.set("q", filter.query.trim());
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  const search = params.toString();
  return request(baseUrl, `/api/billing/businesses/${businessId}/invoices${search ? `?${search}` : ""}`);
}

export function createInvoice(baseUrl: string, businessId: string, input: InvoiceInput): Promise<Invoice> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/invoices`, { method: "POST", body: JSON.stringify(input) });
}

export function getInvoice(baseUrl: string, businessId: string, invoiceId: string): Promise<Invoice> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/invoices/${invoiceId}`);
}

/** amountPaid null means paid in full. */
export function setPayment(baseUrl: string, businessId: string, invoiceId: string, payment: Payment, amountPaid: number | null = null): Promise<Invoice> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/invoices/${invoiceId}`, {
    method: "PATCH",
    body: JSON.stringify({ payment, amountPaid }),
  });
}

export function cancelInvoice(baseUrl: string, businessId: string, invoiceId: string): Promise<Invoice> {
  return request(baseUrl, `/api/billing/businesses/${businessId}/invoices/${invoiceId}/cancel`, { method: "POST" });
}
