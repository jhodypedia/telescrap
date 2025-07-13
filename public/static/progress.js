const socket = io();
socket.on("progress", msg => document.getElementById("progress").innerText = msg);
socket.on("done", msg => {
  document.getElementById("progress").innerText = msg;
  setTimeout(() => location.reload(), 2000);
});
