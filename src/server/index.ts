import express from 'express';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 8000;

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../dist')));

// API routes
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 