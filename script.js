document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const summarizeButton = document.getElementById('summarizeButton');
    const summaryOutput = document.getElementById('summaryOutput');
    const loadingIndicator = document.getElementById('loading');
    const errorMessage = document.getElementById('error');

    summarizeButton.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            errorMessage.textContent = 'URLを入力してください。';
            errorMessage.classList.remove('hidden');
            summaryOutput.textContent = '';
            return;
        }

        // エラーメッセージと以前の要約をクリア
        errorMessage.classList.add('hidden');
        summaryOutput.textContent = '';
        loadingIndicator.classList.remove('hidden');

        try {
            // バックエンドの要約エンドポイントにリクエストを送信
            const response = await fetch('/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '要約に失敗しました。');
            }

            const data = await response.json();
            summaryOutput.textContent = data.summary;

        } catch (error) {
            console.error('Error summarizing URL:', error);
            errorMessage.textContent = `エラー: ${error.message}`;
            errorMessage.classList.remove('hidden');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    });
});
