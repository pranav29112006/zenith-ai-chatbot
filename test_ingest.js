const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/documents/ingest',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=---123'
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.write('-----123\r\n');
req.write('Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n');
req.write('Content-Type: application/pdf\r\n\r\n');
req.write('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj 4 0 obj<</Length 21>>stream\nBT /F1 12 Tf (Hello) Tj ET\nendstream\nendobj xref 0 5 0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000109 00000 n \n0000000194 00000 n \ntrailer<</Size 5/Root 1 0 R>>startxref 265 %%EOF\r\n');
req.write('-----123--\r\n');
req.end();
