require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const app = express();
const port = process.env.PORT || 3000;

// Gemini APIキーの取得
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('GEMINI_API_KEYが設定されていません。\n.envファイルにGEMINI_API_KEY=YOUR_API_KEYの形式で記述してください。');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

app.use(express.json());
app.use(express.static('./')); // 静的ファイル（index.html, style.css, script.js）を配信

// URLから本文を抽出する関数
async function extractMainContent(url) {
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    const response = await fetch(targetUrl, {
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        }
    });

    if (!response.ok) {
        throw new Error(`Webサイトへのアクセスに失敗しました (HTTP ${response.status})`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: targetUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    let textContent = article ? article.textContent : null;

    // Readabilityで抽出できなかった場合、DOMのbodyから直接テキストを抽出（フォールバック）
    if (!textContent || textContent.trim().length === 0) {
        const body = dom.window.document.querySelector('body');
        if (body) {
            const clone = body.cloneNode(true);
            const scriptsAndStyles = clone.querySelectorAll('script, style, noscript, header, footer, nav');
            scriptsAndStyles.forEach(node => node.remove());
            textContent = clone.textContent;
        }
    }

    if (!textContent || textContent.trim().length === 0) {
        throw new Error('Webサイトから本文テキストを認識・抽出できませんでした');
    }

    return textContent.trim();
}

// Gemini APIの呼び出し（503混雑時の自動リトライ＆フォールバック付き）
async function generateSummaryWithRetry(prompt, retries = 3, delayMs = 1500) {
    const modelsToTry = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
    let lastError = null;

    for (const modelName of modelsToTry) {
        const model = genAI.getGenerativeModel({ model: modelName });
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                return response.text();
            } catch (error) {
                lastError = error;
                const isRetryable = error.message && (error.message.includes('503') || error.message.includes('429') || error.message.includes('high demand') || error.message.includes('Unavailable'));
                
                if (isRetryable && attempt < retries) {
                    console.log(`[Gemini API] ${modelName} の混雑を検出。${delayMs}ms後に再試行します (${attempt}/${retries})...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                } else {
                    break; // このモデルでのリトライを終え、次のモデルへ切り替え
                }
            }
        }
    }
    throw lastError;
}

// 要約エンドポイント
app.post('/summarize', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URLが指定されていません。' });
    }

    try {
        // 1. URLから本文を抽出
        const content = await extractMainContent(url);

        // 抽出したコンテンツが長すぎる場合、最初の数文字に制限する（APIのトークン制限対策）
        const MAX_CONTENT_LENGTH = 10000;
        const textToSummarize = content.length > MAX_CONTENT_LENGTH ? content.substring(0, MAX_CONTENT_LENGTH) + '...' : content;

        // 2. Gemini APIで要約（自動リトライ＆フォールバック機能付き）
        const prompt = `以下の日本語のテキストを1行で要約してください。\n\n${textToSummarize}`;
        const summary = await generateSummaryWithRetry(prompt);

        res.json({ summary: summary });

    } catch (error) {
        console.error('要約処理中にエラーが発生しました:', error.message || error);
        res.status(500).json({ error: `処理に失敗しました。詳細: ${error.message || error}` });
    }
});

app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
});
