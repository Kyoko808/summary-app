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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000); // 25秒タイムアウト

        try {
            // バックエンドの要約エンドポイントにリクエストを送信
            const response = await fetch('/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '要約に失敗しました。');
            }

            const data = await response.json();
            summaryOutput.textContent = data.summary;

        } catch (error) {
            console.error('Error summarizing URL:', error);
            if (error.name === 'AbortError') {
                errorMessage.textContent = 'エラー: 処理がタイムアウトしました。Renderサーバーのスリープ解除中か、URLの読み込みに時間がかかっている可能性があります。もう一度「要約する」を押してみてください。';
            } else {
                errorMessage.textContent = `エラー: ${error.message}`;
            }
            errorMessage.classList.remove('hidden');
        } finally {
            clearTimeout(timeout);
            loadingIndicator.classList.add('hidden');
        }
    });
});
