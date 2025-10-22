const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const fastapiTarget = 'http://127.0.0.1:8000';
const angularTarget = 'http://127.0.0.1:4200';



// Proxy API and Swagger docs
app.use('/api', createProxyMiddleware({
    target: fastapiTarget,
    changeOrigin: true,

   
}));



// Everything else → Angular
app.use('/', createProxyMiddleware({
    target: angularTarget,
    changeOrigin: true,

}));

app.listen(3000,'0.0.0.0',() => {
    console.log('Reverse proxy running at http://127.0.0.1:3000');
});