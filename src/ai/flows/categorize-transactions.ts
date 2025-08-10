"use server";

/**
 * @fileOverview An AI agent that categorizes financial transactions based on industry.
 *
 * - categorizeTransactions - A function that handles the transaction categorization process.
 */

import { ai } from "@/ai/genkit";
import {
  CategorizeTransactionsInputSchema,
  CategorizeTransactionsOutputSchema,
  CategorizeTransactionsInput,
  CategorizeTransactionsOutput,
} from "@/ai/schemas";

export async function categorizeTransactions(
  input: CategorizeTransactionsInput
): Promise<CategorizeTransactionsOutput> {
  return categorizeTransactionsFlow(input);
}

const categorizationPrompt = ai.definePrompt({
  name: "transactionCategorizationPrompt",
  input: { schema: CategorizeTransactionsInputSchema },
  output: { schema: CategorizeTransactionsOutputSchema },
  prompt: `You are an expert financial analyst specializing in categorizing transactions for Business Activity Statements (BAS). Your task is to categorize a list of raw transactions based on the user's specified industry.

  **User's Industry:** {{industry}}

  **Your Instructions:**
  1.  Analyze each raw transaction in the provided JSON array.
  2.  Based on the transaction description and the user's industry, determine the correct 'category' and 'subCategory'.
  3.  Use the industry-specific lexicons below to guide your categorization. The description of the transaction is the most important factor.
  4.  Every single transaction MUST be assigned a 'category' and a 'subCategory'.
  5.  Return a new JSON array containing all the original transactions, now with the added 'category' and 'subCategory' fields.

  **Industry Lexicons:**

  **Rideshare:**
  - **Income:** UBERBV, DIDI MOBILITY, tips, bonuses, rideshare platform payments.
  - **Expenses:**
    - **Vehicle Lease/Hire:** Splend Australia, rental fees, vehicle subscription services.
    - **Tolls:** Linkt Melbourne, road tolls, bridge tolls, tunnel fees.
    - **Fuel/EV Charging:** AMPOL, BP, CALTEX, 7-ELEVEN, Shell, United, Liberty, Metro, Reddy Express, electricity, EV charging stations.
    - **Repairs & Maintenance:** Knights Windscreen Repairs, servicing, tyres, mechanical repairs.
    - **Car Cleaning:** IMO CARWASH, CIRCUM WASH, ZLR*Asultan, car wash services, cleaning supplies.
    - **Phone & Data:** Felix Mobile, Telstra, Optus, Vodafone, mobile phone bills (business use portion).
    - **Platform Fees:** Uber service fee, DiDi Service Fee, booking fees, commission.
    - **Professional Fees:** MYOB, accounting software, tax agent fees.
    - **Accessories:** Mikes Elec, car chargers, phone mounts, dash cams, EV accessories.
    - **Passenger Amenities:** water, mints, newspapers, passenger comfort items.

  **Construction & Trades:**
  - **Income:** Invoices, Progress Payments, Client Names, construction services, trade work.
  - **Expenses:**
    - **Materials & Supplies:** Bunnings, Mitre 10, Reece, trade suppliers, timber, concrete, plumbing supplies, electrical components.
    - **Tools & Equipment:** Total Tools, Sydney Tools, Kennards Hire, tool purchases, equipment hire.
    - **Vehicle Expenses:** Fuel, Registration, Insurance, Maintenance (business use percentage).
    - **Safety Equipment (PPE):** Hard hats, steel-capped boots, hi-vis clothing, gloves, safety gear.
    - **Licences & Insurance:** Trade licences, White Card, Public Liability Insurance, professional qualifications.
    - **Subcontractors:** Payments to other contractors (must be reported via TPAR).

  **NDIS Support Work:**
  - **Income:** Participant names, Plan Manager names, NDIS payments, self-managed participant payments.
  - **Expenses:**
    - **Professional Fees:** AHPRA, professional association fees, annual registration, membership fees.
    - **Insurance:** Professional Indemnity, Public Liability, essential insurance premiums.
    - **Training & Education:** First Aid, CPR, specific disability courses, self-education related to role.
    - **Supplies & Equipment:** Sensory tools, PPE, sanitiser, gloves, consumables, client support equipment.
    - **Travel Expenses:** Fuel, public transport fares, tolls, travel between client homes/workplaces.
    - **Home Office:** Internet, phone, stationery, portion of home office costs for administrative tasks.

  **Truck Driving:**
  - **Income:** Invoices, freight company names, hauling contracts, transport services.
  - **Expenses:**
    - **Vehicle Expenses:** Fuel, oil, tyres, registration, insurance, loan interest, repairs (all truck running costs).
    - **Travel Expenses:** Accommodation, meals, showers (for required overnight trips away from home).
    - **Licences & Fees:** Heavy vehicle permits, medical examinations, costs to maintain required licences.
    - **Communications:** Phone bills, internet, radio equipment (business-use portion).
    - **Administration:** Logbooks, stationery, accounting fees, business management costs.
    - **Fuel Tax Credits:** Fuel purchases (separate credit system claimed on BAS).

  **Allied Health:**
  - **Income:** Patient names, Medicare, DVA, private health funds, patient services (potentially GST-free).
  - **Expenses:**
    - **Professional Fees:** AHPRA, association memberships (e.g., APA), annual registration, professional body fees.
    - **Insurance:** Professional Indemnity Insurance, key business insurance.
    - **Clinic/Office Expenses:** Rent, electricity, internet, phone, practice location costs.
    - **Equipment & Supplies:** Treatment tables, medical supplies, software, depreciation for items over $300, consumables.
    - **Self-Education:** Seminars, conferences, journals, maintaining and improving professional skills.
    - **Vehicle Expenses:** Fuel, maintenance, registration (for travel between clinics or patient homes, logbook required).

  **Raw Transactions Data:**
  {{{jsonStringify rawTransactions}}}
  `,
});

const categorizeTransactionsFlow = ai.defineFlow(
  {
    name: "categorizeTransactionsFlow",
    inputSchema: CategorizeTransactionsInputSchema,
    outputSchema: CategorizeTransactionsOutputSchema,
  },
  async (input) => {
    try {
      console.log("categorizeTransactionsFlow input:", input);
      const { output } = await categorizationPrompt(input);
      console.log("categorizeTransactionsFlow output:", output);
      
      if (!output) {
        console.log("No output from categorization prompt");
        return { transactions: [] };
      }
      return {
        transactions: output.transactions || [],
      };
    } catch (error) {
      console.error("Error in categorizeTransactionsFlow:", error);
      return { transactions: [] };
    }
  }
);
