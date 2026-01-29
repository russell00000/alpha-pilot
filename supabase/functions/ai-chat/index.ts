import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch the investing philosophy from the database
async function fetchPhilosophy(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: philosophy, error } = await supabase
      .from("investing_philosophy")
      .select("*")
      .limit(1)
      .single();

    if (error || !philosophy) {
      console.log("Failed to fetch philosophy:", error);
      return "";
    }

    return `
## INVESTING PHILOSOPHY
${philosophy.philosophy_text}

## RISK GUIDANCE
${philosophy.risk_guidance}

## COMMUNICATION STYLE
${philosophy.market_insights_style}
`;
  } catch (error) {
    console.error("Error fetching philosophy:", error);
    return "";
  }
}

// All securities - 250+ stocks covering all major sectors
const TOP_STOCKS = [
  // Mega Cap Tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL',
  // Large Cap Tech
  'CRM', 'ADBE', 'CSCO', 'ACN', 'IBM', 'INTC', 'AMD', 'QCOM', 'TXN', 'NOW',
  'INTU', 'AMAT', 'MU', 'LRCX', 'SNPS', 'CDNS', 'KLAC', 'MRVL', 'ADI', 'NXPI',
  'MCHP', 'ON', 'SWKS', 'MPWR', 'FTNT', 'PANW', 'CRWD', 'ZS', 'OKTA', 'DDOG',
  // International Tech
  'ASML', 'TSM', 'SAP', 'SONY', 'BABA', 'JD', 'PDD', 'BIDU', 'NIO', 'LI', 'XPEV',
  // Growth Tech
  'ARM', 'PLTR', 'SNOW', 'NET', 'SHOP', 'SQ', 'COIN', 'HOOD', 'SOFI', 'AFRM',
  'RBLX', 'U', 'SNAP', 'PINS', 'SPOT', 'TTD', 'ROKU', 'ZM', 'DOCU', 'TWLO',
  // Consumer Tech
  'NFLX', 'DIS', 'WBD', 'PARA', 'CMCSA', 'CHTR', 'TMUS', 'VZ', 'T',
  // Rideshare & Delivery
  'UBER', 'LYFT', 'DASH', 'ABNB', 'BKNG', 'EXPE', 'MAR', 'HLT',
  // EV & Auto
  'RIVN', 'LCID', 'F', 'GM', 'TM', 'HMC', 'RACE',
  // Healthcare & Pharma
  'UNH', 'LLY', 'JNJ', 'MRK', 'ABBV', 'PFE', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'VRTX', 'REGN', 'MRNA', 'BIIB', 'ILMN', 'DXCM', 'ISRG', 'SYK',
  'MDT', 'BDX', 'ZBH', 'BSX', 'EW', 'ALGN', 'HOLX', 'IDXX', 'MTD', 'A',
  'CI', 'ELV', 'HUM', 'CVS', 'MCK', 'CAH', 'ABC', 'VEEV', 'ZTS', 'IQV',
  // Financials
  'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'C', 'GS', 'MS', 'SCHW',
  'AXP', 'BLK', 'SPGI', 'CME', 'ICE', 'CB', 'MMC', 'AON', 'PGR', 'TRV',
  'MET', 'AIG', 'PRU', 'AFL', 'ALL', 'USB', 'PNC', 'TFC', 'COF', 'DFS',
  // Consumer Staples
  'PG', 'KO', 'PEP', 'COST', 'WMT', 'PM', 'MO', 'MDLZ', 'CL', 'KMB',
  'GIS', 'K', 'HSY', 'KHC', 'SJM', 'CPB', 'MKC', 'CHD', 'CLX', 'EL',
  // Consumer Discretionary
  'HD', 'MCD', 'NKE', 'SBUX', 'TJX', 'LOW', 'TGT', 'ROST', 'ORLY', 'AZO',
  'BBY', 'DG', 'DLTR', 'ULTA', 'LULU', 'GPS', 'ANF', 'VFC', 'PVH', 'RL',
  'CMG', 'DPZ', 'YUM', 'DARDEN', 'WEN', 'QSR',
  // Industrials
  'CAT', 'DE', 'HON', 'UNP', 'UPS', 'FDX', 'RTX', 'BA', 'LMT', 'NOC',
  'GD', 'GE', 'MMM', 'EMR', 'ITW', 'PH', 'ROK', 'ETN', 'JCI', 'CARR',
  'OTIS', 'TT', 'IR', 'CMI', 'PCAR', 'FAST', 'WM', 'RSG', 'VRSK', 'CPRT',
  // Energy
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX', 'VLO', 'OXY', 'DVN',
  'HES', 'FANG', 'PXD', 'HAL', 'BKR', 'KMI', 'WMB', 'OKE', 'EP', 'TRGP',
  // Utilities
  'NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE', 'XEL', 'ED', 'WEC',
  'ES', 'AWK', 'DTE', 'PPL', 'FE', 'AES', 'NRG', 'EVRG', 'ATO', 'NI',
  // REITs
  'PLD', 'AMT', 'CCI', 'EQIX', 'PSA', 'O', 'WELL', 'DLR', 'SPG', 'VICI',
  'AVB', 'EQR', 'VTR', 'ARE', 'MAA', 'UDR', 'ESS', 'INVH', 'SUI', 'ELS',
  // Materials
  'LIN', 'APD', 'SHW', 'ECL', 'DD', 'NEM', 'FCX', 'DOW', 'NUE', 'STLD',
  'VMC', 'MLM', 'ALB', 'PPG', 'IFF', 'FMC', 'CE', 'EMN', 'CF', 'MOS',
  // Telecom
  'TMUS', 'VZ', 'T', 'LUMN', 'USM', 'SATS',
  // Additional Popular
  'PYPL', 'EBAY', 'ETSY', 'W', 'CHWY', 'PTON', 'GME', 'AMC', 'BBBY', 'BB',
  'SPCE', 'RKLB', 'LUNR', 'ASTS', 'IONQ', 'QUBT', 'RGTI', 'AI', 'UPST', 'PATH'
];

// 60+ ETFs covering all major categories
const TOP_ETFS = [
  // Major Index
  'SPY', 'QQQ', 'DIA', 'IWM', 'IWF', 'IWD', 'VTI', 'VOO', 'VTV', 'VUG',
  // Sector ETFs
  'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLB', 'XLU', 'XLRE',
  'VGT', 'VFH', 'VHT', 'VIS', 'VCR', 'VDC', 'VAW', 'VPU', 'VNQ',
  // Tech & Semiconductor
  'SOXX', 'SMH', 'IGV', 'SKYY', 'HACK', 'BOTZ', 'ROBO', 'ARKK', 'ARKW', 'ARKG',
  // Leveraged & Inverse
  'TQQQ', 'SQQQ', 'SPXL', 'SPXS', 'SOXL', 'SOXS', 'UPRO', 'SDOW', 'UVXY', 'VXX',
  // Fixed Income
  'BND', 'AGG', 'LQD', 'HYG', 'TLT', 'IEF', 'SHY', 'TIP', 'VCSH', 'VCIT',
  // International
  'EFA', 'VEA', 'VWO', 'EEM', 'IEFA', 'IEMG', 'VT', 'VXUS', 'FXI', 'EWJ',
  // Commodities
  'GLD', 'SLV', 'GDX', 'GDXJ', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'CPER',
  // Dividend
  'SCHD', 'VYM', 'DVY', 'VIG', 'SDY', 'NOBL', 'DGRO', 'DGRW', 'HDV', 'SPYD',
  // Thematic
  'ICLN', 'TAN', 'QCLN', 'LIT', 'DRIV', 'JETS', 'KWEB', 'MCHI', 'XBI', 'IBB'
];

// Mutual Funds
const MUTUAL_FUNDS = [
  'VFIAX', 'FXAIX', 'VTSAX', 'SWPPX', 'VBTLX', 'VXUS', 'FCNTX', 'FBALX', 'VWELX', 'VWINX',
  'VTMGX', 'VTIAX', 'VIGAX', 'VVIAX', 'VGSLX', 'VGHCX', 'VWUAX', 'VMVAX', 'VSMAX', 'VEMAX',
  'FSKAX', 'FSMAX', 'FSPSX', 'FEMKX', 'FXNAX', 'FBNDX', 'FTBFX', 'FXSTX', 'FSPTX', 'FSPHX'
];

// Crypto - Top 20 by market cap
const CRYPTO = [
  'BTC-USD', 'ETH-USD', 'BNB-USD', 'XRP-USD', 'SOL-USD', 'ADA-USD', 'DOGE-USD', 'TRX-USD',
  'TON11419-USD', 'LINK-USD', 'MATIC-USD', 'DOT-USD', 'LTC-USD', 'SHIB-USD', 'BCH-USD',
  'AVAX-USD', 'XLM-USD', 'UNI7083-USD', 'ATOM-USD', 'FIL-USD'
];

interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high52Week: number;
  low52Week: number;
  volume: number;
  marketCap: number;
}

// Fetch detailed quote data from Yahoo Finance
async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const price = meta.regularMarketPrice || meta.previousClose;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    
    return {
      symbol,
      name: meta.shortName || meta.longName || symbol,
      price,
      change,
      changePercent,
      high52Week: meta.fiftyTwoWeekHigh || 0,
      low52Week: meta.fiftyTwoWeekLow || 0,
      volume: meta.regularMarketVolume || 0,
      marketCap: meta.marketCap || 0
    };
  } catch (e) {
    console.log(`Failed to fetch ${symbol}:`, e);
    return null;
  }
}

// Fetch real-time market data for all platform securities
async function fetchMarketData(): Promise<string> {
  const allSymbols = [...TOP_STOCKS, ...TOP_ETFS, ...MUTUAL_FUNDS, ...CRYPTO];
  
  try {
    // Fetch in parallel batches to avoid rate limiting
    const batchSize = 15;
    const quotes: QuoteData[] = [];
    
    for (let i = 0; i < allSymbols.length; i += batchSize) {
      const batch = allSymbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(fetchQuote));
      quotes.push(...batchResults.filter((q): q is QuoteData => q !== null));
    }
    
    if (quotes.length === 0) {
      console.log("No market data fetched");
      return "";
    }

    const timestamp = new Date().toISOString();
    console.log(`Fetched ${quotes.length} market quotes`);
    
    // Format data in categories for better AI understanding
    const stockQuotes = quotes.filter(q => TOP_STOCKS.includes(q.symbol));
    const etfQuotes = quotes.filter(q => TOP_ETFS.includes(q.symbol));
    const mutualFundQuotes = quotes.filter(q => MUTUAL_FUNDS.includes(q.symbol));
    const cryptoQuotes = quotes.filter(q => CRYPTO.includes(q.symbol));
    
    const formatQuote = (q: QuoteData) => {
      const changeStr = q.changePercent >= 0 ? `+${q.changePercent.toFixed(2)}%` : `${q.changePercent.toFixed(2)}%`;
      const distFromHigh = q.high52Week ? ((q.price - q.high52Week) / q.high52Week * 100).toFixed(1) : 'N/A';
      return `${q.symbol} (${q.name}): $${q.price.toFixed(2)} ${changeStr}, 52W High: $${q.high52Week?.toFixed(2) || 'N/A'} (${distFromHigh}% from high), 52W Low: $${q.low52Week?.toFixed(2) || 'N/A'}`;
    };
    
    let marketDataStr = `\n\n=== REAL-TIME MARKET DATA (${timestamp}) ===\n\n`;
    
    if (stockQuotes.length > 0) {
      marketDataStr += `TOP 100 STOCKS:\n${stockQuotes.map(formatQuote).join('\n')}\n\n`;
    }
    
    if (etfQuotes.length > 0) {
      marketDataStr += `ETFs:\n${etfQuotes.map(formatQuote).join('\n')}\n\n`;
    }
    
    if (mutualFundQuotes.length > 0) {
      marketDataStr += `MUTUAL FUNDS:\n${mutualFundQuotes.map(formatQuote).join('\n')}\n\n`;
    }
    
    if (cryptoQuotes.length > 0) {
      marketDataStr += `CRYPTO:\n${cryptoQuotes.map(formatQuote).join('\n')}\n\n`;
    }
    
    // Add market summary
    const sp500 = etfQuotes.find(q => q.symbol === 'SPY');
    const nasdaq = etfQuotes.find(q => q.symbol === 'QQQ');
    const btc = cryptoQuotes.find(q => q.symbol === 'BTC-USD');
    
    if (sp500 || nasdaq) {
      marketDataStr += `MARKET SUMMARY:\n`;
      if (sp500) marketDataStr += `S&P 500 (SPY): ${sp500.changePercent >= 0 ? '+' : ''}${sp500.changePercent.toFixed(2)}%\n`;
      if (nasdaq) marketDataStr += `NASDAQ (QQQ): ${nasdaq.changePercent >= 0 ? '+' : ''}${nasdaq.changePercent.toFixed(2)}%\n`;
      if (btc) marketDataStr += `Bitcoin: $${btc.price.toLocaleString()} (${btc.changePercent >= 0 ? '+' : ''}${btc.changePercent.toFixed(2)}%)\n`;
    }
    
    return marketDataStr;
  } catch (error) {
    console.error("Error fetching market data:", error);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request with", messages.length, "messages");

    // Fetch philosophy and market data
    const [philosophy, marketData] = await Promise.all([
      fetchPhilosophy(),
      fetchMarketData()
    ]);
    console.log("Fetched philosophy:", philosophy ? "success" : "none");
    console.log("Fetched market data:", marketData ? "success" : "none");

    const systemPrompt = `You are Vantage Copilot—a friendly investing buddy who knows every security.

${philosophy}

## CRITICAL RULES
- NEVER say "I don't see that ticker" or ask for more info. You know every stock, ETF, crypto, and company.
- 2-3 sentences max. Get to the point fast.
- For any security asked about: give your analysis + Buy/Hold/Sell + target price. Use approximate prices if needed.
- Sound human: use "I'd" and "you" naturally

## LIVE MARKET DATA (use when available, otherwise use your knowledge)
${marketData}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI Gateway response structure:", JSON.stringify(data, null, 2));
    
    // Handle different response structures from various models
    const aiResponse = data.choices?.[0]?.message?.content 
      || data.message?.content 
      || data.content
      || data.response
      || (typeof data === 'string' ? data : null);
    
    if (!aiResponse) {
      console.error("Could not extract response from AI data:", JSON.stringify(data));
      throw new Error("Failed to parse AI response");
    }
    
    console.log("Successfully generated AI response");

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
