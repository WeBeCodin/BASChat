import { NextRequest, NextResponse } from "next/server";
import {
  CategorizeTransactionsInput,
  CategorizeTransactionsOutput,
} from "@/ai/schemas";

export async function POST(request: NextRequest) {
  try {
    console.log("=== Categorization API Route Starting ===");
    
    const body = await request.json();
    console.log("Categorization API Route received body keys:", Object.keys(body));
    console.log("Transaction count:", body?.rawTransactions?.length);
    console.log("Industry:", body?.industry);
    
    const input: CategorizeTransactionsInput = body;
    
    console.log("About to call categorizeTransactionsAPI...");
    const result = await categorizeTransactionsAPI(input);
    
    console.log("Categorization API Route result success:", !!result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("=== Categorization API Route ERROR ===");
    console.error("Error name:", error instanceof Error ? error.name : "Unknown");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    
    return NextResponse.json(
      {
        transactions: [],
        maybeTransactions: undefined,
        error: "Failed to categorize transactions",
        errorDetails: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function categorizeTransactionsAPI(
  input: CategorizeTransactionsInput
): Promise<CategorizeTransactionsOutput> {
  try {
    console.log("=== categorizeTransactionsAPI Starting ===");
    console.log("Input transaction count:", input.rawTransactions?.length);
    console.log("Input industry:", input.industry);

    // Use direct Google AI API instead of Genkit (which was causing issues)
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    console.log("API key exists:", !!apiKey);
    console.log("API key length:", apiKey?.length || 0);

    if (!apiKey) {
      throw new Error("GOOGLE_GENAI_API_KEY not found");
    }

    // Process in batches if we have too many transactions
    const BATCH_SIZE = 50; // Process 50 transactions at a time
    const transactions = input.rawTransactions;

    if (transactions.length > BATCH_SIZE) {
      console.log(
        `Processing ${transactions.length} transactions in batches of ${BATCH_SIZE}`
      );

      const allFinalTransactions: any[] = [];
      const allMaybeTransactions: any[] = [];

      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        console.log(
          `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
            transactions.length / BATCH_SIZE
          )} (${batch.length} transactions)`
        );

        const batchResult = await processBatch(
          { ...input, rawTransactions: batch },
          apiKey
        );

        allFinalTransactions.push(...batchResult.transactions);
        if (batchResult.maybeTransactions) {
          allMaybeTransactions.push(...batchResult.maybeTransactions);
        }

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < transactions.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return {
        transactions: allFinalTransactions,
        maybeTransactions:
          allMaybeTransactions.length > 0 ? allMaybeTransactions : undefined,
      };
    } else {
      // Process single batch
      return await processBatch(input, apiKey);
    }
  } catch (error) {
    console.error("Error in categorizeTransactions:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

function getIndustrySpecificGuidance(industry: string): string {
  const guidance: { [key: string]: string } = {
    "Rideshare": `
CRITICAL RIDESHARE BAS RULES:
1. INCOME: Use GROSS FARES from official tax summaries (not bank deposits)
2. AVOID DOUBLE-COUNTING: Platform fees and tolls already deducted from deposits
3. GST: Only on "Gross transportation fare" - excludes tips/rewards
4. APPORTIONMENT: Phone, electricity, insurance need business % allocation

INCOME CATEGORIES:
- Gross Fares: Official Uber/DiDi tax summary amounts (before fees)
- Tips & Bonuses: Cash tips, surge pricing (usually non-GST)

EXPENSE SUBCATEGORIES:
- Vehicle Lease/Rental: Splend, other car rental companies, car loan payments
- Fuel: Ampol, BP, Caltex, 7-Eleven (if fuel purchased)
- Tolls: Linkt, E-Way tolls (check if already in platform summary)
- Vehicle Cleaning: Car wash services, cleaning supplies
- Vehicle Maintenance: Repairs, services, windscreen, tyres, parts
- Electricity: EV charging at home (apportion business use %)
- Communications: Phone bills, internet, data plans (apportion business use %)
- Platform Fees: Uber/DiDi service fees (from tax summaries)
- Equipment & Tools: Phone mounts, chargers, dashcam, GPS devices
- Fines: NOT DEDUCTIBLE - exclude from BAS completely
- Professional Services: Background checks, license renewals

SPECIAL HANDLING:
- Use rideshare tax summaries as primary income source
- Bank deposits = net amounts after fees already deducted
- Exclude fines (FINES VIC DIRECT) - not deductible
- Electricity/phone require business use percentage calculation`,

    "Construction & Trades": `
**CRITICAL CONSTRUCTION BAS RULES (Real-World Expertise):**

**🚨 TAXABLE PAYMENTS REPORTING SYSTEM (TPRS) - MANDATORY:**
- Must report ALL payments to subcontractors annually to ATO
- Keep ABN, name, total annual payments for each subcontractor
- Report on Taxable Payments Annual Report (TPAR)
- When categorizing subcontractor payments, remind user of TPAR obligation

**INCOME CLASSIFICATION:**
- Contract payments: Business Income (subject to GST if >$75k turnover)
- Labour charges: Business Income
- Material markups: Business Income (separate from raw material cost)
- All construction income typically subject to GST

**🚨 INSTANT ASSET WRITE-OFF vs DEPRECIATION:**
- Tools under current threshold (check amount): Immediate deduction
- Tools over threshold: Must be depreciated
- When categorizing tool purchases, check value and advise accordingly

**MATERIALS vs LABOUR SEPARATION:**
- Important for accurate job costing and GST calculation
- Materials from suppliers: Cost of Goods Sold
- Labour portion: Service income

**COMMON BUSINESS EXPENSES:**
- Tools and equipment: Equipment (check instant asset write-off threshold)
- Materials for jobs: Cost of Goods Sold
- Subcontractor payments: Subcontractor costs (TPAR required)
- Vehicle expenses: Motor Vehicle (often 100% business use)
- Site fees and waste disposal: Site costs
- Safety equipment: Equipment/PPE
- Licenses and courses: Professional Development

**SAMPLE TRANSACTION PATTERNS:**
- "BuildRight Homes" invoice → Business Income + GST
- "Labour - Fix-out (80 hrs @ $75/hr): $6,000" → Business Income
- "Materials - Skirting & Architraves: $1,500" → Business Income (markup)
- "Milwaukee M18 Circular Saw: $399" → Equipment (check write-off threshold)
- "Bunnings - Timber, Screws: $1,250.60" → Cost of Goods Sold
- "Waste Disposal (Ute Load): $95" → Site costs

**GST TREATMENT:**
- Most construction income: Include in G1 (Total Sales)
- Tool and material purchases: Claim GST credits (1B field)
- Subcontractor payments: Check if they're GST registered

**MANDATORY EXCLUSIONS:**
- Fines and penalties
- Personal use of tools/vehicle
- Entertainment (unless client-related)

**SPECIAL COMPLIANCE:**
- Public liability insurance essential
- Licenses and safety cards required
- White Card/Construction Induction training deductible
`,

    "NDIS Support Work": `
**CRITICAL NDIS BAS RULES (Real-World Expertise):**

**🚨 NDIS SERVICES ARE GST-FREE - MOST IMPORTANT RULE:**
- Income for "reasonable and necessary" NDIS supports is GST-FREE
- DO NOT include NDIS income in G1 (Total Sales) for GST calculations
- Still assessable income for tax purposes, but NOT for BAS GST calculation
- Example: "$1,636.75" from MyPlan Connect → Income but GST-FREE

**GST REFUND OPPORTUNITY:**
- You CAN claim GST credits on business purchases (1B field)
- Since income is GST-free (1A = $0), you'll likely get GST REFUNDS each quarter
- Explain to user: "Because NDIS income is GST-free, you may receive GST refunds"

**INCOME CLASSIFICATION:**
- Plan Manager payments: GST-free NDIS income
- Direct participant payments: GST-free NDIS income  
- Private (non-NDIS) services: May be GST-free if health-related, or taxable

**🚨 MANDATORY LOGBOOK FOR VEHICLE EXPENSES:**
- Essential for claiming car expenses between clients
- Need business use percentage
- ALWAYS remind user: "Logbook required for vehicle expense claims"

**COMMON BUSINESS EXPENSES (Claim GST credits on these):**
- Professional insurance: Professional Development (often GST-free)
- Worker screening: Professional Development
- First Aid/CPR courses: Training & Development (often GST-free)
- Art supplies for clients: Client supplies/Equipment
- Sensory toys: Client supplies/Equipment  
- Car expenses: Motor Vehicle (business % only)

**SAMPLE TRANSACTION PATTERNS:**
- "MyPlan Connect" payments → NDIS Income (GST-FREE)
- "Community Access (15 hrs @ $65.47/hr)" → NDIS Income (GST-FREE)
- "AAMI Insurance - Professional Indemnity" → Professional Development + claim GST
- "Kmart - Art Supplies (for client)" → Client supplies + claim GST
- "St John Ambulance - First Aid Course" → Training (often GST-free)

**BAS CALCULATION IMPACT:**
- G1 (Total Sales): $0 for NDIS income (GST-free)
- 1A (GST on Sales): $0 for NDIS income
- 1B (GST Credits): Normal claims on business purchases
- Net Result: Usually GST refund each quarter

**MANDATORY EXCLUSIONS:**
- Personal vehicle use
- Personal development not NDIS-related
- Entertainment and personal meals
`,

    "Truck Driving": `
**CRITICAL TRUCK DRIVING BAS RULES (Real-World Expertise):**

**🚨 FUEL TAX CREDITS (FTC) - MOST IMPORTANT RULE:**
- Heavy vehicles (over 4.5 tonnes GVM) operating on public roads can claim FTC
- When you see "Diesel Fuel" transactions, ALWAYS flag for FTC calculation
- FTC amount = Litres × Current FTC Rate (approximately 44.2 cents per litre for heavy vehicles)
- This goes in BAS field 7D - separate from GST calculations
- Example: "Diesel Fuel (450 Litres): $990.00" = 450 × $0.442 = $198.90 FTC claim
- ALWAYS ask user for litres when categorizing fuel purchases

**INCOME CLASSIFICATION:**
- Linehaul Service payments: Business Income (subject to GST)
- Fuel Levy Surcharge: ASSESSABLE INCOME (not a reimbursement) - MUST include in G1
- All freight payments are subject to GST if business turns over >$75k

**🚨 MANDATORY LOGBOOK REQUIREMENTS:**
- ALL vehicle expenses require ATO-compliant logbook
- Usually 100% business use for dedicated truck drivers
- ALWAYS remind user: "Logbook required for all vehicle claims"

**VEHICLE EXPENSES (typically 100% business for truck drivers):**
- Fuel: Motor Vehicle expenses + potential FTC claim
- Truck lease/finance: Business expenses (check if GST-free financial service)
- Insurance & Registration: Motor Vehicle expenses
- Repairs & Maintenance: Motor Vehicle expenses
- Tyres & consumables: Motor Vehicle expenses

**ON-ROAD EXPENSES (Overnight work trips only):**
- Meals while away overnight: Travel expenses (must be reasonable)
- Accommodation while away overnight: Travel expenses  
- Must keep receipts and prove work-related

**COMMON BUSINESS EXPENSES:**
- Ratchet straps, work gloves: Consumables/Equipment
- Tools and equipment: Equipment (check instant asset write-off threshold)
- Professional association fees: Professional Development
- Logbooks: Office supplies

**GST TREATMENT:**
- Most truck driving income: Include GST in calculations
- Equipment purchases: Claim GST credits (1B field)
- Fuel: Pay GST on purchase (claim 1B), but FTC separate calculation

**MANDATORY EXCLUSIONS (categorize as "Personal"):**
- Personal meals (not overnight work trips)
- Fines and traffic penalties
- Personal use portions of vehicle

**SAMPLE TRANSACTION PATTERNS:**
- "LogiCorp Freight" payments → Business Income + GST
- "Fuel Levy Surcharge" → Business Income (assessable)
- "BP TRUCK STOP - Diesel Fuel" → Motor Vehicle + ask for litres for FTC
- "Bunnings - Ratchet Straps" → Equipment/Consumables
- "TRUCKFINANCE PTY LTD - Lease Payment" → Vehicle expenses (likely GST-free)
`,

    "Allied Health": `
**CRITICAL ALLIED HEALTH BAS RULES (Real-World Expertise):**

**🚨 HEALTH SERVICES ARE GENERALLY GST-FREE - MOST IMPORTANT RULE:**
- Health services are GST-free if Medicare benefit payable OR supplied by registered health professional
- Physiotherapy, psychology, chiropractic, etc. are typically GST-FREE
- DO NOT include professional health service income in G1 (Total Sales) for GST calculations
- Still assessable income for tax purposes, but NOT for BAS GST calculation

**GST REFUND OPPORTUNITY:**
- You CAN claim GST credits on business purchases (rent, supplies, equipment)
- Since income is GST-free (1A = $0), you'll likely get GST REFUNDS each quarter
- Explain to user: "Because health services are GST-free, you may receive GST refunds"

**INCOME CLASSIFICATION:**
- Patient payments (HICAPS/EFTPOS): GST-free health services
- Medicare rebates: GST-free health services
- Training/education income: May be GST-free (education) or taxable

**PROFESSIONAL REGISTRATION & COMPLIANCE:**
- AHPRA registration fees: Professional Development (usually GST-free)
- Professional association fees: Professional Development
- Professional indemnity insurance: Essential business expense

**COMMON BUSINESS EXPENSES (Claim GST credits on these):**
- Clinic rent: Office expenses (claim GST credit on rental)
- Clinical supplies: Equipment/Consumables (oils, tape, bands, needles)
- Practice software: Office expenses (Cliniko, etc.)
- Equipment: Professional equipment purchases

**SAMPLE TRANSACTION PATTERNS:**
- "Patient Payments (HICAPS/EFTPOS): $850.00" → Income (GST-FREE)
- "Medicare Rebates Processed: $212.80" → Income (GST-FREE)
- "AHPRA - Registration Renewal: $450.00" → Professional Development (GST-free)
- "Clinic Supplies - Massage Oil: $75.00" → Equipment + claim GST
- "Commercial Realty - Room Rental: $1,200.00" → Office expenses + claim GST

**BAS CALCULATION IMPACT:**
- G1 (Total Sales): $0 for health services (GST-free)
- 1A (GST on Sales): $0 for health services
- 1B (GST Credits): Normal claims on business purchases (rent, supplies, equipment)
- Net Result: Usually GST refund each quarter

**CONTINUING PROFESSIONAL DEVELOPMENT:**
- CPD courses: Training & Development (often GST-free if education)
- Professional conferences: Training & Development
- Clinical supervision: Professional Development

**MANDATORY EXCLUSIONS:**
- Personal health treatments
- Personal development not professionally required
- Personal use of equipment/vehicles
`,
  };

  return guidance[industry] || `
GENERAL BAS COMPLIANCE RULES:
1. INCOME: Report all business income, separate from reimbursements to avoid double-counting
2. AVOID DOUBLE-COUNTING: Equipment included in service fees vs separate purchases
3. GST: Register if annual turnover >$75k, input credits on business purchases only
4. APPORTIONMENT: Home office, vehicle, phone need business % allocation if mixed use

INCOME CATEGORIES:
- Professional Services: Consultation fees, service income, project payments
- Product Sales: Product revenue, retail sales (if applicable)

EXPENSE SUBCATEGORIES:
- Equipment & Tools: Industry-specific equipment, software, tools, technology
- Professional Development: Training, courses, certifications directly related to business
- Office Expenses: Rent, utilities, supplies, communications (apportion home office)
- Professional Services: Licenses, memberships, professional fees, legal/accounting
- Vehicle Expenses: Business travel, client visits (apportion personal use)
- Insurance: Professional indemnity, public liability, business insurance
- Marketing & Advertising: Website, advertising, business cards, promotional materials
- Communications: Phone, internet, mobile data (apportion business use %)
- Electricity: Office/workspace power (apportion business use %)

MANDATORY EXCLUSIONS (categorize as "Personal" - not business deductible):
- Fines, penalties, parking tickets, traffic violations
- Personal entertainment, meals not for business purposes
- Personal clothing (unless specific uniform/safety requirements)
- Private use portions of mixed-use items

MAYBE Category (requires user review for apportionment):
- Home office expenses needing business use percentage
- Vehicle expenses with mixed business/personal use
- Training with both business and personal benefit
- Equipment used for both business and personal purposes

SPECIAL HANDLING:
- Keep detailed records for apportionment calculations
- Equipment over $300 may require depreciation vs immediate deduction
- Distinguish between capital purchases and deductible expenses
- Ensure proper tax invoices for GST input credit claims`;
}

async function processBatch(
  input: CategorizeTransactionsInput,
  apiKey: string
): Promise<CategorizeTransactionsOutput> {
  // Create industry-specific prompt for comprehensive categorization with detailed subcategories
  const firstPassPrompt = `You are a financial analyst specializing in ${
    input.industry
  } Business Activity Statement (BAS) categorization for Australian sole traders.

CRITICAL BAS ACCURACY RULES:

1. **EXCLUDE NON-DEDUCTIBLE ITEMS:**
   - Fines, penalties, parking tickets, traffic violations = NOT DEDUCTIBLE
   - Personal purchases, entertainment, private travel, personal clothing
   - Private use portions of mixed-use items
   - Capital purchases that should be depreciated (equipment >$300)

2. **HANDLE APPORTIONMENT ITEMS (mark as "Maybe" for user review):**
   - Phone bills, internet, electricity with mixed business/personal use
   - Vehicle expenses with both business and personal use
   - Home office costs requiring business use percentage
   - Training/education with both business and personal benefit

3. **AVOID DOUBLE-COUNTING:**
   - Material costs vs markup when billing clients
   - Platform fees already deducted from deposits vs individual fee transactions
   - Reimbursements already included in other income
   - Equipment included in service contracts vs separate purchases

4. **APPLY INDUSTRY-SPECIFIC RULES:**
   - Follow GST registration requirements (>$75k annual turnover)
   - Distinguish between different income types (services vs products vs allowances)
   - Identify industry-specific mandatory exclusions
   - Recognize common apportionment scenarios for the industry

CATEGORIZATION RULES:

**INCOME Categories:**
- "Income": All business income including primary revenue, tips, bonuses, allowances

**EXPENSE Subcategories (choose the most specific one):**
- "Equipment & Tools": Professional equipment, tools, technology, software, machinery
- "Vehicle Expenses": Fuel, maintenance, registration, insurance, repairs (business portion only)
- "Professional Services": Licenses, registrations, legal fees, accounting, professional memberships
- "Training & Development": Courses, certifications, conferences directly related to business
- "Office Expenses": Rent, utilities, supplies, printing, postage, stationery
- "Communications": Phone bills, internet, mobile data (business portion only)
- "Insurance": Professional indemnity, public liability, business insurance, equipment insurance
- "Materials & Supplies": Industry-specific materials, consumables, job supplies
- "Travel & Accommodation": Business travel, client visits, accommodation, meals while traveling
- "Marketing & Advertising": Website costs, advertising, business cards, promotional materials
- "Equipment Maintenance": Servicing, repairs, calibration of business equipment
- "Safety Equipment": PPE, safety gear, protective equipment, first aid supplies
- "Subcontractor Payments": Payments to other professionals/trades (ensure proper invoices)
- "Equipment Hire": Rental of specialist equipment, tools, machinery
**MANDATORY EXCLUSIONS (categorize as "Personal" - not business deductible):**
- "Personal": Fines, penalties, parking tickets, traffic violations, personal entertainment, private purchases, personal clothing (unless specific uniform/PPE)

**MAYBE Category (requires user review for apportionment or clarification):**
- "Maybe": Mixed business/personal use items (phone, electricity, vehicle, home office)
- "Maybe": Transactions requiring business use percentage calculation
- "Maybe": Training/education with both business and personal benefit
- "Maybe": Unclear transactions needing clarification

**INDUSTRY-SPECIFIC GUIDANCE for ${input.industry}:**
${getIndustrySpecificGuidance(input.industry)}

**CRITICAL INSTRUCTIONS:**
1. **Apply industry-specific BAS rules**: Use the detailed guidance above for your industry
2. **Exclude non-deductible items**: Automatically categorize fines, penalties, and personal items as "Personal"
3. **Identify apportionment needs**: Mark mixed-use items (phone, electricity, vehicle, home office) as "Maybe"
4. **Prevent double-counting**: Check for duplicate charges, included fees, or material markups
5. **Recognize real-world patterns**: Apply pattern matching for common industry transactions

**REAL-WORLD PATTERN RECOGNITION:**

**For Truck Driving:**
- "LogiCorp Freight", "Remittance Advice" patterns → Business Income
- "Fuel Levy Surcharge" → Business Income (assessable, not reimbursement)
- "Diesel Fuel", "BP TRUCK STOP" → Vehicle Expenses (note: flag for FTC)
- "Ratchet Straps", "Work Gloves" → Equipment & Tools
- "TRUCKFINANCE", "Lease Payment" → Vehicle Expenses

**For NDIS Support Work:**
- "MyPlan Connect", "Plan Manager" payments → Income (GST-FREE)
- "Community Access", "In-Home Support" → Income (GST-FREE)
- "AAMI Insurance - Professional Indemnity" → Professional Services
- "Art Supplies (for client)", "Sensory Toy" → Materials & Supplies
- "First Aid Course", "CPR Course" → Training & Development

**For Allied Health:**
- "Patient Payments", "HICAPS", "EFTPOS" → Income (GST-FREE)
- "Medicare Rebates" → Income (GST-FREE)
- "AHPRA Registration" → Professional Services (GST-free)
- "Massage Oil", "Resistance Bands" → Materials & Supplies
- "Room Rental", "Health Hub" → Office Expenses

**For Construction & Trades:**
- "BuildRight Homes", customer invoices → Business Income
- "Labour - Fix-out", hourly rates → Business Income
- "Materials - Skirting" → Business Income (markup portion)
- "Milwaukee", "Circular Saw" → Equipment & Tools (check write-off threshold)
- "Bunnings - Timber" → Materials & Supplies (Cost of Goods Sold)
- "Waste Disposal" → Professional Services

**GST TREATMENT ALERTS:**
- NDIS income → GST-FREE (exclude from G1 calculation)
- Allied Health services → GST-FREE (exclude from G1 calculation)
- Truck driving freight → Usually GST applicable
- Construction income → Usually GST applicable
5. **Use specific subcategories**: Choose the most precise expense subcategory available
6. **Maintain accuracy**: Include confidence scores (0.0-1.0) based on clarity of categorization
7. **Preserve details**: Keep original transaction information exactly as provided

Transactions to categorize:
${JSON.stringify(input.rawTransactions, null, 2)}

Return a JSON object with this exact structure:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "original description", 
      "amount": 0.00,
      "category": "Income or Expenses or Maybe or Personal",
      "subCategory": "specific subcategory from the expense list above, or 'Business Income' for income, or 'Non-deductible' for personal",
      "confidence": 0.85
    }
  ]
}
    }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: firstPassPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google AI API error:", errorText);
    throw new Error(`AI API failed: ${response.status}`);
  }

  const result = await response.json();
  const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  console.log("AI response text:", aiText);

  // Extract JSON from the response
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON found in AI response:", aiText);
    return { transactions: [] };
  }

  try {
    const parsedResult = JSON.parse(jsonMatch[0]);
    console.log("Successfully parsed AI result:", parsedResult);

    // Separate transactions by category
    const categorizedTransactions = parsedResult.transactions || [];
    console.log(
      "Raw categorized transactions from AI:",
      categorizedTransactions.length
    );

    if (categorizedTransactions.length === 0) {
      console.error("AI returned empty transactions array");
      console.error("Full AI response:", aiText);
      // Fallback: mark all as "Maybe" for manual review
      const fallbackMaybeTransactions = input.rawTransactions.map((t) => ({
        ...t,
        category: "Maybe",
        subCategory: "Requires Manual Review",
        confidence: 0.1,
      }));
      return {
        transactions: [],
        maybeTransactions: fallbackMaybeTransactions,
      };
    }

    const finalTransactions: any[] = [];
    const maybeTransactions: any[] = [];

    categorizedTransactions.forEach((transaction: any) => {
      if (
        transaction.category === "Maybe" ||
        (transaction.confidence && transaction.confidence < 0.6)
      ) {
        maybeTransactions.push({
          ...transaction,
          category: "Maybe",
        });
      } else {
        finalTransactions.push(transaction);
      }
    });

    const finalResult = {
      transactions: finalTransactions,
      maybeTransactions:
        maybeTransactions.length > 0 ? maybeTransactions : undefined,
    };

    console.log(
      "processBatch returning:",
      JSON.stringify(finalResult, null, 2)
    );
    console.log(
      `Batch processed: ${finalTransactions.length} certain, ${maybeTransactions.length} uncertain transactions`
    );
    return finalResult;
  } catch (parseError) {
    console.error("Failed to parse AI JSON response:", parseError);
    console.error("Raw AI text:", aiText);
    return { transactions: [] };
  }
}
