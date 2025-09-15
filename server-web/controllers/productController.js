const Product = require('../models/Product');

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  const { barcode, name, price, category } = req.body;
  
  try {
    let product = await Product.findOne({ barcode });
    if (product) return res.status(400).json({ message: 'Sản phẩm đã tồn tại' });

    product = await Product.create({ barcode, name, price, category });
    await product.save();
    
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  const { name, price, category } = req.body;
  
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    product.name = name;
    product.price = price;
    product.category = category;
    
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    await product.remove();
    res.json({ message: 'Sản phẩm đã được xóa' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};