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
INCOME CATEGORIES:
- Contract Income: Job payments, project fees, hourly rates
- Material Markups: Markup on materials sold to clients

EXPENSE SUBCATEGORIES:
- Tools & Equipment: Hand tools, power tools, machinery, depreciation
- Materials & Supplies: Timber, steel, concrete, fittings, consumables
- Safety Equipment: PPE, hard hats, boots, safety gear
- Vehicle Expenses: Work vehicle costs, fuel for job sites
- Professional Development: Trade courses, certifications, licenses`,

    "NDIS Support Work": `
INCOME CATEGORIES:
- Support Services: Client care fees, hourly rates, NDIS plan funding
- Travel Allowances: Mileage reimbursements, travel time payments

EXPENSE SUBCATEGORIES:
- Training & Development: Disability care training, first aid courses
- Vehicle Expenses: Travel between clients, fuel, maintenance
- Equipment & Supplies: Care equipment, medical supplies, safety items
- Professional Services: Background checks, NDIS registration fees
- Insurance: Professional indemnity, public liability insurance`,

    "Truck Driving": `
INCOME CATEGORIES:
- Freight Income: Delivery payments, per-km rates, load fees
- Allowances: Overnight allowances, meal allowances

EXPENSE SUBCATEGORIES:
- Vehicle Expenses: Fuel, maintenance, tyres, repairs, registration
- Accommodation & Meals: Overnight stays, meal expenses while away
- Equipment & Tools: Straps, chains, load securing equipment
- Professional Services: License renewals, medical certificates
- Insurance: Vehicle insurance, goods in transit coverage`,

    "Allied Health": `
INCOME CATEGORIES:
- Professional Services: Consultation fees, treatment sessions, assessments
- Training Income: Workshop fees, education services

EXPENSE SUBCATEGORIES:
- Equipment & Tools: Treatment equipment, software, technology
- Professional Development: Courses, conferences, continuing education
- Professional Services: Registration fees, professional body memberships
- Office Expenses: Clinic rent, utilities, office supplies
- Insurance: Professional indemnity, public liability insurance`
  };

  return guidance[industry] || `
INCOME CATEGORIES:
- Professional Services: Consultation fees, service income, project payments
- Product Sales: Product revenue, retail sales

EXPENSE SUBCATEGORIES:
- Equipment & Tools: Industry-specific equipment, software, tools
- Professional Development: Training, courses, certifications
- Office Expenses: Supplies, utilities, communications
- Professional Services: Licenses, memberships, professional fees
- Insurance: Business insurance, professional liability
- Marketing & Advertising: Website, advertising, promotional materials`;
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
   - Fines, penalties, parking tickets (FINES VIC DIRECT, etc.) = NOT DEDUCTIBLE
   - Personal purchases, entertainment, personal travel
   - Private use portions of mixed-use items

2. **HANDLE APPORTIONMENT ITEMS:**
   - Phone bills, internet, electricity = Need business use % (mark as "Maybe" for user review)
   - Vehicle expenses (if used for personal and business)
   - Home office costs

3. **AVOID DOUBLE-COUNTING:**
   - For rideshare: Platform deposits = net amounts (fees already deducted)
   - Toll charges may already be included in platform summaries
   - Service fees from platform summaries vs individual transactions

CATEGORIZATION RULES:

**INCOME Categories:**
- "Income": All business income including primary revenue, tips, bonuses, government payments

**EXPENSE Subcategories (choose the most specific one):**
- "Vehicle Lease/Rental": Car lease payments, rental fees (Splend, etc.)
- "Fuel": Petrol, diesel, LPG, charging costs
- "Vehicle Maintenance": Repairs, services, parts, tyres, windscreen
- "Tolls": Road tolls, bridge tolls (check for platform duplicates)
- "Vehicle Cleaning": Car wash, detailing, cleaning supplies
- "Electricity": EV charging, office power (NEEDS APPORTIONMENT - mark as Maybe)
- "Equipment & Tools": Professional equipment, tools, technology, software
- "Office Expenses": Stationery, supplies, printing, postage, office rent
- "Professional Services": Legal fees, accounting, consulting, licenses, platform fees
- "Insurance": Vehicle, professional indemnity, public liability, business insurance
- "Training & Development": Courses, certifications, conferences, professional development  
- "Communications": Phone bills, internet, data plans (NEEDS APPORTIONMENT - mark as Maybe)
- "Travel & Accommodation": Business travel, accommodation, meals while traveling
- "Marketing & Advertising": Website costs, advertising, business cards, promotional materials
- "Bank Fees": Transaction fees, account fees, merchant fees, payment processing
- "Materials & Supplies": Industry-specific materials, consumables, supplies
- "Safety Equipment": PPE, safety gear, protective equipment
- "Other Business Expenses": Miscellaneous legitimate business expenses

**MANDATORY EXCLUSIONS (categorize as "Personal" - not business deductible):**
- "Personal": Fines, penalties, parking tickets, personal entertainment, private purchases

**MAYBE Category (requires user review for apportionment or clarification):**
- "Uncertain Business Expense": Mixed business/personal use items, unclear transactions
- "Personal/Business Mixed": Transactions that might be partially deductible

**INDUSTRY-SPECIFIC GUIDANCE for ${input.industry}:**
${getIndustrySpecificGuidance(input.industry)}

**INSTRUCTIONS:**
1. **Apply BAS-specific rules**: Exclude fines/penalties, identify apportionment items
2. **Industry-specific analysis**: Use the guidance below for nuanced categorization
3. **Avoid double-counting**: Be aware of platform fees vs individual transactions
4. **For expenses, assign the most specific subcategory that matches**
5. **For income, use category "Income" and appropriate subcategory**
6. **Use "Personal" for non-deductible items (fines, personal purchases)**
7. **Use "Maybe" for mixed-use items needing apportionment or unclear transactions**
8. **Include confidence scores (0.0-1.0)**
9. **Preserve original transaction details exactly**

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
