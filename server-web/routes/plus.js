const express = require('express');
const router = express.Router();
const PLU = require('../models/PLU');

router.get('/plu/:pluCode', async (req, res) => {
  try {
    const pluCode = req.params.pluCode;
    const product = await PLU.findOne({ pluCode });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;