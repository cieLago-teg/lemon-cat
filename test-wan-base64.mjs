import fs from 'fs';
import { fetch } from 'undici';

async function test() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const fileBuffer = fs.readFileSync('data/archive-images/1780226069066ixxt7cn-result-0.png');
  const base64 = fileBuffer.toString('base64');
  const imgUrl = `data:image/png;base64,${base64}`;
  
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify({
      model: 'wan2.6-i2v-flash',
      input: {
        prompt: 'test',
        img_url: imgUrl
      },
      parameters: {
        resolution: '720P',
        watermark: false
      }
    })
  });
  const data = await response.json();
  console.log(data);
}
test();