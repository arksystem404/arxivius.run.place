import React, { useState, useEffect } from 'react';

// Main App component
const App = () => {
  // Base URL for the API
  const BASE_API_URL = 'https://smt.aethernagames.com/unity.php?accountid=9158&sess=782546733';

  // States to store different parts of the data fetched from API
  const [shareMarketData, setShareMarketData] = useState([]);
  const [portfolioData, setPortfolioData] = useState([]);
  const [newsSummaryData, setNewsSummaryData] = useState([]);
  const [playerData, setPlayerData] = useState(null);
  const [profileDetailData, setProfileDetailData] = useState(null);
  const [selectedStockSymbol, setSelectedStockSymbol] = useState(null);
  const [shareDetailData, setShareDetailData] = useState(null);

  // States for loading and error management
  const [loadingMarket, setLoadingMarket] = useState(true); // Keep true for initial full load
  const [loadingProfile, setLoadingProfile] = useState(true); // Keep true for initial full load
  const [loadingShareDetail, setLoadingShareDetail] = useState(false); // Only for specific share detail fetch
  const [errorMarket, setErrorMarket] = useState(null);
  const [errorProfile, setErrorProfile] = useState(null);
  const [errorShareDetail, setErrorShareDetail] = useState(null);

  // States for stock screener filters
  const [filters, setFilters] = useState({
    minPrice: '', maxPrice: '',
    minVolume: '', maxVolume: '',
    minPE: '', maxPE: '',
    minPB: '', maxPB: '',
    minDividendYield: '', maxDividendYield: '',
  });

  // States for sorting
  const [sortColumn, setSortColumn] = useState('sID');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // State for LLM-generated analysis (individual stock analysis)
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loadingAiAnalysis, setLoadingAiAnalysis] = useState(false);
  const [errorAiAnalysis, setErrorAiAnalysis] = useState(null);

  // States for AI Stock Picker feature
  const [aiPickedStocks, setAiPickedStocks] = useState('');
  const [loadingAiPickedStocks, setLoadingAiPickedStocks] = useState(false);
  const [errorAiPickedStocks, setErrorAiPickedStocks] = useState(null);

  // States for Recommended Portfolio feature
  const [aiRecommendedPortfolio, setAiRecommendedPortfolio] = useState('');
  const [loadingAiRecommendedPortfolio, setLoadingAiRecommendedPortfolio] = useState(false);
  const [errorAiRecommendedPortfolio, setErrorAiRecommendedPortfolio] = useState(null);

  // States for Market Q&A feature
  const [marketQuestion, setMarketQuestion] = useState('');
  const [aiMarketAnswer, setAiMarketAnswer] = useState('');
  const [loadingAiMarketAnswer, setLoadingAiMarketAnswer] = useState(false);
  const [errorAiMarketAnswer, setErrorAiMarketAnswer] = useState(null);


  // Consolidated loading and error checks - Defined here to ensure it's always in scope
  const initialLoadComplete = !loadingMarket && !loadingProfile;
  const overallError = errorMarket || errorProfile || errorShareDetail || errorAiAnalysis || errorAiPickedStocks || errorAiRecommendedPortfolio || errorAiMarketAnswer;


  // --- Helper function to format currency values with two decimal places (assuming API returns value * 100) ---
  const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }
    // Divide by 100 to adjust for implied scaling, then format to 2 decimal places
    return (value / 100).toFixed(2).toLocaleString('en-US'); // Explicitly use 'en-US' for consistent comma separation
  };

  // --- Helper function to format large numbers with commas, no fixed decimals (e.g., Book Value, Market Capital, Shares Outstanding) ---
  const formatLargeNumber = (value) => {
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }
    // Directly apply toLocaleString for large whole numbers, no division or fixed decimals
    return value.toLocaleString('en-US'); // Explicitly use 'en-US' for consistent comma separation
  };

  // --- Fetch initial market and profile data on component mount and for live refresh ---
  const fetchInitialData = async () => {
    // Only show full loading screen on the very first fetch
    if (shareMarketData.length === 0 && portfolioData.length === 0 && !playerData && !profileDetailData) {
      setLoadingMarket(true);
      setLoadingProfile(true);
    } else {
      // For subsequent refreshes, just update the background loading state
      setLoadingMarket(true); // Indicate background update for market
      setLoadingProfile(true); // Indicate background update for profile
    }
    setErrorMarket(null);
    setErrorProfile(null);

    try {
      // Fetch market data
      const marketResponse = await fetch(`${BASE_API_URL}&f=getsharemarket`);
      if (!marketResponse.ok) throw new Error(`HTTP error! Status: ${marketResponse.status} for market data`);
      const marketData = await marketResponse.json();
      setShareMarketData(Array.isArray(marketData.sharemarket) ? marketData.sharemarket : []);
      setPortfolioData(Array.isArray(marketData.portfolio) ? marketData.portfolio : []);
      setNewsSummaryData(Array.isArray(marketData.newssummary) ? marketData.newssummary : []);
      setPlayerData(marketData.playerdata || null);

      // Fetch profile detail data
      const profileResponse = await fetch(`${BASE_API_URL}&f=getprofiledetail`);
      if (!profileResponse.ok) throw new Error(`HTTP error! Status: ${profileResponse.status} for profile detail`);
      const profileData = await profileResponse.json();
      if (profileData.profile) {
          setProfileDetailData(profileData.profile);
          setPlayerData(prev => ({ ...prev, ...profileData.profile }));
      }

      // Only set initial selected stock if not already selected
      if (!selectedStockSymbol && marketData.sharemarket && marketData.sharemarket.length > 0) {
        setSelectedStockSymbol(marketData.sharemarket[0].sID);
      }

    } catch (err) {
      setErrorMarket(err.message);
      setErrorProfile(err.message);
      console.error("Failed to fetch initial data:", err);
    } finally {
      setLoadingMarket(false);
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchInitialData(); // Fetch immediately on mount
    const intervalId = setInterval(fetchInitialData, 60000); // Refresh every 60 seconds (1 minute)
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [selectedStockSymbol]); // Re-fetch initial data if selectedStockSymbol changes to ensure its details are fresh

  // --- Fetch share detail data when selectedStockSymbol changes ---
  useEffect(() => {
    const fetchShareDetail = async () => {
      if (!selectedStockSymbol) {
        setShareDetailData(null);
        setAiAnalysis(''); // Clear previous analysis
        return;
      }

      setLoadingShareDetail(true); // Indicate background update for share detail
      setErrorShareDetail(null);
      setAiAnalysis(''); // Clear previous analysis when a new stock is selected
      try {
        const shareDetailResponse = await fetch(`${BASE_API_URL}&f=getsharedetail&s=${selectedStockSymbol}`);
        if (!shareDetailResponse.ok) throw new Error(`HTTP error! Status: ${shareDetailResponse.status} for ${selectedStockSymbol} detail`);
        const detailData = await shareDetailResponse.json();
        setShareDetailData(detailData);
      } catch (err) {
        setErrorShareDetail(err.message);
        console.error(`Failed to fetch detail for ${selectedStockSymbol}:`, err);
      } finally {
        setLoadingShareDetail(false);
      }
    };

    fetchShareDetail();
  }, [selectedStockSymbol]); // Re-fetch detail when selectedStockSymbol changes

  // --- LLM Integration: Get AI Stock Analysis (for selected stock) ---
  const getAiStockAnalysis = async () => {
    if (!shareDetailData || !shareDetailData.sharedetail) {
      setErrorAiAnalysis('No stock details available for AI analysis.');
      return;
    }

    setLoadingAiAnalysis(true);
    setErrorAiAnalysis(null);
    setAiAnalysis('');

    const stock = shareDetailData.sharedetail;
    const price = stock.lp / 100;
    const eps = stock.leps / 100;
    const bv = stock.bv;
    const ts = stock.ts; // Shares Outstanding
    const mostRecentDividends = stock.ld / 100;

    const peRatio = (eps !== 0) ? (price / eps).toFixed(2) : 'N/A';
    const pbRatio = (ts !== 0 && bv !== undefined) ? ((price) / (bv / ts)).toFixed(2) : 'N/A';
    const marketCapital = (price !== undefined && ts !== undefined) ? (price * ts) : 'N/A';
    const dividendYield = (price !== 0) ? ((mostRecentDividends / price) * 100).toFixed(2) : 'N/A';

    let newsArticles = '';
    if (shareDetailData.sharenews && shareDetailData.sharenews.length > 0) {
        newsArticles = shareDetailData.sharenews.map(news => `- ${news.h?.replace('%SID%', stock.sID || '').replace('%INAME%', stock.iid || '')}: ${news.d?.replace('%SID%', stock.sID || '').replace('%INAME%', stock.iid || '')}`).join('\n');
    } else {
        newsArticles = 'No recent specific news available for this stock.';
    }

    const prompt = `Analyze the following stock data and recent news for ${stock.n} (${stock.sID}).
    
    Financial Data:
    - Last Price: $${formatCurrency(stock.lp)}
    - Last EPS: $${formatCurrency(stock.leps)}
    - Book Value: $${formatLargeNumber(stock.bv)}
    - Shares Outstanding: ${formatLargeNumber(stock.ts)}
    - P/E Ratio: ${peRatio}
    - P/B Ratio: ${pbRatio}
    - Market Capital: $${formatLargeNumber(marketCapital)}
    - Most Recent Dividends per Share: $${formatCurrency(stock.ld)}
    - Dividend Yield: ${dividendYield}%
    - Volume: ${stock.v?.toLocaleString()}
    - Change ($): ${(stock.lm / 100).toFixed(2).toLocaleString('en-US')}
    - % Change: ${((stock.lm / stock.lp) * 100).toFixed(2)}%

    Recent News:
    ${newsArticles}

    Based on this information, provide a concise summary of the stock's current financial health, highlight any key positive or negative impacts from the news, and offer a brief, general outlook (e.g., 'potentially stable', 'volatile outlook', 'growth potential'). Keep the analysis to a maximum of 250 words. Focus on actionable insights for an investor.`;

    try {
        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        const apiKey = ""; // Canvas will automatically provide the API key
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            setAiAnalysis(text);
        } else {
            setErrorAiAnalysis('AI analysis failed: No response from LLM.');
            console.error('LLM response structure unexpected:', result);
        }
    } catch (err) {
        setErrorAiAnalysis(`AI analysis failed: ${err.message}. Please try again.`);
        console.error('Error calling Gemini API for stock analysis:', err);
    } finally {
        setLoadingAiAnalysis(false);
    }
  };

  // --- LLM Integration: AI Stock Picker ---
  const getAiStockRecommendations = async () => {
    setLoadingAiPickedStocks(true);
    setErrorAiPickedStocks(null);
    setAiPickedStocks('');

    if (!shareMarketData || shareMarketData.length === 0) {
      setErrorAiPickedStocks('No market data to analyze for stock recommendations.');
      setLoadingAiPickedStocks(false);
      return;
    }

    // Prepare a condensed view of current market data for the LLM
    const marketOverview = shareMarketData.slice(0, 10).map(stock => { // Limit to top 10 for conciseness
      const price = stock.lp / 100;
      const eps = stock.leps / 100;
      const bv = stock.bv;
      const ts = stock.ts;
      const mostRecentDividends = stock.ld / 100;

      const peRatio = (eps !== 0) ? (price / eps).toFixed(2) : 'N/A';
      const pbRatio = (ts !== 0 && bv !== undefined) ? ((price) / (bv / ts)).toFixed(2) : 'N/A';
      const dividendYield = (price !== 0) ? ((mostRecentDividends / price) * 100).toFixed(2) : 'N/A';

      return `${stock.n} (${stock.sID}): Price $${formatCurrency(stock.lp)}, Vol ${stock.v?.toLocaleString()}, P/E ${peRatio}, P/B ${pbRatio}, Div. Yield ${dividendYield}%`;
    }).join('\n');

    const prompt = `Based on the following simplified live stock market data, recommend 2-3 stocks that could be good investments. For each recommendation, briefly explain *why* it's a good choice based on its metrics (e.g., undervalued P/E, high dividend yield, strong volume, etc.). Also, suggest a general investment theme (e.g., "growth play", "value pick", "income stock").
    
    Current Market Data (Top 10 by default):
    ${marketOverview}
    
    Please provide your answer concisely.`;

    try {
        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            setAiPickedStocks(text);
        } else {
            setErrorAiPickedStocks('AI stock picker failed: No response from LLM.');
            console.error('LLM response structure unexpected:', result);
        }
    } catch (err) {
        setErrorAiPickedStocks(`AI stock picker failed: ${err.message}. Please try again.`);
        console.error('Error calling Gemini API for stock picking:', err);
    } finally {
        setLoadingAiPickedStocks(false);
    }
  };

  // --- LLM Integration: Recommended Portfolio ---
  const getAiRecommendedPortfolio = async () => {
    setLoadingAiRecommendedPortfolio(true);
    setErrorAiRecommendedPortfolio(null);
    setAiRecommendedPortfolio('');

    if (!shareMarketData || shareMarketData.length === 0) {
      setErrorAiRecommendedPortfolio('No market data to analyze for portfolio recommendations.');
      setLoadingAiRecommendedPortfolio(false);
      return;
    }

    // Prepare a more comprehensive view of current market data for the LLM
    const marketDataForPortfolio = shareMarketData.map(stock => {
      const price = stock.lp / 100;
      const eps = stock.leps / 100;
      const bv = stock.bv;
      const ts = stock.ts;
      const mostRecentDividends = stock.ld / 100;

      const peRatio = (eps !== 0) ? (price / eps).toFixed(2) : 'N/A';
      const pbRatio = (ts !== 0 && bv !== undefined) ? ((price) / (bv / ts)).toFixed(2) : 'N/A';
      const marketCapital = (price !== undefined && ts !== undefined) ? (price * ts) : 'N/A';
      const dividendYield = (price !== 0) ? ((mostRecentDividends / price) * 100).toFixed(2) : 'N/A';

      return {
        symbol: stock.sID,
        name: stock.n,
        price: price,
        volume: stock.v,
        eps: eps,
        bv: bv,
        ts: ts,
        peRatio: peRatio,
        pbRatio: pbRatio,
        marketCapital: marketCapital,
        mostRecentDividends: mostRecentDividends,
        dividendYield: dividendYield,
        change: stock.lm / 100,
        industry: stock.iID // Assuming iID is industry ID
      };
    });

    const prompt = `Given the following live stock market data, please recommend a balanced investment portfolio of 3-5 stocks. For each recommended stock, state its symbol, name, and a concise reason for its inclusion. Crucially, explain your overall portfolio strategy (e.g., "Growth-oriented with diversification across industries," "Value-focused with a strong dividend component," "Balanced for moderate risk").

    Available Stocks Data (JSON array):
    ${JSON.stringify(marketDataForPortfolio, null, 2)}
    
    Please provide your response in a clear, structured format.`;

    try {
        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            setAiRecommendedPortfolio(text);
        } else {
            setErrorAiRecommendedPortfolio('AI portfolio recommendation failed: No response from LLM.');
            console.error('LLM response structure unexpected:', result);
        }
    } catch (err) {
        setErrorAiRecommendedPortfolio(`AI portfolio recommendation failed: ${err.message}. Please try again.`);
        console.error('Error calling Gemini API for portfolio recommendation:', err);
    } finally {
        setLoadingAiRecommendedPortfolio(false);
    }
  };

  // --- LLM Integration: Market Q&A ---
  const handleMarketQuestion = async () => {
    if (!marketQuestion.trim()) {
      setErrorAiMarketAnswer('Please enter a question to ask the AI.');
      return;
    }

    setLoadingAiMarketAnswer(true);
    setErrorAiMarketAnswer(null);
    setAiMarketAnswer('');

    if (!shareMarketData || shareMarketData.length === 0) {
        setErrorAiMarketAnswer('No market data available to answer questions. Please wait for data to load.');
        setLoadingAiMarketAnswer(false);
        return;
    }

    // Prepare a string representation of market data for the LLM
    const marketDataString = shareMarketData.map(stock => {
        const price = stock.lp / 100;
        const change = stock.lm / 100;
        const volume = stock.v;
        const eps = stock.leps / 100;
        const bv = stock.bv;
        const ts = stock.ts; // Shares Outstanding
        const mostRecentDividends = stock.ld / 100;

        const peRatio = (eps !== 0) ? (price / eps).toFixed(2) : 'N/A';
        const pbRatio = (ts !== 0 && bv !== undefined) ? ((price) / (bv / ts)).toFixed(2) : 'N/A';
        const marketCapital = (price !== undefined && ts !== undefined) ? (price * ts) : 'N/A';
        const dividendYield = (price !== 0) ? ((mostRecentDividends / price) * 100).toFixed(2) : 'N/A';

        return `Stock: ${stock.n} (${stock.sID}), Price: $${price.toFixed(2)}, Change: $${change.toFixed(2)}, %Change: ${((change / price) * 100).toFixed(2)}%, Volume: ${volume}, EPS: $${eps.toFixed(2)}, Book Value: $${bv}, Shares Outstanding: ${ts}, P/E: ${peRatio}, P/B: ${pbRatio}, Market Cap: $${marketCapital}, Dividends per Share: $${mostRecentDividends.toFixed(2)}, Dividend Yield: ${dividendYield}%`;
    }).join('; ');


    // Provide some context for the LLM from news summary
    let marketNewsContext = '';
    if (newsSummaryData && newsSummaryData.length > 0) {
      marketNewsContext = '\n\nRecent Global News Summary:\n' + newsSummaryData.slice(0, 3).map(news => `- ${news.h}`).join('\n');
    }

    const prompt = `You are an AI assistant specialized in stock market knowledge. Your task is to answer the user's question about the stock market based *only* on the provided live market data. If the information needed to answer the question is not present in the provided data, state that you cannot answer it with the current information. Be concise and informative.

    Here is the current live market data for all available stocks:
    ${marketDataString}
    ${marketNewsContext}
    
    User's Question: ${marketQuestion}
    
    Please provide your answer strictly using the provided data.`;

    try {
        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            setAiMarketAnswer(text);
        } else {
            setErrorAiMarketAnswer('AI market Q&A failed: No response from LLM.');
            console.error('LLM response structure unexpected:', result);
        }
    } catch (err) {
        setErrorAiMarketAnswer(`AI market Q&A failed: ${err.message}. Please try again.`);
        console.error('Error calling Gemini API for market Q&A:', err);
    } finally {
        setLoadingAiMarketAnswer(false);
    }
  };


  // --- Filter and Sort Logic ---
  const filteredAndSortedStocks = [...shareMarketData].filter(stock => {
    const price = stock.lp / 100;
    const volume = stock.v;
    const eps = stock.leps / 100;
    const bv = stock.bv;
    const ts = stock.ts; // Shares Outstanding
    const mostRecentDividends = stock.ld / 100; // Most Recent Dividends

    const peRatio = (eps !== 0) ? (price / eps) : NaN;
    const pbRatio = (ts !== 0 && bv !== undefined) ? (price / (bv / ts)) : NaN;
    const dividendYield = (price !== 0) ? (mostRecentDividends / price) * 100 : NaN;

    // Apply filters
    if (filters.minPrice !== '' && price < parseFloat(filters.minPrice)) return false;
    if (filters.maxPrice !== '' && price > parseFloat(filters.maxPrice)) return false;
    if (filters.minVolume !== '' && volume < parseInt(filters.minVolume)) return false;
    if (filters.maxVolume !== '' && volume > parseInt(filters.maxVolume)) return false;
    if (filters.minPE !== '' && (isNaN(peRatio) || peRatio < parseFloat(filters.minPE))) return false;
    if (filters.maxPE !== '' && (isNaN(peRatio) || peRatio > parseFloat(filters.maxPE))) return false;
    if (filters.minPB !== '' && (isNaN(pbRatio) || pbRatio < parseFloat(filters.minPB))) return false;
    if (filters.maxPB !== '' && (isNaN(pbRatio) || pbRatio > parseFloat(filters.maxPB))) return false;
    if (filters.minDividendYield !== '' && (isNaN(dividendYield) || dividendYield < parseFloat(filters.minDividendYield))) return false;
    if (filters.maxDividendYield !== '' && (isNaN(dividendYield) || dividendYield > parseFloat(filters.maxDividendYield))) return false;

    return true;
  }).sort((a, b) => {
    let aValue, bValue;

    // Helper to get raw values for sorting
    const getSortValue = (stock, column) => {
      switch (column) {
        case 'n': return stock.n; // Stock Name
        case 'lp': return stock.lp; // Price
        case 'lm': return stock.lm; // Change ($)
        case 'v': return stock.v; // Volume
        case 'leps': return stock.leps; // Last EPS
        case 'bv': return stock.bv; // Book Value
        case 'peRatio':
          const pe = (stock.leps !== undefined && stock.leps !== 0) ? (stock.lp / stock.leps) : NaN;
          return isNaN(pe) ? -Infinity : pe; // Handle N/A for sorting
        case 'pbRatio':
          const pb = (stock.ts !== undefined && stock.ts !== 0 && stock.bv !== undefined) ? ((stock.lp / 100) / (stock.bv / stock.ts)) : NaN;
          return isNaN(pb) ? -Infinity : pb; // Handle N/A for sorting
        case 'marketCapital':
          const mc = (stock.lp !== undefined && stock.ts !== undefined) ? (stock.lp / 100 * stock.ts) : NaN;
          return isNaN(mc) ? -Infinity : mc;
        case 'ts': return stock.ts; // Shares Outstanding
        case 'ld': // Most Recent Dividends (raw API value)
          return stock.ld;
        case 'dividendYield':
          const dy = (stock.lp !== 0) ? ((stock.ld / 100) / (stock.lp / 100)) * 100 : NaN;
          return isNaN(dy) ? -Infinity : dy;
        default: return stock[column];
      }
    };

    aValue = getSortValue(a, sortColumn);
    bValue = getSortValue(b, sortColumn);

    // Numeric comparison
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    // String comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    return 0;
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };


  if (!initialLoadComplete) { // Show full loading screen only if initial load hasn't completed
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter p-4">
        <div className="text-xl text-gray-700 flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Fetching initial market data...
        </div>
      </div>
    );
  }

  // Display errors if any, once initial load is complete
  if (overallError) { // Check overallError here
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter p-4">
        <p className="text-xl text-red-600">Error: {overallError}</p>
        <p className="text-lg text-gray-600 ml-4">Please check the API endpoints or your network connection.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-inter">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-xl p-6 sm:p-8 space-y-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-6 text-center">
          arXiVius SMT Dashboard
        </h1>

        {/* Player Data Section */}
        {playerData && profileDetailData ? (
          <div className="bg-blue-50 p-4 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">Player Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-gray-700">
              <p><strong>Account ID:</strong> {playerData.a}</p>
              <p><strong>Display Name:</strong> {playerData.dn}</p>
              <p><strong>Cash:</strong> ${formatCurrency(playerData.c)}</p>
              <p>
                <strong>Shares Value:</strong> ${formatCurrency(playerData.s)}
              </p>
              <p>
                <strong>Investor Rating:</strong> {profileDetailData.r !== undefined ? profileDetailData.r.toFixed(4) : 'N/A'}
              </p>
              <p>
                <strong>Guild Name:</strong> {profileDetailData.gn === "None" || profileDetailData.gn === "" ? "Not in a Guild/Firm" : profileDetailData.gn}
              </p>
              <p><strong>Total Dividends:</strong> ${formatCurrency(profileDetailData.td)}</p>
              <p><strong>Total Trading Profit:</strong> ${formatCurrency(profileDetailData.tt)}</p>
              <p><strong>Last Trading Profit:</strong> ${formatCurrency(profileDetailData.ltp)}</p>
              <p><strong>Tutorial Completed:</strong> {profileDetailData.tut === 1008 ? 'Yes' : 'No'}</p>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 p-4 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">Player Information</h2>
            <p className="text-center text-gray-600 text-lg">No player data available.</p>
          </div>
        )}

        {/* Portfolio Section */}
        <div className="bg-purple-50 p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-purple-800 mb-4">My Portfolio</h2>
          {portfolioData.length === 0 ? (
            <p className="text-center text-gray-600 text-lg">No portfolio data available.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-inner">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-purple-100">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">
                      Stock ID
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">
                      Avg. Price
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">
                      Quantity
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">
                      Last Price
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {portfolioData.map((item, index) => (
                    <tr key={index} className="hover:bg-purple-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sm:px-6">
                        {item.sID}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                        {item.n}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                        ${formatCurrency(item.ap)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                        {item.q?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                        ${formatCurrency(item.lp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stock Screener Filters */}
        <div className="bg-indigo-50 p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-indigo-800 mb-4">Stock Screener</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label htmlFor="minPrice" className="text-sm font-medium text-gray-700 mb-1">Min Price</label>
              <input type="number" id="minPrice" name="minPrice" value={filters.minPrice} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 100.00" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="maxPrice" className="text-sm font-medium text-gray-700 mb-1">Max Price</label>
              <input type="number" id="maxPrice" name="maxPrice" value={filters.maxPrice} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 500.00" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="minVolume" className="text-sm font-medium text-gray-700 mb-1">Min Volume</label>
              <input type="number" id="minVolume" name="minVolume" value={filters.minVolume} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 1000" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="maxVolume" className="text-sm font-medium text-gray-700 mb-1">Max Volume</label>
              <input type="number" id="maxVolume" name="maxVolume" value={filters.maxVolume} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 100000" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="minPE" className="text-sm font-medium text-gray-700 mb-1">Min P/E Ratio</label>
              <input type="number" id="minPE" name="minPE" value={filters.minPE} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 10" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="maxPE" className="text-sm font-medium text-gray-700 mb-1">Max P/E Ratio</label>
              <input type="number" id="maxPE" name="maxPE" value={filters.maxPE} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 30" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="minPB" className="text-sm font-medium text-gray-700 mb-1">Min P/B Ratio</label>
              <input type="number" id="minPB" name="minPB" value={filters.minPB} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 1" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="maxPB" className="text-sm font-medium text-gray-700 mb-1">Max P/B Ratio</label>
              <input type="number" id="maxPB" name="maxPB" value={filters.maxPB} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 5" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="minDividendYield" className="text-sm font-medium text-gray-700 mb-1">Min Div. Yield (%)</label>
              <input type="number" id="minDividendYield" name="minDividendYield" value={filters.minDividendYield} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 1.0" />
            </div>
            <div className="flex flex-col">
              <label htmlFor="maxDividendYield" className="text-sm font-medium text-gray-700 mb-1">Max Div. Yield (%)</label>
              <input type="number" id="maxDividendYield" name="maxDividendYield" value={filters.maxDividendYield} onChange={handleFilterChange} className="p-2 border rounded-md" placeholder="e.g., 5.0" />
            </div>
          </div>
        </div>


        {/* Share Market Data Section */}
        <div className="bg-green-50 p-4 rounded-lg shadow-md relative"> {/* Added relative for positioning loader */}
          <h2 className="text-2xl font-semibold text-green-800 mb-4">Live Share Market</h2>
          {/* Small Updating indicator */}
          {(loadingMarket || loadingProfile) && (
            <div className="absolute top-4 right-4 flex items-center text-sm text-gray-600">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </div>
          )}

          {filteredAndSortedStocks.length === 0 ? (
            <p className="text-center text-gray-600 text-lg">No share market data available based on current filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-inner">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-green-100">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('n')}>
                      Stock Name {sortColumn === 'n' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('lp')}>
                      Price {sortColumn === 'lp' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('lm')}>
                      Change ($) {sortColumn === 'lm' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">
                      % Change
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('v')}>
                      Volume {sortColumn === 'v' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('leps')}>
                      Last EPS {sortColumn === 'leps' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('bv')}>
                      Book Value {sortColumn === 'bv' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('peRatio')}>
                      P/E Ratio {sortColumn === 'peRatio' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('pbRatio')}>
                      P/B Ratio {sortColumn === 'pbRatio' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('marketCapital')}>
                      Market Capital {sortColumn === 'marketCapital' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                     <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('ts')}>
                      Shares Outstanding {sortColumn === 'ts' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('ld')}>
                      Most Recent Dividends per Share {sortColumn === 'ld' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6 cursor-pointer" onClick={() => handleSort('dividendYield')}>
                      Dividend Yield {sortColumn === 'dividendYield' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedStocks.map((stock) => {
                    const price = stock.lp;
                    const change = stock.lm;
                    const percent_change = price && change !== undefined && price !== 0
                      ? (change / price) * 100
                      : 0;

                    // Calculate P/E Ratio
                    const peRatio = (stock.leps !== undefined && stock.leps !== 0)
                      ? (price / stock.leps).toFixed(2)
                      : 'N/A';
                    
                    // Calculate P/B Ratio
                    const pbRatio = (stock.ts !== undefined && stock.ts !== 0 && stock.bv !== undefined)
                      ? ((price / 100) / (stock.bv / stock.ts)).toFixed(2)
                      : 'N/A';

                    // Calculate Market Capital
                    const marketCapital = (stock.lp !== undefined && stock.ts !== undefined)
                      ? (stock.lp / 100 * stock.ts)
                      : undefined;

                    // Calculate Dividend Yield
                    const dividendYield = (stock.ld !== undefined && stock.lp !== undefined && (stock.lp / 100) !== 0)
                      ? ((stock.ld / 100) / (stock.lp / 100) * 100).toFixed(2)
                      : 'N/A';

                    return (
                      <tr key={stock.sID} className="hover:bg-green-50 cursor-pointer" onClick={() => setSelectedStockSymbol(stock.sID)}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sm:px-6">
                          {stock.n} ({stock.sID})
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          ${formatCurrency(price)}
                        </td>
                        <td
                          className={`px-4 py-4 whitespace-nowrap text-sm ${
                            change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-700'
                          } font-semibold sm:px-6`}
                        >
                          {change !== undefined ? (change / 100).toFixed(2).toLocaleString('en-US') : 'N/A'}
                        </td>
                        <td
                          className={`px-4 py-4 whitespace-nowrap text-sm ${
                            percent_change > 0 ? 'text-green-600' : percent_change < 0 ? 'text-red-600' : 'text-gray-700'
                          } font-semibold sm:px-6`}
                        >
                          {percent_change?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          {stock.v?.toLocaleString()}
                        </td>
                         <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          ${formatCurrency(stock.leps)}
                        </td>
                         <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          ${formatLargeNumber(stock.bv)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          {peRatio}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          {pbRatio}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          ${formatLargeNumber(marketCapital)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          {formatLargeNumber(stock.ts)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          ${formatCurrency(stock.ld)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 sm:px-6">
                          {dividendYield}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Stock Picker Section */}
        <div className="bg-orange-50 p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-orange-800 mb-4">AI Stock Picker</h2>
          <button
            onClick={getAiStockRecommendations}
            className="mb-4 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors duration-200"
            disabled={loadingAiPickedStocks || shareMarketData.length === 0}
          >
            {loadingAiPickedStocks ? 'Analyzing Market...' : '✨ Get AI Stock Recommendations'}
          </button>
          {errorAiPickedStocks && (
            <p className="text-red-600 text-sm mt-2">{errorAiPickedStocks}</p>
          )}
          {aiPickedStocks && (
            <div className="bg-white p-3 rounded-md shadow-inner text-gray-800 whitespace-pre-wrap">
              {aiPickedStocks}
            </div>
          )}
        </div>

        {/* AI Recommended Portfolio Section */}
        <div className="bg-teal-50 p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-teal-800 mb-4">AI Recommended Portfolio</h2>
          <button
            onClick={getAiRecommendedPortfolio}
            className="mb-4 px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-colors duration-200"
            disabled={loadingAiRecommendedPortfolio || shareMarketData.length === 0}
          >
            {loadingAiRecommendedPortfolio ? 'Crafting Portfolio...' : '📈 Generate Recommended Portfolio'}
          </button>
          {errorAiRecommendedPortfolio && (
            <p className="text-red-600 text-sm mt-2">{errorAiRecommendedPortfolio}</p>
          )}
          {aiRecommendedPortfolio && (
            <div className="bg-white p-3 rounded-md shadow-inner text-gray-800 whitespace-pre-wrap">
              {aiRecommendedPortfolio}
            </div>
          )}
        </div>

        {/* AI Market Q&A Section */}
        <div className="bg-blue-100 p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-blue-800 mb-4">AI Market Q&A</h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              value={marketQuestion}
              onChange={(e) => setMarketQuestion(e.target.value)}
              placeholder="Ask a question about the market..."
              className="flex-grow p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleMarketQuestion();
              }}
            />
            <button
              onClick={handleMarketQuestion}
              className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors duration-200"
              disabled={loadingAiMarketAnswer || !marketQuestion.trim()}
            >
              {loadingAiMarketAnswer ? 'Thinking...' : '❓ Ask AI'}
            </button>
          </div>
          {errorAiMarketAnswer && (
            <p className="text-red-600 text-sm mt-2">{errorAiMarketAnswer}</p>
          )}
          {aiMarketAnswer && (
            <div className="bg-white p-3 rounded-md shadow-inner text-gray-800 whitespace-pre-wrap">
              {aiMarketAnswer}
            </div>
          )}
        </div>


        {/* Selected Stock Detail Section */}
        {selectedStockSymbol && shareDetailData && (
          <div className="bg-yellow-50 p-4 rounded-lg shadow-md space-y-6">
            <h2 className="text-2xl font-semibold text-yellow-800 mb-4">
              Stock Details: {shareDetailData.sharedetail?.n} ({shareDetailData.sharedetail?.sID})
            </h2>

            {/* Basic Stock Info from sharedetail */}
            {shareDetailData.sharedetail && (
                <div className="bg-yellow-100 p-4 rounded-md shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <p>
                        <strong>Last Price:</strong> ${formatCurrency(shareDetailData.sharedetail.lp)}
                    </p>
                    <p>
                        <strong>Change ($):</strong> {shareDetailData.sharedetail.lm !== undefined ? (shareDetailData.sharedetail.lm / 100).toFixed(2).toLocaleString('en-US') : 'N/A'}
                    </p>
                    <p>
                        <strong>Last EPS:</strong> ${formatCurrency(shareDetailData.sharedetail.leps)}
                    </p>
                    <p><strong>Volume:</strong> {shareDetailData.sharedetail.v?.toLocaleString()}</p>
                    <p>
                        <strong>Book Value:</strong> ${formatLargeNumber(shareDetailData.sharedetail.bv)}
                    </p>
                     {/* Financial Ratios */}
                    <p>
                        <strong>P/E Ratio:</strong> {
                            (shareDetailData.sharedetail.leps !== undefined && shareDetailData.sharedetail.leps !== 0)
                                ? (shareDetailData.sharedetail.lp / shareDetailData.sharedetail.leps).toFixed(2)
                                : 'N/A'
                        }
                    </p>
                    <p>
                        <strong>P/B Ratio:</strong> {
                            (shareDetailData.sharedetail.ts !== undefined && shareDetailData.sharedetail.ts !== 0 && shareDetailData.sharedetail.bv !== undefined)
                                ? ((shareDetailData.sharedetail.lp / 100) / (shareDetailData.sharedetail.bv / shareDetailData.sharedetail.ts)).toFixed(2)
                                : 'N/A'
                        }
                    </p>
                     {/* Placeholders for data now derived from API or still unavailable */}
                    <p><strong>Market Capital:</strong> ${formatLargeNumber((shareDetailData.sharedetail.lp / 100) * shareDetailData.sharedetail.ts)}</p>
                    <p><strong>Shares Outstanding:</strong> {formatLargeNumber(shareDetailData.sharedetail.ts)}</p>
                    <p><strong>Most Recent Dividends per Share:</strong> ${formatCurrency(shareDetailData.sharedetail.ld)}</p>
                    <p>
                      <strong>Dividend Yield:</strong> {
                        (shareDetailData.sharedetail.ld !== undefined && shareDetailData.sharedetail.lp !== undefined && (shareDetailData.sharedetail.lp / 100) !== 0)
                        ? ((shareDetailData.sharedetail.ld / 100) / (shareDetailData.sharedetail.lp / 100) * 100).toFixed(2)
                        : 'N/A'
                      }%
                    </p>
                </div>
            )}

            {/* AI Stock Analysis Section for selected stock */}
            <div className="bg-yellow-100 p-4 rounded-md shadow-sm">
                <h3 className="text-xl font-semibold text-yellow-700 mb-3">AI Stock Analysis ✨</h3>
                <button
                    onClick={getAiStockAnalysis}
                    className="mb-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
                    disabled={loadingAiAnalysis}
                >
                    {loadingAiAnalysis ? 'Analyzing...' : '✨ Get AI Stock Analysis'}
                </button>
                {errorAiAnalysis && (
                    <p className="text-red-600 text-sm mt-2">{errorAiAnalysis}</p>
                )}
                {aiAnalysis && (
                    <div className="bg-white p-3 rounded-md shadow-inner text-gray-800 whitespace-pre-wrap">
                        {aiAnalysis}
                    </div>
                )}
            </div>

            {/* Order Depth Section */}
            <div className="bg-yellow-100 p-4 rounded-md shadow-sm">
              <h3 className="text-xl font-semibold text-yellow-700 mb-3">Order Depth</h3>
              {shareDetailData.ordersummary ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-200 p-3 rounded-md">
                      <h4 className="font-semibold text-blue-800">Buyers (Bid) Summary</h4>
                      <p><strong>Total Quantity:</strong> {shareDetailData.ordersummary.bq?.toLocaleString()}</p>
                      <p><strong>Total Buyers:</strong> {shareDetailData.ordersummary.bn?.toLocaleString()}</p>
                    </div>
                    <div className="bg-red-200 p-3 rounded-md">
                      <h4 className="font-semibold text-red-800">Sellers (Ask) Summary</h4>
                      <p><strong>Total Quantity:</strong> {Math.abs(shareDetailData.ordersummary.sq)?.toLocaleString()}</p>
                      <p><strong>Total Sellers:</strong> {shareDetailData.ordersummary.sn?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-blue-700 mb-2">Individual Buy Orders</h4>
                      {shareDetailData.orders && shareDetailData.orders.filter(order => order.q > 0).length > 0 ? (
                        <ul className="list-disc list-inside text-gray-700 text-sm max-h-48 overflow-y-auto pr-2">
                          {shareDetailData.orders
                            .filter(order => order.q > 0)
                            .sort((a, b) => b.p - a.p) // Sort by price descending
                            .map((order, idx) => (
                              <li key={idx}>Quantity: {order.q?.toLocaleString()} at Price: ${formatCurrency(order.p)}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-gray-600 text-sm">No buy orders available.</p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-red-700 mb-2">Individual Sell Orders</h4>
                      {shareDetailData.orders && shareDetailData.orders.filter(order => order.q < 0).length > 0 ? (
                        <ul className="list-disc list-inside text-gray-700 text-sm max-h-48 overflow-y-auto pr-2">
                          {shareDetailData.orders
                            .filter(order => order.q < 0)
                            .sort((a, b) => a.p - b.p) // Sort by price ascending
                            .map((order, idx) => (
                              <li key={idx}>Quantity: {Math.abs(order.q)?.toLocaleString()} at Price: ${formatCurrency(order.p)}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-gray-600 text-sm">No sell orders available.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-600 text-lg">Order depth data not available for this stock.</p>
              )}
            </div>

            {/* Share News Section */}
            <div className="bg-yellow-100 p-4 rounded-md shadow-sm">
                <h3 className="text-xl font-semibold text-yellow-700 mb-3">Recent News for {shareDetailData.sharedetail?.n}</h3>
                {shareDetailData.sharenews && shareDetailData.sharenews.length > 0 ? (
                    <div className="space-y-3">
                        {shareDetailData.sharenews.map((news, index) => (
                            <div key={index} className="bg-white p-3 rounded-md shadow-sm">
                                <h4 className="text-lg font-semibold text-gray-800">{news.h?.replace('%SID%', news.sid || '').replace('%INAME%', news.iid || '')}</h4>
                                <p className="text-sm text-gray-600">{news.d?.replace('%SID%', news.sid || '').replace('%INAME%', news.iid || '')}</p>
                                <p className="text-xs text-gray-500 mt-1">Time: {news.tm} minutes ago</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-600 text-lg">No specific news available for this stock.</p>
                )}
            </div>

            {/* Share History Sections */}
            <div className="bg-yellow-100 p-4 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-yellow-700 mb-3">Price History</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {shareDetailData.sharehistory1 && shareDetailData.sharehistory1.length > 0 && (
                  <div className="bg-white p-3 rounded-md shadow-sm max-h-48 overflow-y-auto">
                    <h4 className="font-semibold text-gray-800 mb-2">1 Minute History</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700">
                      {shareDetailData.sharehistory1.map((price, idx) => (
                        <li key={idx}>${formatCurrency(price)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {shareDetailData.sharehistory5 && shareDetailData.sharehistory5.length > 0 && (
                  <div className="bg-white p-3 rounded-md shadow-sm max-h-48 overflow-y-auto">
                    <h4 className="font-semibold text-gray-800 mb-2">5 Minute History</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700">
                      {shareDetailData.sharehistory5.map((price, idx) => (
                        <li key={idx}>${formatCurrency(price)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {shareDetailData.sharehistory15 && shareDetailData.sharehistory15.length > 0 && (
                  <div className="bg-white p-3 rounded-md shadow-sm max-h-48 overflow-y-auto">
                    <h4 className="font-semibold text-gray-800 mb-2">15 Minute History</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700">
                      {shareDetailData.sharehistory15.map((price, idx) => (
                        <li key={idx}>${formatCurrency(price)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {shareDetailData.sharehistory60 && shareDetailData.sharehistory60.length > 0 && (
                  <div className="bg-white p-3 rounded-md shadow-sm max-h-48 overflow-y-auto">
                    <h4 className="font-semibold text-gray-800 mb-2">60 Minute History</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700">
                      {shareDetailData.sharehistory60.map((price, idx) => (
                        <li key={idx}>${formatCurrency(price)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!shareDetailData.sharehistory1 && !shareDetailData.sharehistory5 && !shareDetailData.sharehistory15 && !shareDetailData.sharehistory60 && (
                    <p className="text-center text-gray-600 text-lg col-span-full">No price history available for this stock.</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Global News Summary Section (from getsharemarket) */}
        <div className="bg-gray-50 p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Global News Summary</h2>
          {newsSummaryData.length === 0 ? (
            <p className="text-center text-gray-600 text-lg">No global news available.</p>
          ) : (
            <div className="space-y-4">
              {newsSummaryData.map((news, index) => (
                <div key={index} className="bg-white p-3 rounded-md shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800">{news.h?.replace('%SID%', news.sid || '').replace('%INAME%', news.iid || '')}</h3>
                  <p className="text-sm text-gray-600">{news.d?.replace('%SID%', news.sid || '').replace('%INAME%', news.iid || '')}</p>
                  <p className="text-xs text-gray-500 mt-1">Time: {news.tm} minutes ago</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
