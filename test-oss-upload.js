import { fetch, FormData } from "undici";

async function test() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  // 1. Get OSS upload policy from DashScope
  const policyRes = await fetch('https://dashscope.aliyuncs.com/api/v1/uploads?action=getPolicy&model=wan2.6-i2v-flash', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const policyData = await policyRes.json();
  const d = policyData.data;
  const fileName = 'source.png';
  const key = d.upload_dir + '/' + fileName;
  
  // 2. Upload to OSS
  const fd = new FormData();
  fd.append('OSSAccessKeyId', d.oss_access_key_id);
  fd.append('Signature', d.signature);
  fd.append('policy', d.policy);
  fd.append('key', key);
  fd.append('x-oss-object-acl', d.x_oss_object_acl);
  fd.append('x-oss-forbid-overwrite', d.x_oss_forbid_overwrite);
  fd.append('success_action_status', '200');
  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  fd.append('file', new Blob([pngBytes], { type: 'image/png' }), fileName);
  const uRes = await fetch(d.upload_host, { method: 'POST', body: fd });
  console.log('Upload Status:', uRes.status);
  
  const bucketName = d.upload_host.split('//')[1].split('.')[0];
  // Per doc: oss://<bucket>/<object>
  const candidates = [
    `oss://${bucketName}/${key}`,
    `https://${bucketName}.oss-cn-beijing.aliyuncs.com/${key}`,
    `https://${d.upload_host.split('//')[1]}/${key}`,
    `oss-cn-beijing.aliyuncs.com/${key}`,
    `${bucketName}/${key}`
  ];
  for (const url of candidates) {
    console.log(`\n=== Testing URL: ${url} ===`);
    const tRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' },
      body: JSON.stringify({ model: 'wan2.6-i2v-flash', input: { prompt: 'a cat', img_url: url } })
    });
    const text = await tRes.text();
    console.log('Submit Status:', tRes.status);
    const obj = JSON.parse(text);
    const taskId = obj.output?.task_id;
    if (taskId) {
      await new Promise(r => setTimeout(r, 6000));
      const r2 = await fetch('https://dashscope.aliyuncs.com/api/v1/tasks/' + taskId, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const t2 = await r2.text();
      const o2 = JSON.parse(t2);
      console.log('Task Status:', o2.output?.task_status, o2.output?.task_status === 'FAILED' ? o2.output?.message : '');
      if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(o2.output?.task_status)) {
        if (o2.output?.task_status === 'SUCCEEDED' && o2.output?.results?.video_url) {
          console.log('!!! SUCCESS !!! VIDEO URL:', o2.output.results.video_url);
          return;
        }
      }
    } else {
      console.log('No task ID, response:', text);
    }
  }
}
test().catch(console.error);
