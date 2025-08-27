export default {
  async fetch(request, env, ctx) {
    // CORS設定
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // OPTIONSリクエストの処理（CORS preflight）
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    // POSTリクエストのみ処理
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'POSTメソッドのみサポートしています'
      }), {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      // リクエストボディから画像データを取得
      const formData = await request.formData();
      const imageFile = formData.get('image');
      
      if (!imageFile) {
        return new Response(JSON.stringify({
          error: '画像ファイルが提供されていません'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      // 画像をBase64に変換
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // OpenAI APIキーを環境変数から取得
      const apiKey = env.OPENAI_API_KEY;
      
      if (!apiKey) {
        return new Response(JSON.stringify({
          error: 'OpenAI APIキーが設定されていません'
        }), {
          status: 500,
          headers: corsHeaders
        });
      }

      // OpenAI APIにリクエスト
      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `以下の画像を分析して、肌の状態を11項目で評価してください。各項目は0-100点で採点し、総合評価も算出してください。

分析項目：
1. しみ (shimi)
2. しわ (shiwa)
3. ほうれい線 (houreisen)
4. べたつき (betatsuki)
5. うるおい (uruoi)
6. ハリ (hari)
7. 透明感 (toumeikan)
8. 毛穴 (keana)
9. くすみ (kusumi)
10. きめ (kime)
11. くま (kuma)

以下のJSON形式で回答してください：
{
  "overall_score": 総合評価点,
  "features": {
    "shimi": {"score": 点数, "description": "説明"},
    "shiwa": {"score": 点数, "description": "説明"},
    "houreisen": {"score": 点数, "description": "説明"},
    "betatsuki": {"score": 点数, "description": "説明"},
    "uruoi": {"score": 点数, "description": "説明"},
    "hari": {"score": 点数, "description": "説明"},
    "toumeikan": {"score": 点数, "description": "説明"},
    "keana": {"score": 点数, "description": "説明"},
    "kusumi": {"score": 点数, "description": "説明"},
    "kime": {"score": 点数, "description": "説明"},
    "kuma": {"score": 点数, "description": "説明"}
  },
  "strengths": ["長所1", "長所2", "長所3"],
  "weaknesses": ["短所1", "短所2", "短所3"],
  "recommendations": ["推奨事項1", "推奨事項2", "推奨事項3"]
}`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        })
      });

      if (!openAIResponse.ok) {
        const errorData = await openAIResponse.json();
        throw new Error(`OpenAI API エラー: ${errorData.error?.message || '不明なエラー'}`);
      }

      const data = await openAIResponse.json();
      const content = data.choices[0].message.content;
      
      // JSONデータを抽出
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AIの回答からJSONデータを抽出できませんでした');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);

      // 成功レスポンス
      return new Response(JSON.stringify({
        success: true,
        analysis: analysis
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('肌分析エラー:', error);
      
      return new Response(JSON.stringify({
        error: '肌分析中にエラーが発生しました: ' + error.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
