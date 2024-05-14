const FastBootAppServer = require('fastboot-app-server');

let server = new FastBootAppServer({
  distPath: 'output/dist',
  gzip: true, // Optional - Enables gzip compression.
  host: '0.0.0.0', // Optional - Sets the host the server listens on.
  port: 4200, // Optional - Sets the port the server listens on (defaults to the PORT env var or 3000).
  log: true, // Optional - Specifies whether the server should use its default request logging. Useful for turning off default logging when providing custom logging middlewares
  chunkedResponse: true, // Optional - Opt-in to chunked transfer encoding, transferring the head, body and potential shoeboxes in separate chunks. Chunked transfer encoding should have a positive effect in particular when the app transfers a lot of data in the shoebox.
});

server.start();
