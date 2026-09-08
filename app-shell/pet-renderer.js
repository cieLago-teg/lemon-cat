const video = document.querySelector('video');
function failed() { document.querySelector('[role=alert]').hidden = false; }
video.addEventListener('error', failed);
window.addEventListener('contextmenu', (event) => { event.preventDefault(); window.close(); });
window.petMedia.read().then(async (bytes) => {
  video.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
  await video.play();
}).catch(failed);
