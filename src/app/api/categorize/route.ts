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
CRITICAL CONSTRUCTION BAS RULES:
1. INCOME: Separate contract payments from material markups to avoid double-counting
2. AVOID DOUBLE-COUNTING: Materials purchased vs materials charged to clients
3. GST: Register if annual turnover >$75k, input credits on business purchases only
4. APPORTIONMENT: Tools, vehicles, workspace need business % allocation if mixed use

INCOME CATEGORIES:
- Contract Income: Job payments, project fees, hourly labor rates
- Material Markups: Markup portion only (not raw material cost)

EXPENSE SUBCATEGORIES:
- Tools & Equipment: Hand tools, power tools, machinery, safety equipment
- Materials & Supplies: Timber, steel, concrete, fittings, consumables (job-specific)
- Vehicle Expenses: Work truck/van costs, fuel for job sites (apportion if personal use)
- Professional Services: Trade licenses, certifications, building permits, inspections
- Safety & Compliance: PPE, hard hats, safety boots, hi-vis, first aid supplies
- Office Expenses: Project management software, plans, permits, communications
- Subcontractor Payments: Payments to other trades (ensure proper tax invoices)
- Equipment Hire: Crane hire, scaffolding, specialist equipment rental
- Training & Development: Trade courses, safety training, equipment certifications
- Insurance: Public liability, professional indemnity, tool insurance, vehicle insurance
- Electricity: Workshop/shed power (apportion business use %)
- Communications: Phone, internet for business (apportion business use %)

SPECIAL HANDLING:
- Separate material costs from markup when billing clients
- Tools over $300 may need depreciation vs immediate deduction
- Vehicle expenses require logbook for business use percentage
- Exclude fines (parking tickets, safety violations) - not deductible`,

    "NDIS Support Work": `
CRITICAL NDIS BAS RULES:
1. INCOME: Use official NDIS payment statements, separate from travel allowances
2. AVOID DOUBLE-COUNTING: Mileage reimbursements vs actual travel expenses
3. GST: May not apply if <$75k turnover, but check NDIS provider requirements
4. APPORTIONMENT: Vehicle, phone, training often mixed business/personal use

INCOME CATEGORIES:
- Support Services: NDIS plan funding, client care fees, hourly rates
- Travel Allowances: Mileage reimbursements, travel time payments (check if taxable)

EXPENSE SUBCATEGORIES:
- Training & Development: Disability care training, first aid, manual handling courses
- Vehicle Expenses: Travel between clients, fuel, maintenance (apportion personal use)
- Equipment & Supplies: Care equipment, medical supplies, safety items, uniforms
- Professional Services: NDIS worker screening, background checks, registration fees
- Insurance: Professional indemnity, public liability, vehicle insurance
- Communications: Phone, mobile data for client contact (apportion business use %)
- Office Expenses: Record keeping software, stationery, client documentation
- Electricity: Home office for administrative work (apportion business use %)
- Professional Development: Disability sector conferences, continuing education
- Safety Equipment: PPE, protective equipment, cleaning supplies

MANDATORY EXCLUSIONS (categorize as "Personal" - not business deductible):
- Personal meals, entertainment, private vehicle use
- Fines, penalties, parking tickets
- Personal clothing (unless specific uniform/PPE)

SPECIAL HANDLING:
- NDIS payments vs private client payments may have different GST treatment
- Vehicle logbook essential for business use percentage
- Training must be directly related to disability support work
- Exclude personal development not specific to NDIS work`,

    "Truck Driving": `
CRITICAL TRUCKING BAS RULES:
1. INCOME: Separate freight payments from fuel/travel allowances to avoid double-counting
2. AVOID DOUBLE-COUNTING: Company fuel cards vs personal fuel purchases
3. GST: Heavy vehicle industry often >$75k, ensure GST registration compliance
4. APPORTIONMENT: Truck expenses if owner-driver with personal use (rare)

INCOME CATEGORIES:
- Freight Income: Delivery payments, per-km rates, load fees, contract payments
- Allowances: Overnight allowances, meal allowances (check if taxable)

EXPENSE SUBCATEGORIES:
- Vehicle Expenses: Fuel, maintenance, tyres, repairs, registration, roadworthy
- Accommodation & Meals: Overnight stays, meal expenses while away from home base
- Equipment & Tools: Load restraints, straps, chains, tarps, safety equipment
- Professional Services: License renewals, medical certificates, log book audits
- Insurance: Vehicle insurance, goods in transit, public liability
- Communications: CB radio, GPS, mobile phone for dispatch (apportion if personal use)
- Safety & Compliance: Safety equipment, drug/alcohol testing, compliance training
- Office Expenses: Logbook software, record keeping, fuel cards, admin
- Training & Development: Heavy vehicle training, dangerous goods, crane tickets
- Tolls: Road tolls, bridge tolls (keep detailed records)
- Equipment Hire: Trailer hire, specialist loading equipment

MANDATORY EXCLUSIONS (categorize as "Personal" - not business deductible):
- Fines for traffic violations, parking, overweight penalties
- Personal meals when not traveling for work
- Personal vehicle use portions

SPECIAL HANDLING:
- Fuel tax credits may apply - coordinate with BAS reporting
- Logbook records essential for business deductions
- Interstate work may have different compliance requirements
- Distinguish between employee reimbursements vs owner-driver expenses`,

    "Allied Health": `
CRITICAL ALLIED HEALTH BAS RULES:
1. INCOME: Professional services vs education/training income may have different GST treatment
2. AVOID DOUBLE-COUNTING: Equipment purchases vs clinic rental inclusions
3. GST: Register if >$75k turnover, input credits on professional equipment only
4. APPORTIONMENT: Home office, vehicle, training often mixed business/personal

INCOME CATEGORIES:
- Professional Services: Consultation fees, treatment sessions, assessments, reports
- Training Income: Workshop fees, education services, supervision fees

EXPENSE SUBCATEGORIES:
- Equipment & Tools: Treatment equipment, software, technology, medical devices
- Professional Development: Courses, conferences, continuing education, supervision
- Professional Services: Registration fees, professional body memberships, indemnity insurance
- Office Expenses: Clinic rent, utilities, reception, appointment software, stationery
- Vehicle Expenses: Travel to clients, home visits (apportion personal use)
- Communications: Phone, internet, telehealth setup (apportion business use %)
- Insurance: Professional indemnity, public liability, equipment insurance
- Equipment Maintenance: Calibration, servicing, repairs of professional equipment
- Reference Materials: Professional journals, textbooks, assessment tools
- Electricity: Clinic/home office power (apportion business use %)
- Marketing & Advertising: Website, professional cards, directory listings

MANDATORY EXCLUSIONS (categorize as "Personal" - not business deductible):
- Personal development not related to professional practice
- Fines, penalties, parking tickets
- Personal clothing (unless specific uniform requirements)
- Personal travel not for professional purposes

SPECIAL HANDLING:
- Professional development must be directly related to practice area
- Home office expenses require business use percentage calculation
- Equipment over $300 may require depreciation schedule
- Distinguish between personal and professional insurance policies`
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
