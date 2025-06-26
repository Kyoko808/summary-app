require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const app = express();
const port = 3000;

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
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const dom = new JSDOM(html, { url: url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        return article ? article.textContent : null;
    } catch (error) {
        console.error('コンテンツの抽出中にエラーが発生しました:', error);
        return null;
    }
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
        if (!content) {
            return res.status(400).json({ error: '指定されたURLから本文を抽出できませんでした。' });
        }

        // 抽出したコンテンツが長すぎる場合、最初の数文字に制限する（APIのトークン制限対策）
        const MAX_CONTENT_LENGTH = 10000; // 例: 10000文字に制限
        const textToSummarize = content.length > MAX_CONTENT_LENGTH ? content.substring(0, MAX_CONTENT_LENGTH) + '...' : content;

        // 2. Gemini APIで要約
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `以下の日本語のテキストを1行で要約してください。\n\n${textToSummarize}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        res.json({ summary: summary });

    } catch (error) {
        console.error('要約処理中にエラーが発生しました:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
});
