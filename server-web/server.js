require('dotenv').config(); // PHẢI Ở DÒNG ĐẦU TIÊN

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db'); // Import từ file db.js

const app = express();
app.use(express.json());
connectDB();

app.use(cors());

app.get('/', (req, res) => {
  res.send('Smart Supermarket API');
});

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/plus', require('./routes/plus'));
app.use('/api/admin', require('./routes/admin')); 
app.use('/api/payment', require('./routes/payment')); 
app.use('/api/bill', require('./routes/bill')); // Thêm route bill
app.use('/api/settings', require('./routes/settings'))

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));