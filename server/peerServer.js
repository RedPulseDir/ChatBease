const { PeerServer } = require('peer');

const peerServer = PeerServer({
  port: 9000,
  path: '/peerjs',
  proxied: true
});

peerServer.on('connection', (client) => {
  console.log('Peer подключился:', client.id);
});

peerServer.on('disconnect', (client) => {
  console.log('Peer отключился:', client.id);
});

console.log('PeerServer запущен на порту 9000');
