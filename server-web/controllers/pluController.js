const PLU = require('../models/PLU');

const getAllPLUProducts = async (req, res) => {
  try {
    const plus = await PLU.find();
    res.json(plus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createPLUProduct = async (req, res) => {
  try {
    const { pluCode, name, pricePerKg, category } = req.body;
    const newPLU = new PLU({ pluCode, name, pricePerKg, category });
    await newPLU.save();
    res.status(201).json(newPLU);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePLUProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { pluCode, name, pricePerKg, category } = req.body;
    const updatedPLU = await PLU.findByIdAndUpdate(
      id,
      { pluCode, name, pricePerKg, category },
      { new: true }
    );
    if (!updatedPLU) {
      return res.status(404).json({ message: 'Sản phẩm PLU không tìm thấy' });
    }
    res.json(updatedPLU);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deletePLUProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPLU = await PLU.findByIdAndDelete(id);
    if (!deletedPLU) {
      return res.status(404).json({ message: 'Sản phẩm PLU không tìm thấy' });
    }
    res.json({ message: 'Sản phẩm PLU đã bị xóa' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllPLUProducts,
  createPLUProduct,
  updatePLUProduct,
  deletePLUProduct,
};