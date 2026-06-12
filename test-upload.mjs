import fs from 'fs';
import { FormData } from 'undici';
import { fetch } from 'undici';

async function upload() {
  try {
    const fileBuffer = fs.readFileSync('public/pet.png');
    const form = new FormData();
    form.append('file', new Blob([fileBuffer]), 'pet.png');
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    console.log("Response:", data);
  } catch(e) {
    console.error(e);
  }
}
upload();